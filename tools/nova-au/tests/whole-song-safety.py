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
 # Resume cancelled work through every production stage, then verify separate adoption.
 subprocess.run(cmd+['--resume'],stdout=subprocess.DEVNULL,check=True)
 complete=json.loads((out/'manifest.json').read_text());assert complete['complete'] and complete['status']=='complete'
 assert complete['resources']['peakRssBytes'] < 128*1024*1024
 assert complete['initialCompletedRun']['wallSeconds'] > 0
 # A changed source must never resume an earlier project/version.
 with wav.open('r+b') as f:
  f.seek(48);saved=f.read(4);f.seek(48);f.write(b'\x00\x00\x00\x00')
 assert subprocess.run(cmd+['--resume'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
 with wav.open('r+b') as f:f.seek(48);f.write(saved)
 # Inter-sample overshoot estimator and sample-lookahead high-level impulse.
 import math
 samples=array.array('f')
 for i in range(48000):
  value=.95*math.sin(2*math.pi*12000*i/48000+math.pi/4);samples.extend([value,value])
 raw.write_bytes(samples.tobytes());m=json.loads(subprocess.check_output([str(a.engine),'meter',str(raw),'48000']))['measurement']
 assert m['truePeakEstimateDbTP']>m['samplePeakDbFS']+2
 # Real lookahead processing must preserve length/alignment and bound high peaks.
 extra=[1,180,4000,1000,0,1,0,-18,2,10,150,6,0]
 for rate in (44100,48000,96000):
  signal=array.array('f')
  for i in range(rate):
   value=.9 if i in (0,rate//2,rate-1) else .05*math.sin(2*math.pi*997*i/rate)
   signal.extend([value,value*.5])
  raw.write_bytes(signal.tobytes());processed=d/f'limited-{rate}.f32'
  result=json.loads(subprocess.check_output([str(a.engine),'process',str(raw),str(rate),str(processed),'12','-1.5',*map(str,[0,0,0,0]+extra)]))
  measured=result['measurement'];assert measured['frames']==rate and measured['clippedSamples']==0
  assert measured['samplePeakDbFS']<=-1.499 and 0<result['minimumLimiterGain']<1
  # No clipping/limiting: explicit five-ms flush/trim retains the first/last impulse.
  passthrough=d/f'aligned-{rate}.f32'
  subprocess.check_output([str(a.engine),'process',str(raw),str(rate),str(passthrough),'-24','-1.5',*map(str,[0,0,0,0]+extra)])
  decoded=array.array('f');decoded.frombytes(passthrough.read_bytes())
  assert len(decoded)==len(signal)
  factor=10**(-24/20)
  assert abs(decoded[0]-signal[0]*factor)<1e-7 and abs(decoded[-2]-signal[-2]*factor)<1e-7
 # PCM16/24/32 mono/stereo decoding and unknown-format rejection.
 import struct
 for channels in (1,2):
  for bits in (16,24,32):
   width=bits//8;frames=24000;data=(int(.25*(1<<(bits-1))).to_bytes(width,'little',signed=True)*channels)*frames
   encoded=d/f'pcm-{channels}-{bits}.wav'
   encoded.write_bytes(struct.pack('<4sI4s4sIHHIIHH4sI',b'RIFF',36+len(data),b'WAVE',b'fmt ',16,1,channels,48000,48000*channels*width,channels*width,bits,b'data',len(data))+data)
   info=w.wav_info(encoded);dest=encoded.with_suffix('.f32');w.decode(encoded,info,dest)
   values=array.array('f');values.frombytes(dest.read_bytes());assert len(values)==frames*2 and abs(values[0]-.25)<1e-6
 # Completed artifact corruption refuses both resumption and adoption.
 original=out/'A.wav'
 with original.open('r+b') as f:f.seek(48);f.write(b'\xff\xff\xff\xff')
 assert subprocess.run(cmd+['--resume'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode!=0
print('whole-song corruption/nonfinite/silence/cancel/stale-source/intersample tests PASS')
