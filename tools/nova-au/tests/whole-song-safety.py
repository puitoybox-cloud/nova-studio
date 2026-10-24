#!/usr/bin/env python3
import argparse, array, importlib.util, json, pathlib, subprocess, sys, tempfile, time
p=argparse.ArgumentParser();p.add_argument('--engine',type=pathlib.Path,required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('whole',root/'whole-song.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
with tempfile.TemporaryDirectory() as tmp:
 d=pathlib.Path(tmp);raw=d/'source.f32';audio=array.array('f', [.1,-.1]*48000)
 if sys.byteorder!='little':audio.byteswap()
 raw.write_bytes(audio.tobytes());wav=d/'input.wav';w.wave_from_raw(raw,wav,48000)
 assert w.wav_info(wav)['frames']==48000
 for broken in (b'RIFF', wav.read_bytes()[:-1]):
  bad=d/'bad.wav';bad.write_bytes(broken)
  try:w.wav_info(bad);raise AssertionError('invalid WAV accepted')
  except ValueError:pass
 for value in (float('nan'),float('inf'),17.):
  raw.write_bytes(array.array('f',[value,0]*48000).tobytes())
  assert subprocess.run([str(a.engine),'meter',str(raw),'48000'],capture_output=True).returncode!=0
 raw.write_bytes(bytes(48000*8));silence=json.loads(subprocess.check_output([str(a.engine),'meter',str(raw),'48000']));assert not silence['measurement']['loudnessValid']
 assert subprocess.run([str(a.engine),'plan',str(raw),'48000','全体の音を自然に整えて','unspecified','stereo-out'],capture_output=True).returncode!=0
 # Pause/cancel after workspace creation; re-open only with same source and options.
 raw.write_bytes(audio.tobytes()*30);w.wave_from_raw(raw,wav,48000)
 out=d/'work';cmd=[sys.executable,str(root/'whole-song.py'),str(wav),'--engine',str(a.engine),'--output',str(out),'--project','p','--track','t','--version','v','--source','development-fixture','--kind','stereo-out','--confirm-source']
 child=subprocess.Popen(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 deadline=time.monotonic()+15
 while not (out/'manifest.json').exists() and time.monotonic()<deadline:time.sleep(.01)
 assert (out/'manifest.json').exists();child.terminate();child.wait(timeout=10)
 state=json.loads((out/'manifest.json').read_text());assert not state['complete'] and state['status']=='cancelled'
 # A changed source must never resume an earlier project/version.
 with wav.open('r+b') as f:f.seek(48);f.write(b'\x00\x00\x00\x00')
 assert subprocess.run(cmd+['--resume'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
 # Inter-sample overshoot estimator and sample-lookahead high-level impulse.
 import math
 samples=array.array('f')
 for i in range(48000):
  value=.95*math.sin(2*math.pi*12000*i/48000+math.pi/4);samples.extend([value,value])
 raw.write_bytes(samples.tobytes());m=json.loads(subprocess.check_output([str(a.engine),'meter',str(raw),'48000']))['measurement']
 assert m['truePeakEstimateDbTP']>m['samplePeakDbFS']+2
print('whole-song corruption/nonfinite/silence/cancel/stale-source/intersample tests PASS')
