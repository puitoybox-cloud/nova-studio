#!/usr/bin/env python3
"""AU control-queue bridge. Local explicit files only; no downloads or shell."""
import argparse
import fcntl
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('whole', ROOT / 'whole-song.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)

def load(path):
    if path.stat().st_size > 4 * 1024 * 1024:
        raise ValueError('JSON exceeds 4 MiB')
    return json.loads(path.read_text())

def validate(q):
    if q.get('format') != 'nova-au-whole-request-v1':
        raise ValueError('unsupported bridge request')
    for key in ('projectId', 'trackId', 'instanceId', 'audioVersion', 'settingsToken', 'inputSource'):
        if not isinstance(q.get(key), str) or not q[key].strip() or len(q[key]) > 1024:
            raise ValueError('explicit binding required: ' + key)
    if q.get('kind') not in ('track', 'bus', 'stereo-out') or q.get('role') not in ('piano', 'strings', 'bass', 'drums', 'vocal', 'unspecified'):
        raise ValueError('explicit kind/role required')
    if q.get('confirmed') is not True:
        raise ValueError('Logic source/Track confirmation required')
    for key in ('sourceWav', 'engine', 'ffmpeg', 'output'):
        if not isinstance(q.get(key), str) or not Path(q[key]).is_absolute():
            raise ValueError('absolute path required: ' + key)
    for key in ('sourceWav', 'engine', 'ffmpeg'):
        if w.sha(Path(q[key])) != q.get(key + 'Sha256'):
            raise ValueError('file changed/missing: ' + key)
    if q.get('pipelineSha256') != w.sha(ROOT / 'whole-song.py'):
        raise ValueError('pipeline changed')
    for key in ('targetLufs', 'ceilingDbTP'):
        if not isinstance(q.get(key), (int, float)) or not math.isfinite(q[key]):
            raise ValueError('finite target required')
    if not -36 <= q['targetLufs'] <= -5 or not -12 <= q['ceilingDbTP'] <= -1:
        raise ValueError('target out of range')
    if not isinstance(q.get('instruction'), str) or len(q['instruction']) > 2048:
        raise ValueError('bounded instruction required')

def verify(q):
    validate(q)
    folder = Path(q['output'])
    with (folder / '.processing.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        m = load(folder / 'manifest.json')
        i = m['identity']
        for a, b in (('projectId','projectId'), ('trackId','trackId'), ('audioVersion','audioVersion'), ('sourceWavSha256','sourceWavSha256'), ('kind','kind'), ('role','role'), ('instruction','instruction'), ('targetLufs','targetLufs'), ('ceilingDbTP','ceilingDbTP'), ('engineSha256','engineSha256'), ('pipelineSha256','pipelineSha256'), ('referenceFfmpegSha256','ffmpegSha256')):
            if i.get(a) != q.get(b):
                raise ValueError('result identity mismatch: ' + a)
        if m.get('format') != 'nova-whole-song-v1' or not m.get('complete') or m.get('status') != 'complete' or not m.get('independentPeakCeilingVerified'):
            raise ValueError('incomplete/unverified result')
        artifacts = m['artifacts']
        if not isinstance(artifacts, dict) or not 5 <= len(artifacts) <= 64:
            raise ValueError('invalid artifact list')
        for name, digest in artifacts.items():
            if not re.fullmatch(r'[A-Za-z0-9_-]+\.(wav|f32)', name) or not re.fullmatch('[a-f0-9]{64}', digest):
                raise ValueError('invalid artifact path/hash')
            path = folder / name
            if path.is_symlink() or path.resolve().parent != folder.resolve() or w.sha(path) != digest:
                raise ValueError('artifact damaged: ' + name)
        if [x['label'] for x in m['renders']] != ['original', 'A', 'B', 'C']:
            raise ValueError('invalid candidates')
        for row in m['renders']:
            if row['label'] + '.wav' not in artifacts or not all(math.isfinite(row['measurement'][k]) for k in ('integratedLufs', 'truePeakEstimateDbTP')):
                raise ValueError('unverified candidate')
        return dict(format='nova-au-whole-reply-v1', request=q, before=m['before'], renders=m['renders'], resources=m.get('initialCompletedRun'), manifestSha256=w.sha(folder / 'manifest.json'), offlineLimiterNotLiveAu=True, modelInference=False)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('operation', choices=['run', 'resume', 'verify', 'adopt', 'undo'])
    p.add_argument('request', type=Path)
    p.add_argument('--choice', choices=['A', 'B', 'C'])
    p.add_argument('--approve', action='store_true')
    a = p.parse_args()
    q = load(a.request)
    validate(q)
    if a.operation in ('run', 'resume'):
        sys.argv = [str(ROOT / 'whole-song.py'), q['sourceWav'], '--engine', q['engine'], '--reference-ffmpeg', q['ffmpeg'], '--output', q['output'], '--project', q['projectId'], '--track', q['trackId'], '--version', q['audioVersion'], '--source', 'logic-render', '--kind', q['kind'], '--role', q['role'], '--instruction', q['instruction'], '--target-lufs', str(q['targetLufs']), '--ceiling-dbtp', str(q['ceilingDbTP']), '--confirm-source']
        if a.operation == 'resume':
            sys.argv.append('--resume')
        # Retain diagnostic output on disk, never fill an unread subprocess pipe.
        with (a.request.parent / 'processing.log').open('w') as log:
            from contextlib import redirect_stdout
            with redirect_stdout(log):
                w.main()
    result = verify(q)
    if a.operation in ('adopt', 'undo'):
        if not a.approve or (a.operation == 'adopt' and not a.choice):
            p.error('explicit choice/approval required')
        import subprocess
        subprocess.run([sys.executable, '-I', str(ROOT / 'select-whole-song.py'), q['output'], '--project', q['projectId'], '--track', q['trackId'], '--version', q['audioVersion'], '--source-wav', q['sourceWav'], '--choice', 'undo' if a.operation == 'undo' else a.choice, '--approve'], stdout=sys.stderr, check=True)
        result = verify(q)
    print(json.dumps(result, ensure_ascii=False))

if __name__ == '__main__':
    main()
