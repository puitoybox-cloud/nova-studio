#!/usr/bin/env python3
"""Offline aligned Stem -> measured role balance/EQ/dynamics -> ABC mastering.
No network, model inference, host mutation or implicit alignment. Output is a new
workspace; final adoption uses select-whole-song.py with explicit approval.
"""
import argparse
import array
import fcntl
import importlib.util
import json
import math
import os
import signal
from pathlib import Path
import statistics
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('whole', ROOT / 'whole-song.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
ROLES = {'vocal': 0, 'piano': -3, 'strings': -6, 'bass': -4, 'drums': -3}
COMMANDS = {'この曲をきれいに仕上げて', 'この曲を自然に仕上げて', '全体の音を自然に整えて'}
TEXT = {'vocal': 'ボーカルを前に出して', 'piano': 'ピアノを温かく自然にして',
        'strings': 'ストリングスを柔らかくして', 'bass': 'ベースの低音を整えて',
        'drums': 'ドラムをもう少し力強くして'}


child = None


def interrupted(sig, frame):
    if child is not None and child.poll() is None:
        os.killpg(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=5)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
    raise SystemExit(128 + sig)


def execute(args, stdout=subprocess.PIPE):
    global child
    child = subprocess.Popen(list(map(str, args)), stdout=stdout, text=True, start_new_session=True)
    output, _ = child.communicate()
    code = child.returncode
    child = None
    if code:
        raise subprocess.CalledProcessError(code, args)
    return output


def call(*args):
    return json.loads(execute(args))


def balance(rows):
    """Conservative RMS heuristic, not learned/perceptual mix judgement."""
    active = [r for r in rows if r['measurement']['loudnessValid']]
    if not active:
        raise ValueError('all stems silent or too short for valid loudness')
    anchor = statistics.median(r['measurement']['rmsDbFS'] - ROLES[r['role']] for r in active)
    for r in rows:
        r['balanceDb'] = max(-6., min(6., anchor + ROLES[r['role']] - r['measurement']['rmsDbFS'])) if r in active else 0.
    return rows


def main():
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('request', type=Path, help='JSON: stems [{id,role,path}], projectId, audioVersion, sourceKind, alignmentConfirmed, instruction')
    p.add_argument('--engine', type=Path, required=True)
    p.add_argument('--ffmpeg', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--resume', action='store_true')
    a = p.parse_args()
    if a.request.stat().st_size > 1024*1024:
        p.error('request exceeds 1 MiB')
    packaged = ROOT.name == 'Resources' and ROOT.parent.name == 'Contents'
    if packaged:
        if a.engine.resolve() != (ROOT/'../MacOS/nova-whole-song').resolve() or a.ffmpeg.resolve() != (ROOT/'Runtime/FFmpeg/bin/ffmpeg').resolve():
            p.error('contained execution requires bundled engine and FFmpeg')
        if Path(sys.executable).resolve() != (ROOT/'Runtime/Python/bin/python3.12').resolve():
            p.error('contained execution requires bundled Python')
        inventory = json.loads((ROOT/'whole-song-runtime.json').read_text())
        for name, digest in inventory.items():
            if w.sha(ROOT/name) != digest:
                p.error('contained script/engine changed')
    q = json.loads(a.request.read_text())
    if q.get('instruction') not in COMMANDS or q.get('alignmentConfirmed') is not True:
        p.error('unsupported instruction or unconfirmed identical start/alignment')
    if q.get('sourceKind') not in ('logic-render', 'recorded-audio', 'development-fixture'):
        p.error('explicit sourceKind required')
    if any(not isinstance(q.get(k), str) or not q[k].strip() for k in ('projectId', 'audioVersion')):
        p.error('projectId/audioVersion required')
    stems = q.get('stems')
    if not isinstance(stems, list) or not 2 <= len(stems) <= 16:
        p.error('2..16 explicit stems required')
    rows, ids = [], set()
    for s in stems:
        if s.get('role') not in ROLES or not isinstance(s.get('id'), str) or not s['id'].strip() or s['id'] in ids:
            p.error('unique explicit stem id and supported role required')
        ids.add(s['id'])
        path = Path(s['path']).resolve(strict=True)
        info = w.wav_info(path)
        if rows and any(info[k] != rows[0]['input'][k] for k in ('sampleRate', 'frames')):
            p.error('stems must have identical frames/rate and user-confirmed alignment')
        rows.append(dict(id=s['id'], role=s['role'], path=str(path), sha256=w.sha(path), input=info))
    out = a.output.resolve()
    # Never put working outputs beside/inside source paths under attacker-controlled names.
    if a.output.is_symlink() or any(Path(r['path']).is_relative_to(out) for r in rows):
        p.error('output must be separate from sources')
    identity = dict(request=q, stems=json.loads(json.dumps(rows)), engine=w.sha(a.engine), ffmpeg=w.sha(a.ffmpeg),
                    pipeline=w.sha(Path(__file__)), mastering=w.sha(ROOT / 'whole-song.py'))
    import shutil
    reserve = rows[0]['input']['frames'] * (len(rows)*16 + 160) + 16*1024*1024
    if not a.resume and shutil.disk_usage(out.parent).free < reserve:
        p.error('insufficient disk space; original stems preserved')
    if not a.resume:
        out.mkdir(exist_ok=False)
    with (out / '.auto-finish.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if any(x.is_symlink() for x in out.iterdir()):
            raise ValueError('workspace symlink forbidden')
        state = out / 'auto-finish.json'
        if a.resume:
            m = json.loads(state.read_text())
            if m['identity'] != identity:
                raise ValueError('resume inputs/runtime/settings changed')
            for name, digest in m['artifacts'].items():
                file = out / name
                if file.is_symlink() or w.sha(file) != digest:
                    raise ValueError('resume artifact damaged: ' + name)
        else:
            m = dict(format='nova-auto-finish-v1', identity=identity, artifacts={}, complete=False,
                     modelInference=False, hostApplied=False, alignmentUserConfirmed=True,
                     limitations='RMS role heuristic and coarse full-song band overlap; no perceptual masking or professional quality certification')
            w.atomic_json(state, m)
        def save(path):
            m['artifacts'][path.name] = w.sha(path)
            w.atomic_json(state, m)
        rate = rows[0]['input']['sampleRate']
        processed, originals = [], []
        for n, r in enumerate(rows):
            raw = out / ('stem-%d.f32' % n)
            if raw.name not in m['artifacts']:
                raw.unlink(missing_ok=True)
                w.decode(Path(r['path']), r['input'], raw)
                if w.sha(Path(r['path'])) != r['sha256']:
                    raise ValueError('source changed during decode')
                save(raw)
            originals.append(raw)
            r['measurement'] = call(a.engine, 'meter', raw, rate)['measurement']
        balance(rows)
        pairs = []
        for n, r in enumerate(rows):
            for other in rows[n+1:]:
                pairs.append(dict(left=r['id'], right=other['id'], coarseBandOverlap=sum(min(x,y) for x,y in zip(r['measurement']['bands'], other['measurement']['bands'])), perceptualMaskingEstablished=False))
            raw = originals[n]
            dest = out / ('processed-%d.f32' % n)
            if r['measurement']['loudnessValid']:
                plan = call(a.engine, 'plan', raw, rate, TEXT[r['role']], r['role'], 'track')['choices'][1]
                w.validate_choices([plan]*3)
            else:
                plan = dict(values=[0,0,0,0], processing=[1,180,4000,1000,0,1,0,-18,1,10,150,6,0])
            # Balance is separate from the measured EQ/comp proposal. Avoid double gain.
            plan['values'][0] = 0
            if r['measurement']['crestDb'] < 6:
                plan['processing'][6] = 0
            r['dsp'] = plan
            if dest.name not in m['artifacts']:
                dest.unlink(missing_ok=True)
                r['after'] = call(a.engine, 'process', raw, rate, dest, r['balanceDb'], -3, *plan['values'], *plan['processing'])['measurement']
                save(dest)
            else:
                r['after'] = call(a.engine, 'meter', dest, rate)['measurement']
            processed.append(dest)
        m.update(stems=rows, relationships=pairs)
        # Sum with a shared static gain bound from individual measured peaks. No
        # per-sample normalisation, no pumping, and no channel phase/time changes.
        for name, paths, peaks in [('dry-mix.wav', originals, [r['measurement']['samplePeakDbFS'] for r in rows]),
                                   ('mix.wav', processed, [r['after']['samplePeakDbFS'] for r in rows])]:
            dest = out / name
            bound = sum(10**(x/20) for x in peaks)
            scale = min(1., 10**(-3/20)/max(bound, 1e-12))
            m[name] = dict(staticHeadroomGainDb=20*math.log10(scale))
            if name not in m['artifacts']:
                raw = out / (name + '.f32.partial')
                with raw.open('wb') as f:
                    handles = [x.open('rb') for x in paths]
                    try:
                        while True:
                            chunks = []
                            for h in handles:
                                v = array.array('f'); v.frombytes(h.read(w.CHUNK*8))
                                if sys.byteorder != 'little': v.byteswap()
                                chunks.append(v)
                            if not chunks[0]: break
                            if len({len(v) for v in chunks}) != 1: raise ValueError('stem length changed')
                            v = array.array('f', (sum(values)*scale for values in zip(*chunks)))
                            if sys.byteorder != 'little': v.byteswap()
                            f.write(v.tobytes())
                    finally:
                        for h in handles: h.close()
                w.wave_from_raw(raw, dest, rate)
                raw.unlink()
                save(dest)
        w.atomic_json(state, m)
        final = out / 'mastering'
        cmd = [sys.executable, '-I', '-B', str(ROOT/'whole-song.py'), str(out/'mix.wav'), '--engine', str(a.engine.resolve()), '--reference-ffmpeg', str(a.ffmpeg.resolve()), '--output', str(final), '--project', q['projectId'], '--track', 'auto-finish-stereo', '--version', q['audioVersion'], '--source', q['sourceKind'], '--kind', 'stereo-out', '--instruction', '全体の音を自然に整えて', '--confirm-source', '--section-aware']
        if final.exists(): cmd.append('--resume')
        with (out/'mastering.log').open('w') as log:
            execute(cmd, stdout=log)
        if any(w.sha(Path(r['path'])) != r['sha256'] for r in rows):
            raise ValueError('input changed during rendering')
        result = json.loads((final/'manifest.json').read_text())
        m.update(complete=result['complete'], renders=result['renders'], adoptionRequired=True,
                 masteringManifestSha256=w.sha(final/'manifest.json'))
        w.atomic_json(state, m)
        print(json.dumps(m, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
