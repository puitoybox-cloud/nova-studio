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
import shutil
import re
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
            if info['format'] == 3 and channels == 2:
                # Native streaming meter validates every float before any plan/completion.
                # Preserve exact stereo float bytes without a redundant Python sample loop.
                out.write(raw)
                continue
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
        if scale == 1:
            shutil.copyfileobj(f, out, 1024 * 1024)
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



def retire_intermediates(folder, manifest):
    """Crash-safe retirement; never includes WAVs, adopted exports or history.

    Publish the intent before unlinking, so an interrupted cleanup can be resumed.
    A changed intermediate is retained and reported rather than silently deleted.
    """
    names = ['source.f32'] + [label + suffix for label in ('A', 'B', 'C')
                              for suffix in ('-trial.f32', '.f32')]
    pending = manifest.setdefault('retiredIntermediates', {})
    if not isinstance(pending, dict) or any(name not in names for name in pending):
        raise ValueError('invalid intermediate retirement intent')
    required = {label + suffix for label in ('original', 'A', 'B', 'C')
                for suffix in ('.wav', '-lufs-matched.wav')}
    if not manifest.get('complete') or not required.issubset(manifest['artifacts']):
        raise ValueError('retirement requires all completed comparison WAVs')
    for name in names:
        if name in manifest['artifacts']:
            path = folder / name
            if path.is_symlink() or sha(path) != manifest['artifacts'][name]:
                raise ValueError('intermediate changed before retirement: ' + name)
            pending[name] = dict(sha256=manifest['artifacts'].pop(name), bytes=path.stat().st_size)
    atomic_json(folder / 'manifest.json', manifest)
    for name, record in pending.items():
        path = folder / name
        if path.exists() or path.is_symlink():
            if path.is_symlink() or sha(path) != record['sha256']:
                raise ValueError('retired intermediate changed: ' + name)
            path.unlink()
    manifest['intermediateBytesRetired'] = sum(row['bytes'] for row in pending.values())
    atomic_json(folder / 'manifest.json', manifest)


# Explicit local grammar: every clause must be recognized before any rendering.
# No inferred instrument separation or vocal-intelligibility claim.
LOUDNESS = '全体の音圧を少し上げて'
PUNCH = '音を潰さず迫力を出して'
ALIASES = {'ピアノを自然に': 'ピアノを温かく自然にして',
           '高音を柔らかく': '高音を少し抑えて',
           '低音をすっきり': '低音が強すぎるので調整して',
           '音を潰さずに迫力を出して': PUNCH}
SUPPORTED = {
    'ピアノを自然に聞こえるように', 'ピアノを優しく温かい音にして',
    'ピアノを温かく自然にして', 'ピアノをもっと温かくして', 'ピアノを柔らかくして',
    '高音がきついので柔らかく', 'ストリングスを柔らかくして',
    'ストリングスの高音を柔らかくして', '高音を少し抑えて',
    'ボーカルを前に出して', 'ボーカルをもう少し前に出して',
    '低音をすっきりさせて', 'ベースの低音を整えて',
    'ベースが強すぎるので調整して', '低音が強すぎるので調整して',
    'ドラムをもう少し力強くして', '曲全体を自然にまとめて',
    '全体の音量バランスを整えて', '全体の音を自然に整えて', LOUDNESS, PUNCH}


def instruction_steps(instruction, role, kind):
    if not isinstance(instruction, str) or not 0 < len(instruction) <= 2048:
        raise ValueError('bounded explicit instruction required')
    clauses = re.split(r'、|そして|[;；\n]', instruction)
    if not 1 <= len(clauses) <= 8 or any(not x.strip() for x in clauses):
        raise ValueError('指示は1〜8個の明示した処理にしてください')
    steps = [ALIASES.get(x.strip(), x.strip()) for x in clauses]
    for step in steps:
        if step not in SUPPORTED:
            raise ValueError('未対応の指示です: ' + step)
        if step in (LOUDNESS, PUNCH) and kind != 'stereo-out':
            raise ValueError('全曲音圧・迫力の指示は確認済みStereo Out専用です')
    if len(steps) > 1:
        targets = {name for step in steps for name in ('ピアノ','ボーカル','ベース','ドラム','ストリングス') if name in step}
        expected = {'ピアノ':'piano','ボーカル':'vocal','ベース':'bass','ドラム':'drums','ストリングス':'strings'}
        if len(targets) > 1 or any(expected[t] != role for t in targets):
            raise ValueError('複数指示の対象不一致: 分離済みの同一Trackとroleを確認してください')
        # Warm piano may raise bass while the clean-low instruction cuts it.
        if any('ピアノ' in x for x in steps) and any('低音' in x or 'ベース' in x for x in steps):
            raise ValueError('矛盾する低域指示です: 温かさと低域削減の優先を明示してください')
        if len(set(steps)) != len(steps):
            raise ValueError('重複指示です: 同じ処理の二重適用はしません')
    return steps


