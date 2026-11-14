"""Real owned instrument samples plus a synthetic vowel-like signal, never a human vocal claim."""
import argparse
import array
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import subprocess
import sys
import wave

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--engine',type=Path,required=True)
p.add_argument('--scripts',type=Path,required=True)
p.add_argument('--ffmpeg',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args();a.output.mkdir(exist_ok=False)
assets=Path(__file__).resolve().parents[3]/'assets/music-acoustic-v1'
samples=[]
for name in ('piano-60','bass-24','strings-60','drums-36','drums-38','drums-42'):
    with wave.open(str(assets/(name+'.wav'))) as w:
        assert w.getnchannels()==1 and w.getsampwidth()==2 and w.getframerate()==24000
        values=array.array('h',w.readframes(w.getnframes()))
        if sys.byteorder!='little':values.byteswap()
        samples.append(values)
rate=48000;block=array.array('f')
# Repeated four-second phrase with different sample onsets and stereo positions.
for n in range(rate*4):
    t=n/rate;l=r=0.
    for i,(clip,period,offset,gain,pan) in enumerate(zip(samples,(2,2,4,1,1,.5),(0,0,0,0,.5,0),(.22,.25,.16,.35,.22,.12),(-.3,0,.4,0,.2,-.2))):
        local=(t-offset)%period;index=int(local*24000)
        value=clip[index]/32768*gain if index<len(clip) else 0
        l+=value*(1-pan);r+=value*(1+pan)
    # Harmonic/formant-weighted synthetic vowel-like part with gated syllables.
    env=max(0,math.sin(math.pi*(t%1)))**2*.045
    vocal=env*sum(math.sin(2*math.pi*220*k*t)*math.exp(-((220*k-900)/700)**2)/k for k in range(1,16))
    block.extend((l+vocal,r+vocal*.9))
if sys.byteorder!='little':block.byteswap()
raw=a.output/'multitrack.f32'
with raw.open('wb') as f:
    for _ in range(7):f.write(block.tobytes())
    f.write(block[:rate*2*2].tobytes())
spec=importlib.util.spec_from_file_location('whole',a.scripts/'whole-song.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
wav=a.output/'instruments-and-synthetic-vowel.wav';w.wave_from_raw(raw,wav,rate)
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
before=sha(wav);out=a.output/'comparison'
subprocess.run([sys.executable,'-I','-B',str(a.scripts/'whole-song.py'),str(wav),'--engine',str(a.engine),'--output',str(out),'--project','multitrack-fixture','--track','stereo','--version','v1','--source','development-fixture','--kind','stereo-out','--confirm-source','--reference-ffmpeg',str(a.ffmpeg)],check=True,stdout=subprocess.DEVNULL)
m=json.loads((out/'manifest.json').read_text());assert m['complete'] and m['adopted'] is None
assert len(m['renders'])==4 and sha(wav)==before
for row in m['renders']:
    assert row['measurement']['clippedSamples']==0
assert len({sha(out/(name+'.wav')) for name in ('original','A','B','C')})==4
result=dict(status='PASS',seconds=30,sampleRate=rate,instrumentSources=[x.name for x in assets.glob('*.wav') if x.stem in ('piano-60','bass-24','strings-60','drums-36','drums-38','drums-42')],vocalSource='synthetic harmonic/formant-weighted vowel-like signal; not recorded vocals',sourceSha256=before,sourcePreserved=True,renders=m['renders'],resources=m['initialCompletedRun'])
(a.output/'result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result,indent=2))
