#!/usr/bin/env python3
"""Explicit offline candidate adoption/Undo; never alters a Logic project or AU."""
import argparse
import importlib.util
from pathlib import Path
import time
import fcntl

spec = importlib.util.spec_from_file_location('whole_song', Path(__file__).with_name('whole-song.py'))
whole = importlib.util.module_from_spec(spec)
spec.loader.exec_module(whole)
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('folder', type=Path)
p.add_argument('--project', required=True)
p.add_argument('--track', required=True)
p.add_argument('--version', required=True)
p.add_argument('--source-wav', required=True, type=Path)
p.add_argument('--choice', choices=['A', 'B', 'C', 'undo'], required=True)
p.add_argument('--approve', action='store_true', required=True)
a = p.parse_args()
import json
lock = (a.folder / '.processing.lock').open('a')
fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
m = json.loads((a.folder / 'manifest.json').read_text())
i = m['identity']
if not m.get('independentPeakCeilingVerified') or not m.get('complete') or m['status'] != 'complete' or (i['projectId'], i['trackId'], i['audioVersion'], i['sourceWavSha256']) != (a.project, a.track, a.version, whole.sha(a.source_wav)):
    p.error('incomplete or mismatched project/track/version/source')
for name, digest in m['artifacts'].items():
    if whole.sha(a.folder / name) != digest:
        p.error('artifact damaged: ' + name)
previous = m.get('adopted')
if a.choice == 'undo':
    active = next((h for h in reversed(m['history']) if h['operation'] == 'adopt' and not h.get('undone')), None)
    if active is None or active['after'] != previous:
        p.error('no matching adoption to undo')
    active['undone'] = True
    chosen = active['before']
else:
    chosen = dict(label=a.choice, sha256=m['artifacts'][a.choice+'.wav'])
m['history'].append(dict(operation='undo' if a.choice == 'undo' else 'adopt', before=previous, after=chosen, approved=True, timestamp=time.time()))
m['adopted'] = chosen
# Final file is a separately written copy; comparison/history/original remain intact.
if chosen:
    import shutil, os
    tmp = a.folder / 'adopted.wav.partial'
    with (a.folder / (chosen['label'] + '.wav')).open('rb') as source, tmp.open('wb') as destination:
        shutil.copyfileobj(source, destination, 1024*1024)
    os.replace(tmp, a.folder / 'adopted.wav')
    if whole.sha(a.folder / 'adopted.wav') != chosen['sha256']:
        p.error('adopted WAV copy mismatch')
# Undo to no adoption preserves the old exported copy and explicitly marks it inactive.
whole.atomic_json(a.folder / 'manifest.json', m)
print(json.dumps(dict(adopted=chosen, historyEntries=len(m['history']), auApplied=False)))
