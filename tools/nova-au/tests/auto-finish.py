#!/usr/bin/env python3
"""Encoded development audio integration; never a professional listening verdict."""
import argparse
import array
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import time

p = argparse.ArgumentParser()
p.add_argument('--engine', required=True, type=Path)
p.add_argument('--output', required=True, type=Path)
p.add_argument('--scripts', type=Path)
p.add_argument('--ffmpeg', default=shutil.which('ffmpeg'))
a = p.parse_args(); a.output.mkdir(exist_ok=False)
root = a.scripts.resolve() if a.scripts else Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('whole', root/'whole-song.py')
w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
rate = 48000
stems = []
for n, (role, hz, amp) in enumerate([('vocal', 440, .035), ('piano', 660, .25), ('bass', 90, .10)]):
    raw = a.output/f'{role}.f32'
    with raw.open('wb') as f:
        for second in range(8):
            pcm = array.array('f')
            for i in range(rate):
                t = second+i/rate
                env = .25 + .75*math.sin(math.pi*t/2)**2
                sample = amp*env*(math.sin(2*math.pi*hz*t)+.25*math.sin(2*math.pi*hz*2*t))
                pcm.extend([sample, sample*.8])
            if sys.byteorder != 'little': pcm.byteswap()
            f.write(pcm.tobytes())
    wav = raw.with_suffix('.wav'); w.wave_from_raw(raw,wav,rate)
    stems.append(dict(id=str(n),role=role,path=str(wav.resolve())))
q = dict(stems=stems,projectId='test',audioVersion='v1',sourceKind='development-fixture',alignmentConfirmed=True,instruction='この曲をきれいに仕上げて')
request = a.output/'request.json'; request.write_text(json.dumps(q,ensure_ascii=False))
output = a.output/'finish'
cmd = [sys.executable, '-I', '-B', str(root/'auto-finish.py'),str(request),'--engine',str(a.engine.resolve()),'--ffmpeg',a.ffmpeg,'--output',str(output)]
def run(args, success=True):
    r = subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    assert (r.returncode==0)==success, r.stderr[-4000:]
    return r
before = [w.sha(Path(s['path'])) for s in stems]
run(cmd)
m=json.loads((output/'auto-finish.json').read_text())
assert m['complete'] and not m['modelInference'] and not m['hostApplied']
assert m['progress'] == dict(stage='complete', completed=1, total=1)
assert m['stems'][0]['balanceDb'] > 0 and m['stems'][1]['balanceDb'] < 0
assert all(abs(r['balanceDb']) <= 6 for r in m['stems'])
assert all(r['after']['clippedSamples']==0 for r in m['stems'])
assert len({w.sha(output/'mastering'/f'{x}.wav') for x in 'ABC'})==3
for r in m['renders']:
    if r['label'] != 'original':
        assert r['measurement']['truePeakEstimateDbTP'] <= -1 and r['measurement']['clippedSamples']==0
assert max(r['matchedMeasurement']['integratedLufs'] for r in m['renders'])-min(r['matchedMeasurement']['integratedLufs'] for r in m['renders']) < .02
hashes = {x.name:w.sha(x) for x in (output/'mastering').glob('*.wav')}
run(cmd+['--resume'])
assert hashes == {x.name:w.sha(x) for x in (output/'mastering').glob('*.wav')}
select=[sys.executable,'-I','-B',str(root/'select-whole-song.py'),str(output/'mastering'),'--project','test','--track','auto-finish-stereo','--version','v1','--source-wav',str(output/'mix.wav'),'--choice','B']
run(select,False);run(select+['--approve'])
assert w.sha(output/'mastering'/'adopted.wav')==w.sha(output/'mastering'/'B.wav')
select[-1]='undo';run(select+['--approve'])
assert json.loads((output/'mastering'/'manifest.json').read_text())['adopted'] is None
assert before == [w.sha(Path(s['path'])) for s in stems]
# Interrupt an actual run after workspace creation and resume it to completion.
interrupted_output = a.output/'interrupted'
interrupted_cmd = cmd[:-1]+[str(interrupted_output)]
with (a.output/'interrupted.log').open('w') as log:
    proc = subprocess.Popen(interrupted_cmd, stdout=log, stderr=log)
    deadline = time.monotonic()+20
    while not (interrupted_output/'auto-finish.json').exists() and time.monotonic()<deadline:
        time.sleep(.01)
    assert proc.poll() is None
    proc.terminate(); proc.wait(timeout=10)
run(interrupted_cmd+['--resume'])
assert json.loads((interrupted_output/'auto-finish.json').read_text())['complete']
# Incomplete mastering can resume; changed input cannot. Unsupported instructions
# and unconfirmed alignment must fail before creating a workspace.
for key,value in [('instruction','市販プラグインを操作して'),('alignmentConfirmed',False)]:
    bad=dict(q);bad[key]=value;request.write_text(json.dumps(bad))
    run(cmd,False)
request.write_text(json.dumps(q))
with (output/'processed-0.f32').open('r+b') as f: f.write(b'bad!')
run(cmd+['--resume'],False)
print(json.dumps(dict(success=True,developmentFixture=True,stems=[dict(role=r['role'],balanceDb=r['balanceDb'],dsp=r['dsp'],before=r['measurement'],after=r['after']) for r in m['stems']],renders=m['renders']),indent=2))