def section_profile(document):
    rows = document.get('sections', [])
    if not rows:
        raise ValueError('section measurements missing')
    valid = [r['measurement'] for r in rows if r['measurement']['loudnessValid'] and
             r['measurement']['frames'] >= r['measurement']['sampleRate'] * .4]
    if not valid:
        raise ValueError('no active section; silence/short input cannot master')
    levels = sorted(r['integratedLufs'] for r in valid)
    median = levels[len(levels)//2]
    return dict(activeSections=len(valid), invalidSections=len(rows)-len(valid),
                quietSections=sum(x < median-6 for x in levels),
                loudSections=sum(x > median+6 for x in levels),
                medianLufs=median, loudestLufs=max(levels),
                rangeLu=max(levels)-min(levels),
                # Include even loudness-invalid partial tails in peak protection.
                maximumTruePeakEstimateDbTP=max(r['measurement']['truePeakEstimateDbTP'] for r in rows),
                minimumActiveCrestDb=min(r['crestDb'] for r in valid),
                classification='relative to active median +/-6 LU; invalid is not necessarily digital silence')


def section_review(before, after):
    left, right = before['sections'], after['sections']
    if len(left) != len(right):
        raise ValueError('section alignment mismatch')
    gains, crest = [], []
    for a, b in zip(left, right):
        x, y = a['measurement'], b['measurement']
        if (a['startFrame'], x['frames'], x['sampleRate']) != (b['startFrame'], y['frames'], y['sampleRate']):
            raise ValueError('section alignment mismatch')
        if x['loudnessValid'] and y['loudnessValid']:
            gains.append(y['integratedLufs']-x['integratedLufs'])
            crest.append(y['crestDb']-x['crestDb'])
    if not gains:
        raise ValueError('no aligned active sections')
    variation, loss = max(gains)-min(gains), max(0., -min(crest))
    return dict(sectionGainVariationDb=variation, maximumSectionCrestLossDb=loss,
                excessiveDynamicsChange=variation > 1.5 or loss > 1.5,
                thresholdDb=1.5, perceptualQualityVerified=False,
                note='3-second diagnostic guard, not a listening test or compressor attack measurement')


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
    resources = Path(__file__).resolve().parent
    packaged = resources.name == 'Resources' and resources.parent.name == 'Contents'
    package_ffmpeg = resources / 'Runtime/FFmpeg/bin/ffmpeg'
    parser.add_argument('--reference-ffmpeg', type=Path, default=package_ffmpeg if packaged else shutil.which('ffmpeg'), help='independent installed FFmpeg reference; required, never downloaded')
    parser.add_argument('--handoff', type=Path, help='read-only #501 Logic handoff JSON')
    parser.add_argument('--stem', action='append', default=[], help='explicit aligned role=path.wav; one per role')
    parser.add_argument('--confirm-stem-alignment', action='store_true')
    parser.add_argument('--section-aware', action='store_true', help='opt-in section-based gain/compression guard; legacy render path stays unchanged')
    args = parser.parse_args()
    steps = instruction_steps(args.instruction, args.role, args.kind)
    guarded = args.section_aware or any(x in (LOUDNESS, PUNCH) for x in steps)
    section_engine = args.engine.with_name('nova-section-meter')
    if guarded and (section_engine.is_symlink() or not section_engine.is_file()):
        parser.error('同梱section meterが必要です。外部fallbackはありません')
    if not all(x.strip() for x in (args.project, args.track, args.version)):
        parser.error('explicit project/track/version required')
    if not math.isfinite(args.target_lufs) or not -36 <= args.target_lufs <= -5 or not math.isfinite(args.ceiling_dbtp) or not -12 <= args.ceiling_dbtp <= -1:
        parser.error('target -36..-5 LUFS, ceiling -12..-1 dBTP required')
    if not args.reference_ffmpeg or not Path(args.reference_ffmpeg).is_file():
        parser.error('installed FFmpeg reference required before processing/adoption')
    args.reference_ffmpeg = Path(args.reference_ffmpeg)
    if packaged and args.reference_ffmpeg.resolve() != package_ffmpeg.resolve():
        parser.error('packaged execution requires the bundled FFmpeg; no external fallback')
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
                    targetLufs=args.target_lufs, ceilingDbTP=args.ceiling_dbtp, pipelineVersion=VERSION, pipelineSha256=sha(Path(__file__)), handoff=handoff, stems=stems, referenceFfmpegSha256=sha(args.reference_ffmpeg))
    if guarded:
        identity['sectionPolicy'] = dict(version=1, meterSha256=sha(section_engine))
    folder = args.output
    if folder.is_symlink(): raise ValueError('workspace symlink forbidden')
    # Conservative whole-run disk reservation estimate includes retained original,
    # A/B/C, matched WAVs and intermediate PCM. Source is never an output target.
    reserve = info['frames'] * 128 + 16 * 1024 * 1024
    if not args.resume and shutil.disk_usage(folder.parent).free < reserve:
        raise ValueError('insufficient workspace space; original WAV preserved')
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
    if args.resume and manifest.get('complete') and manifest.get('independentPeakCeilingVerified'):
        retire_intermediates(folder, manifest)
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
        return
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
        if shutil.disk_usage(folder).free < 8 * 1024 * 1024:
            raise ValueError('workspace disk low; original WAV preserved')
        atomic_json(state, manifest)
    def artifact(path):
        manifest['artifacts'][path.name] = sha(path)
    def engine(stage, *parameters, executable=None, cache=True):
        nonlocal child
        if cache and stage in manifest['stages']:
            return manifest['stages'][stage]
        child = subprocess.Popen([str((executable or args.engine).resolve()), *map(str, parameters)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        stdout, stderr = child.communicate()
        code = child.returncode
        child = None
        if code:
            raise ValueError('engine ' + stage + ': ' + stderr.strip())
        result = json.loads(stdout)
        if cache:
            manifest['stages'][stage] = result
        return result
    def independent_reference(stage, wav):
        nonlocal child
        key = stage + '-ffmpeg'
        if key in manifest['stages']:
            return manifest['stages'][key]
        # Per-frame logs are verbose; default info logs contain only a bounded summary.
        log_path = folder / 'reference-meter.log.partial'
        with log_path.open('wb') as log:
            child = subprocess.Popen([str(args.reference_ffmpeg.resolve()), '-hide_banner','-nostats','-i',str(wav),
                                      '-af','ebur128=peak=true:framelog=verbose','-f','null','-'],
                                     stdout=subprocess.DEVNULL, stderr=log)
            code = child.wait()
            child = None
        # WAV metadata must not turn a subprocess log into unbounded RAM usage.
        with log_path.open('rb') as log:
            log.seek(max(0, log_path.stat().st_size - 65536))
            stderr = log.read(65536).decode('utf-8', errors='replace')
        log_path.unlink()
        if code:
            raise ValueError('independent meter failed: ' + stderr[-2000:])
        summary = stderr.split('Summary:')[-1]
        lu = re.search(r'I:\s*([-\d.]+) LUFS', summary)
        tp = re.search(r'Peak:\s*([-\d.]+) dBFS', summary)
        if not lu or not tp:
            raise ValueError('independent meter summary unavailable/nonfinite')
        result = dict(integratedLufs=float(lu[1]),truePeakDbTP=float(tp[1]),
                      displayResolutionDb=.1,peakUpperRoundingBoundDb=.05,
                      method='installed FFmpeg ebur128=peak=true; not certification')
        manifest['stages'][key] = result
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
        # A single legacy instruction retains exact #510 settings/audio/timing path.
        policy_only = all(x in (LOUDNESS, PUNCH) for x in steps)
        if policy_only:
            measured = engine('policy-input', 'meter', source, rate)['measurement']
            if not measured['loudnessValid']:
                raise ValueError('silence/short input cannot produce a plan')
            neutral = [1,180,4000,1000,0,1,0,-18,1,10,150,6,0]
            plan = dict(input=measured, choices=[dict(values=[0,0,0,0], processing=neutral[:]) for _ in range(3)])
        else:
            plans = [engine('plan' if len(steps)==1 else 'plan-'+str(i), 'plan', source, rate, text, args.role, args.kind)
                     for i,text in enumerate(steps) if text not in (LOUDNESS, PUNCH)]
            plan = json.loads(json.dumps(plans[0]))
            for other in plans[1:]:
                for choice, extra in zip(plan['choices'], other['choices']):
                    # Only explicitly requested deltas are accumulated. Gain safety
                    # uses the stricter measured bound; compressor has one shared set.
                    choice['values'][0] = min(choice['values'][0], extra['values'][0])
                    for index in (1,2):
                        choice['values'][index] = max(-6., min(6., choice['values'][index]+extra['values'][index]))
                    if extra['processing'][4]:
                        choice['processing'][3:6] = extra['processing'][3:6]
        if len(steps)>1:
            for choice in plan['choices']:
                eq_bound = sum(abs(choice['values'][i]) for i in (1,2)) + abs(choice['processing'][4]) + choice['processing'][12]
                choice['values'][0] = max(-24., min(choice['values'][0], 20*math.log10(.9)-plan['input']['samplePeakDbFS']-eq_bound))
        source_sections = None
        if guarded:
            source_sections = engine('source-sections', 'sections', source, rate, executable=section_engine, cache=False)
            profile = section_profile(source_sections)
            profile['maximumTruePeakEstimateDbTP'] = max(profile['maximumTruePeakEstimateDbTP'], plan['input']['truePeakEstimateDbTP'])
            manifest['sectionPolicy'] = dict(version=1, source=profile, steps=steps,
                target=dict(trackId=args.track, role=args.role, kind=args.kind),
                parameterOrder='EQ -> linked compressor -> global gain -> offline peak protection',
                noTimeVaryingGain=True, adoptionRequiresExplicitApproval=True)
            # Section crest below 6dB already has little peak/rms contrast. Avoid
            # adding compression; punch/loudness-only intentionally use none.
            if policy_only or PUNCH in steps or profile['minimumActiveCrestDb'] < 6:
                for choice in plan['choices']:
                    choice['processing'][6] = 0
                    choice['processing'][12] = 0
            manifest['sectionPolicy']['compressorDisabled'] = all(x['processing'][6]==0 for x in plan['choices'])
        if len(steps)>1 or guarded:
            manifest['instructionPlan'] = dict(steps=steps, targetTrackId=args.track,
                sameConfirmedInput=True, intermediateRemeasurement=False,
                scope='ordered parameter proposal on one input, not instrument separation or semantic AI',
                approvalRequired=True)

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
                # Identical float32 DSP and loudness/peak metering; trial band FFT is unused.
                # Full spectrum remains enabled for plan, final render and WAV verification.
                preliminary = engine(label + '-trial', 'process-loudness', source, rate, '-', 0,
                                     args.ceiling_dbtp - .5, *values, *processing)['measurement']
                checkpoint()
                desired = args.target_lufs - (3 - k)
                if LOUDNESS in steps:
                    if args.target_lufs <= plan['input']['integratedLufs']:
                        raise ValueError('音圧増加と目標LUFSが矛盾しています。現在より高い目標を明示してください')
                    desired = min(args.target_lufs, plan['input']['integratedLufs'] + (.5,1.,1.5)[k-1])
                final_gain = min(12., max(-24., desired - preliminary['integratedLufs'])) if args.kind == 'stereo-out' else 0
                if guarded:
                    # Bound global boost by the loudest active section and peak
                    # headroom, including conservative EQ gain. Never amplify
                    # silence independently or normalize sections separately.
                    loudness_bound = (args.target_lufs if LOUDNESS in steps else desired) - profile['loudestLufs']
                    eq_bound = sum(abs(values[i]) for i in (1,2)) + abs(processing[4]) + processing[12]
                    peak_bound = args.ceiling_dbtp - .6 - profile['maximumTruePeakEstimateDbTP'] - values[0] - eq_bound
                    if LOUDNESS in steps or PUNCH in steps:
                        loudness_bound = min(loudness_bound, (.5,1.,1.5)[k-1] - values[0])
                    final_gain = max(-24., min(final_gain, loudness_bound, peak_bound)) if args.kind == 'stereo-out' else 0
                    if LOUDNESS in steps and final_gain + values[0] <= 0:
                        raise ValueError('区間音量・ピーク上限のため安全な音圧増加を提案できません。別処理に置換しません')
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
            independent = independent_reference(label + '-wav-verified', output)
            if k and independent['truePeakDbTP'] + .05 > args.ceiling_dbtp:
                correction += args.ceiling_dbtp - .15 - independent['truePeakDbTP']
                wave_from_raw(raw, output, rate, 10 ** (correction / 20))
                artifact(output)
                verified = measure_wave(label + '-reference-corrected', output)
                independent = independent_reference(label + '-reference-corrected', output)
            if abs(verified['integratedLufs'] - independent['integratedLufs']) >= .15:
                raise ValueError('independent LUFS reference discrepancy')
            if k and independent['truePeakDbTP'] + .05 > args.ceiling_dbtp:
                raise ValueError('independent True Peak ceiling verification failed')
            if verified['frames'] != info['frames'] or verified['sampleRate'] != rate:
                raise ValueError('WAV identity/length mismatch')
            if k and (verified['truePeakEstimateDbTP'] > args.ceiling_dbtp + .001 or verified['clippedSamples']):
                raise ValueError('post-WAV ceiling/clip verification failed')
            review = None
            if guarded and k:
                review_raw = folder / 'section-review.f32.partial'
                review_raw.unlink(missing_ok=True)
                decode(output, wav_info(output), review_raw)
                sections = engine(label+'-sections', 'sections', review_raw, rate, executable=section_engine, cache=False)
                review_raw.unlink()
                review = section_review(source_sections, sections)
                if review['excessiveDynamicsChange']:
                    raise ValueError('section dynamics guard rejected candidate '+label+'; original retained')
            rows.append(dict(label=label, values=values, processing=processing, finalGainDb=final_gain,
                             postTruePeakAttenuationDb=correction, minimumLimiterGain=limiter_gain, measurement=verified, independentReference=independent,
                             requestedLufs=desired if k and args.kind == 'stereo-out' else None,
                             targetDifferenceLu=(verified['integratedLufs']-desired) if k and args.kind == 'stereo-out' else None,
                             reason='full-song bands/crest -> existing measured proposal; A conservative/B balanced/C stronger. Loudness shortfall can reflect gain bounds, dynamics and peak ceiling; no quality score.'))
            if review is not None:
                rows[-1]['sectionReview'] = review
                rows[-1]['reason'] = 'Section-bounded global gain; no per-section normalization. See sectionPolicy and measured sectionReview; no quality score.'
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
        if guarded and sha(section_engine) != identity['sectionPolicy']['meterSha256']:
            raise ValueError('section meter changed during processing')
        if sha(args.wav) != identity['sourceWavSha256']:
            raise ValueError('source changed during processing')
        usage, children = resource.getrusage(resource.RUSAGE_SELF), resource.getrusage(resource.RUSAGE_CHILDREN)
        manifest['resources'] = dict(userCpuSecondsThisRun=usage.ru_utime-before_usage.ru_utime+children.ru_utime-before_children.ru_utime,
                                     systemCpuSecondsThisRun=usage.ru_stime-before_usage.ru_stime+children.ru_stime-before_children.ru_stime,
                                     peakRssBytes=max(usage.ru_maxrss,children.ru_maxrss)*(1 if platform.system()=='Darwin' else 1024),
                                     memoryScope='maximum individual parent/child process RSS, not aggregate concurrent RSS')
        manifest.setdefault('initialCompletedRun', dict(wallSeconds=time.monotonic()-started, resources=manifest['resources']))
        manifest.update(status='complete' , complete=True, elapsedSecondsThisRun=time.monotonic()-started,
                        adoptionRequiresExplicitApproval=True, offlineLimiterNotLiveAu=True, independentPeakCeilingVerified=True)
        checkpoint()
        retire_intermediates(folder, manifest)
        print(json.dumps(manifest, ensure_ascii=False, indent=2))
    except BaseException as error:
        if manifest.get('complete'):
            manifest['cleanupError'] = str(error)
            atomic_json(state, manifest)
            raise
        manifest.update(status='cancelled' if isinstance(error, KeyboardInterrupt) else 'failed', complete=False, error=str(error))
        checkpoint()
        raise

if __name__ == '__main__':
    main()
