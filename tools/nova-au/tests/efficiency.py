#!/usr/bin/env python3
"""Same-machine sequential baseline/current runs; exact WAV/measurement parity."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import resource
import time
import subprocess
import sys
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--baseline-scripts',type=Path,required=True)
p.add_argument('--baseline-engine',type=Path,required=True)
p.add_argument('--scripts',type=Path,required=True)
p.add_argument('--engine',type=Path,required=True)
p.add_argument('--matrix',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args();a.output.mkdir(exist_ok=False)
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
    return h.hexdigest()
spec=importlib.util.spec_from_file_location('whole',a.scripts/'whole-song.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
for rate in (44100,48000,96000):
    source=a.matrix/f'fixture-{rate}-30.wav'; raw=a.output/f'meter-{rate}.f32'
    w.decode(source,w.wav_info(source),raw)
    measurements=[json.loads(subprocess.check_output([str(engine.resolve()),'meter',str(raw),str(rate)]))
                  for engine in (a.baseline_engine,a.engine)]
    assert measurements[0]==measurements[1], rate
    raw.unlink()
rows=[]
for seconds in (30,240,480):
    source=a.matrix/f'fixture-48000-{seconds}.wav'
    before=sha(source)
    results=[]
    for label,scripts,engine in [('before',a.baseline_scripts,a.baseline_engine),('after',a.scripts,a.engine)]:
        out=a.output/f'{label}-{seconds}'
        cmd=[sys.executable,'-I','-B',str(scripts/'whole-song.py'),str(source),'--engine',str(engine.resolve()),'--output',str(out),'--project','efficiency','--track','stereo','--version','v1','--source','development-fixture','--kind','stereo-out','--confirm-source']
        started=time.monotonic(); usage=resource.getrusage(resource.RUSAGE_CHILDREN)
        subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL)
        complete_wall=time.monotonic()-started
        finished=resource.getrusage(resource.RUSAGE_CHILDREN)
        complete_cpu=finished.ru_utime+finished.ru_stime-usage.ru_utime-usage.ru_stime
        m=json.loads((out/'manifest.json').read_text())
        assert m['complete'] and sha(source)==before
        files={name:sha(out/name) for name in m['artifacts'] if name.endswith('.wav')}
        assert len(files)==8
        results.append(dict(completeSubprocessWallSeconds=complete_wall,completeSubprocessCpuSeconds=complete_cpu,timingScope='complete subprocess includes startup, identity hashing, processing and cleanup; wallSeconds/resources below are pipeline-reported stages',wallSeconds=m['initialCompletedRun']['wallSeconds'],resources=m['resources'],artifactBytes=sum((out/name).stat().st_size for name in m['artifacts']),wavHashes=files,renders=m['renders']))
    left,right=results
    assert left['wavHashes']==right['wavHashes']
    assert left['renders']==right['renders']
    rows.append(dict(meterParityRates=[44100,48000,96000],seconds=seconds,sampleRate=48000,before=left,after=right,exactWavAndMeasurementParity=True,diskReductionFraction=1-right['artifactBytes']/left['artifactBytes'],wallReductionFraction=1-right['wallSeconds']/left['wallSeconds']))
    (a.output/'efficiency.json').write_text(json.dumps(rows,indent=2))
print(json.dumps(rows,indent=2))
