#!/usr/bin/env python3
"""Offline whole-song NOVA processing. No host/project mutation or network.
A new output folder retains original/A/B/C, matched auditions and immutable settings.
Resume reuses only verified completed stages; interrupted stages restart from zero.
"""
import argparse
import array
import hashlib
import fcntl
import resource
import platform
import json
import math
import os
from pathlib import Path
import signal
import struct
import subprocess
import sys
import time

CHUNK = 4096
VERSION = 'nova-whole-song-v1'


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def atomic_json(path, value):
    tmp = path.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    os.replace(tmp, path)


def wav_info(path):
    size = path.stat().st_size
    with path.open('rb') as f:
        header = f.read(12)
        if len(header) != 12 or header[:4] != b'RIFF' or header[8:] != b'WAVE':
            raise ValueError('RIFF WAVE required; RF64/compressed files unsupported')
        end = struct.unpack_from('<I', header, 4)[0] + 8
        if end != size:
            raise ValueError('RIFF size mismatch/truncated or trailing data')
        fmt = data = None
        while f.tell() + 8 <= end:
            name, length = struct.unpack('<4sI', f.read(8))
            at = f.tell()
            if at + length > end:
                raise ValueError('truncated WAV chunk')
            if name == b'fmt ':
                if fmt is not None or length < 16 or length > 65536:
                    raise ValueError('invalid/duplicate fmt')
                raw = f.read(length)
                tag, channels, rate, byte_rate, align, bits = struct.unpack_from('<HHIIHH', raw)
                if tag == 0xfffe:
                    if length < 40 or struct.unpack_from('<H', raw, 16)[0] < 22:
                        raise ValueError('invalid extensible fmt')
                    valid_bits, mask = struct.unpack_from('<HI', raw, 18)
                    guid = raw[24:40]
                    if guid[4:] != bytes.fromhex('00001000800000aa00389b71') or valid_bits != bits or mask not in (0, 4 if channels == 1 else 3):
                        raise ValueError('unsupported channel layout/valid bits/subformat')
                    tag = struct.unpack_from('<I', guid)[0]
                fmt = (tag, channels, rate, byte_rate, align, bits)
            elif name == b'data':
                if data is not None:
                    raise ValueError('multiple data chunks unsupported')
                data = (at, length)
            f.seek(at + length + (length & 1))
        if f.tell() != end or fmt is None or data is None:
            raise ValueError('missing/truncated chunks')
    tag, channels, rate, byte_rate, align, bits = fmt
    if tag not in (1, 3) or channels not in (1, 2) or rate not in (44100, 48000, 96000) or bits not in ((16, 24, 32) if tag == 1 else (32,)):
        raise ValueError('PCM16/24/32 or float32 mono/stereo 44.1/48/96 kHz required')
    if align != channels * (bits // 8) or byte_rate != rate * align or data[1] % align:
        raise ValueError('invalid WAV frame alignment')
    frames = data[1] // align
    if not rate * .4 <= frames <= rate * 7200:
        raise ValueError('duration must be 0.4 seconds..2 hours')
    return dict(format=tag, channels=channels, sampleRate=rate, bits=bits, offset=data[0], dataBytes=data[1], frames=frames)


def decode(path, info, destination):
    width, channels = info['bits'] // 8, info['channels']
    with path.open('rb') as f, destination.open('xb') as out:
        f.seek(info['offset'])
        remaining = info['dataBytes']
        while remaining:
            raw = f.read(min(remaining, CHUNK * width * channels))
            if not raw:
                raise ValueError('source truncated during decode')
            remaining -= len(raw)
            if info['format'] == 3 or width in (2, 4):
                values = array.array('f' if info['format'] == 3 else ('h' if width == 2 else 'i'))
                values.frombytes(raw)
                if sys.byteorder != 'little':
                    values.byteswap()
                divisor = 1 if info['format'] == 3 else 1 << (info['bits'] - 1)
                pcm = array.array('f', (x / divisor for x in values))
                if channels == 1:
                    pcm = array.array('f', (x for value in pcm for x in (value, value)))
            else:
                pcm = array.array('f')
                for i in range(0, len(raw), width * channels):
                    values = [int.from_bytes(raw[i+c*width:i+(c+1)*width], 'little', signed=True) / (1 << (info['bits']-1)) for c in range(channels)]
                    pcm.extend(values if channels == 2 else values * 2)
            if any(not math.isfinite(x) or abs(x) > 16 for x in pcm):
                raise ValueError('nonfinite/abnormal WAV sample')
            if sys.byteorder != 'little':
                pcm.byteswap()
            out.write(pcm.tobytes())


def wave_from_raw(raw, output, rate, scale=1):
    size = raw.stat().st_size
    if size + 36 > 0xffffffff:
        raise ValueError('output exceeds RIFF bound')
    tmp = output.with_suffix('.wav.partial')
    with raw.open('rb') as f, tmp.open('wb') as out:
        out.write(struct.pack('<4sI4s4sIHHIIHH4sI', b'RIFF', size + 36, b'WAVE', b'fmt ', 16, 3, 2, rate, rate * 8, 8, 32, b'data', size))
        for block in iter(lambda: f.read(CHUNK * 8), b''):
            pcm = array.array('f')
            pcm.frombytes(block)
            if sys.byteorder != 'little':
                pcm.byteswap()
            if scale != 1:
                pcm = array.array('f', (x * scale for x in pcm))
            if sys.byteorder != 'little':
                pcm.byteswap()
            out.write(pcm.tobytes())
    os.replace(tmp, output)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('wav', type=Path)
    parser.add_argument('--engine', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--project', required=True)
    parser.add_argument('--track', required=True)
    parser.add_argument('--version', required=True, help='explicit song/audio revision ID')
    parser.add_argument('--source', choices=['logic-render', 'recorded-audio', 'development-fixture'], required=True)
    parser.add_argument('--kind', choices=['track', 'bus', 'stereo-out'], required=True)
    parser.add_argument('--role', choices=['piano', 'strings', 'bass', 'drums', 'vocal', 'unspecified'], default='unspecified')
    parser.add_argument('--instruction', default='全体の音を自然に整えて')
    parser.add_argument('--target-lufs', type=float, default=-14)
    parser.add_argument('--ceiling-dbtp', type=float, default=-1)
    parser.add_argument('--confirm-source', action='store_true', required=True)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--handoff', type=Path, help='read-only #501 Logic handoff JSON')
    parser.add_argument('--stem', action='append', default=[], help='explicit aligned role=path.wav; one per role')
    parser.add_argument('--confirm-stem-alignment', action='store_true')
    args = parser.parse_args()
    if not all(x.strip() for x in (args.project, args.track, args.version)):
        parser.error('explicit project/track/version required')
    if not math.isfinite(args.target_lufs) or not -36 <= args.target_lufs <= -5 or not math.isfinite(args.ceiling_dbtp) or not -12 <= args.ceiling_dbtp <= -1:
        parser.error('target -36..-5 LUFS, ceiling -12..-1 dBTP required')
    info = wav_info(args.wav)
    handoff = None
    if args.handoff:
        if args.handoff.stat().st_size > 16*1024*1024:
            parser.error('handoff exceeds 16 MiB')
        package = json.loads(args.handoff.read_text())
        if package.get('format') != 'nova-logic-instrument-package-v1' or package.get('projectId') != args.project:
            parser.error('handoff format/project mismatch')
        matches = [t for t in package.get('tracks', []) if t.get('id') == args.track]
        if len(matches) != 1:
            parser.error('handoff requires exactly one matching Track')
        handoff = dict(sha256=sha(args.handoff), track=matches[0])
    stems = []
    for item in args.stem:
        if not args.confirm_stem_alignment or '=' not in item:
            parser.error('stem requires role=path and explicit alignment confirmation')
        role, filename = item.split('=', 1)
        path = Path(filename)
        if role not in ('piano','strings','bass','drums','vocal') or role in [x['role'] for x in stems]:
            parser.error('stem role invalid/duplicate')
        stem_info = wav_info(path)
        if (stem_info['frames'],stem_info['sampleRate']) != (info['frames'],info['sampleRate']):
            parser.error('stems must have identical start/frames/rate; no implicit resampling')
        stems.append(dict(role=role,path=str(path.resolve()),sha256=sha(path),input=stem_info))
    identity = dict(projectId=args.project, trackId=args.track, audioVersion=args.version, source=args.source, role=args.role, kind=args.kind,
                    sourceWavSha256=sha(args.wav), engineSha256=sha(args.engine), input=info, instruction=args.instruction,
                    targetLufs=args.target_lufs, ceilingDbTP=args.ceiling_dbtp, pipelineVersion=VERSION, pipelineSha256=sha(Path(__file__)), handoff=handoff, stems=stems)
    folder = args.output
    if not args.resume:
        folder.mkdir(parents=False, exist_ok=False)
    lock = (folder / '.processing.lock').open('a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    if args.resume:
        manifest = json.loads((folder / 'manifest.json').read_text())
        if manifest['identity'] != identity:
            raise ValueError('resume identity/settings/engine changed')
        for name, digest in manifest['artifacts'].items():
            if sha(folder / name) != digest:
                raise ValueError('resume artifact damaged: ' + name)
    else:
        manifest = dict(format=VERSION, identity=identity, status='incomplete', complete=False, adopted=None, history=[], artifacts={}, stages={},
                        hostTrackAutomaticallyVerified=False, modelInference=False, maskingMeasured=False,
                        processingOrder='existing RBJ EQ -> existing linked compressor -> gain -> 5ms linked sample-lookahead / 100ms release -> verified global TP attenuation',
                        truePeakMethod='4x Annex2 FIR estimate; not standards certification; independent reference tolerance in tests',
                        realtimeAuChanged=False, logicProjectBackupIncluded=False)
    state = folder / 'manifest.json'
    manifest.update(status='running', complete=False)
    atomic_json(state, manifest)
    child = None
    def interrupted(sig, frame):
        if child is not None:
            child.terminate()
            child.wait()
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    started = time.monotonic()
    before_usage = resource.getrusage(resource.RUSAGE_SELF)
    before_children = resource.getrusage(resource.RUSAGE_CHILDREN)
    def checkpoint():
        atomic_json(state, manifest)
    def artifact(path):
        manifest['artifacts'][path.name] = sha(path)
    def engine(stage, *parameters):
        nonlocal child
        if stage in manifest['stages']:
            return manifest['stages'][stage]
        child = subprocess.Popen([str(args.engine.resolve()), *map(str, parameters)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = child.communicate()
        code = child.returncode
        child = None
        if code:
            raise ValueError('engine ' + stage + ': ' + stderr.strip())
        result = json.loads(stdout)
        manifest['stages'][stage] = result
        return result
    def measure_wave(stage, wav):
        raw = folder / 'verify.f32.partial'
        raw.unlink(missing_ok=True)
        decode(wav, wav_info(wav), raw)
        result = engine(stage, 'meter', raw, rate)['measurement']
        raw.unlink()
        return result
    try:
        source = folder / 'source.f32'
        rate = info['sampleRate']
        if source.name not in manifest['artifacts']:
            source.unlink(missing_ok=True)
            decode(args.wav, info, source)
            if sha(args.wav) != identity['sourceWavSha256']:
                raise ValueError('source changed during decode')
            artifact(source)
            checkpoint()
        if stems and 'stemRelationships' not in manifest:
            stem_rows = []
            for stem in stems:
                path = Path(stem['path'])
                raw_stem = folder / (stem['role']+'-stem.f32.partial')
                raw_stem.unlink(missing_ok=True)
                decode(path, stem['input'], raw_stem)
                measured = engine('stem-'+stem['role'], 'meter', raw_stem, rate)['measurement']
                raw_stem.unlink()
                if sha(path) != stem['sha256']:
                    raise ValueError('stem changed during analysis')
                stem_rows.append(dict(role=stem['role'],measurement=measured))
            relationships = []
            for i, left in enumerate(stem_rows):
                for right in stem_rows[i+1:]:
                    l,r = left['measurement'],right['measurement']
                    relationships.append(dict(left=left['role'],right=right['role'],rmsDifferenceDb=l['rmsDbFS']-r['rmsDbFS'],
                                              coarseBandOverlap=sum(min(x,y) for x,y in zip(l['bands'],r['bands'])),
                                              perceptualMaskingEstablished=False))
            manifest['stemRelationships'] = dict(stems=stem_rows,pairs=relationships,alignmentUserConfirmed=True,
                                                  limitations='coarse full-song band/level relationships; no time-local or psychoacoustic masking inference')
            checkpoint()
        plan = engine('plan' , 'plan', source, rate, args.instruction, args.role, args.kind)
        manifest['before'] = plan['input']
        checkpoint()
        rows = manifest.setdefault('renders', [])
        # Resume completed candidate stages; never treat interrupted render as complete.
        for k, label in enumerate(['original', 'A', 'B', 'C']):
            if any(row['label'] == label for row in rows):
                continue
            if label == 'original':
                raw = source
                values, processing = [0, 0, 0, 1], None
                report = plan['input']
                final_gain, correction = 0, 0
                limiter_gain = 1
            else:
                choice = plan['choices'][k - 1]
                values, processing = choice['values'], choice['processing']
                trial = folder / (label + '-trial.f32')
                # A pending subprocess may have left a partial file; no reuse without stage+hash.
                stage = label + '-trial'
                if stage not in manifest['stages']:
                    trial.unlink(missing_ok=True)
                preliminary = engine(stage, 'process', source, rate, trial, 0, args.ceiling_dbtp - .5, *values, *processing)['measurement']
                artifact(trial)
                checkpoint()
                desired = args.target_lufs - (3 - k)
                final_gain = min(12., max(-24., desired - preliminary['integratedLufs'])) if args.kind == 'stereo-out' else 0
                raw = folder / (label + '.f32')
                stage = label + '-render'
                if stage not in manifest['stages']:
                    raw.unlink(missing_ok=True)
                rendered = engine(stage, 'process', source, rate, raw, final_gain, args.ceiling_dbtp - .5, *values, *processing)
                artifact(raw)
                checkpoint()
                report = rendered['measurement']
                limiter_gain = rendered['minimumLimiterGain']
                correction = min(0., args.ceiling_dbtp - .1 - report['truePeakEstimateDbTP'])
            output = folder / (label + '.wav')
            wave_from_raw(raw, output, rate, 10 ** (correction / 20))
            artifact(output)
            verified = measure_wave(label + '-wav-verified', output)
            if verified['frames'] != info['frames'] or verified['sampleRate'] != rate:
                raise ValueError('WAV identity/length mismatch')
            if k and (verified['truePeakEstimateDbTP'] > args.ceiling_dbtp + .001 or verified['clippedSamples']):
                raise ValueError('post-WAV ceiling/clip verification failed')
            rows.append(dict(label=label, values=values, processing=processing, finalGainDb=final_gain,
                             postTruePeakAttenuationDb=correction, minimumLimiterGain=limiter_gain, measurement=verified,
                             requestedLufs=(args.target_lufs - (3-k)) if k and args.kind == 'stereo-out' else None,
                             targetDifferenceLu=(verified['integratedLufs']-(args.target_lufs-(3-k))) if k and args.kind == 'stereo-out' else None,
                             reason='full-song bands/crest -> existing measured proposal; A conservative/B balanced/C stronger. Loudness shortfall can reflect gain bounds, dynamics and peak ceiling; no quality score.'))
            checkpoint()
        quietest = min(row['measurement']['integratedLufs'] for row in rows)
        for row in rows:
            label = row['label']
            matched = folder / (label + '-lufs-matched.wav')
            if matched.name in manifest['artifacts']:
                continue
            raw = folder / 'match.f32.partial'
            raw.unlink(missing_ok=True)
            decode(folder / (label + '.wav'), wav_info(folder / (label + '.wav')), raw)
            matching = min(0., quietest - row['measurement']['integratedLufs'])
            wave_from_raw(raw, matched, rate, 10 ** (matching / 20))
            raw.unlink()
            artifact(matched)
            row['matchingGainDb'] = matching
            row['matchedMeasurement'] = measure_wave(label + '-matched-verified', matched)
            if abs(row['matchedMeasurement']['integratedLufs'] - quietest) > .01:
                raise ValueError('loudness-matching verification failed')
            checkpoint()
        if sha(args.wav) != identity['sourceWavSha256']:
            raise ValueError('source changed during processing')
        usage, children = resource.getrusage(resource.RUSAGE_SELF), resource.getrusage(resource.RUSAGE_CHILDREN)
        manifest['resources'] = dict(userCpuSecondsThisRun=usage.ru_utime-before_usage.ru_utime+children.ru_utime-before_children.ru_utime,
                                     systemCpuSecondsThisRun=usage.ru_stime-before_usage.ru_stime+children.ru_stime-before_children.ru_stime,
                                     peakRssBytes=max(usage.ru_maxrss,children.ru_maxrss)*(1 if platform.system()=='Darwin' else 1024),
                                     memoryScope='maximum individual parent/child process RSS, not aggregate concurrent RSS')
        manifest.update(status='complete' , complete=True, elapsedSecondsThisRun=time.monotonic()-started,
                        adoptionRequiresExplicitApproval=True, offlineLimiterNotLiveAu=True)
        checkpoint()
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
    except BaseException as error:
        manifest.update(status='cancelled' if isinstance(error, KeyboardInterrupt) else 'failed', complete=False, error=str(error))
        checkpoint()
        raise

if __name__ == '__main__':
    main()
