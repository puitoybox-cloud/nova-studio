#!/usr/bin/env python3
"""Actual bridge execution; failures never produce an adoptable result."""
import argparse, array, hashlib, json, math, pathlib, shutil, subprocess, sys, tempfile
p=argparse.ArgumentParser();p.add_argument('--engine',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
folder=a.output or pathlib.Path(tempfile.mkdtemp(prefix='nova-au-bridge-'))
folder.mkdir(exist_ok=True)
sys.path.insert(0,str(root))
import importlib.util
spec=importlib.util.spec_from_file_location('bridge',root/'au-whole-song.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
# 30-second actual WAV; whole-song matrix is retained separately.
raw=folder/'fixture.f32';v=array.array('f')
for n in range(48000):
 x=.12*math.sin(2*math.pi*997*n/48000)+.03*math.sin(2*math.pi*70*n/48000);v.extend((x,.8*x))
if sys.byteorder!='little':v.byteswap()
with raw.open('wb') as f:
 for _ in range(30):f.write(v.tobytes())
wav=folder/'logic-fixture.wav';b.w.wave_from_raw(raw,wav,48000)
q=dict(format='nova-au-whole-request-v1',sourceKind='development-fixture',sourceTap='pre-nova-confirmed',projectId='fixture',trackId='piano',instanceId='instance-A',audioVersion='source-v1',settingsToken='baseline',inputSource='explicit fixture',kind='track',role='piano',confirmed=True,instruction='ピアノを温かく自然にして',targetLufs=-14,ceilingDbTP=-1,sourceWav=str(wav.resolve()),engine=str(a.engine.resolve()),ffmpeg=str(pathlib.Path(shutil.which('ffmpeg')).resolve()),output=str((folder/'audio').resolve()),pipelineSha256=sha(root/'whole-song.py'),pythonSha256=sha(sys.executable))
for k in ('sourceWav','engine','ffmpeg'):q[k+'Sha256']=sha(q[k])
request=folder/'request.json';request.write_text(json.dumps(q))
cmd=[sys.executable,'-I',str(root/'au-whole-song.py')]
def run(operation,*args,ok=True):
 r=subprocess.run([*cmd,operation,str(request),*args],capture_output=True,text=True)
 assert (r.returncode==0)==ok,(operation,r.stderr)
 return json.loads(r.stdout) if ok else None
preview=run('preview');assert preview['previewOnly'] and not preview['audioAnalyzed']
assert not (folder/'audio').exists(), 'preflight cannot render or create output'
assert preview['instructionPlan']['actions'][0]['targetTrackId']=='piano'
assert preview['instructionPlan']['actions'][0]['timeScope']=='entire confirmed input'
for instruction in ('ベースの低音を整えて', 'ピアノを自然に、ボーカルを前に出して', '2小節だけ高音を柔らかく', '高音を柔らかく、リバーブを深く'):
 bad={**q,'instruction':instruction};request.write_text(json.dumps(bad));run('preview',ok=False);run('run',ok=False)
 assert not (folder/'audio').exists(), 'all clauses must validate before any render'
request.write_text(json.dumps(q))
r=run('run');assert r['offlineLimiterNotLiveAu'] and not r['modelInference'];assert len(r['renders'])==4
assert r['instructionPlan']['audioAnalyzed']
assert r['instructionPlan']['measuredCandidates'][1]['values']==r['renders'][2]['values']
assert r['spectralReviews']['B']['perceptualQualityVerified'] is False
assert r['renders'][1]['values']!=r['renders'][3]['values']
run('verify');run('resume');run('adopt',ok=False);run('adopt','--choice','B','--approve')
assert sha(folder/'audio/adopted.wav')==sha(folder/'audio/B.wav')
run('undo','--approve');assert json.loads((folder/'audio/manifest.json').read_text())['adopted'] is None
# Source change, artifact change, hostile paths and missing runtime fail closed.
with wav.open('ab') as f:f.write(b'changed')
run('verify',ok=False)
with wav.open('r+b') as f:f.truncate(f.seek(0,2)-7)
output=folder/'audio/A.wav';saved=output.read_bytes();output.write_bytes(b'bad');run('verify',ok=False);output.write_bytes(saved)
manifest=folder/'audio/manifest.json';original=manifest.read_text();m=json.loads(original);m['artifacts']['../outside.wav']='0'*64;manifest.write_text(json.dumps(m));run('verify',ok=False);manifest.write_text(original)
for value in (float('nan'), 7, -25, True):
 m=json.loads(original);m['renders'][1]['values'][0]=value;manifest.write_text(json.dumps(m));run('verify',ok=False)
manifest.write_text(original);run('verify')
q['engineSha256']='0'*64;request.write_text(json.dumps(q));run('resume',ok=False)
print(json.dumps(dict(status='PASS',seconds=30,sourceUnchanged=sha(wav)==q['sourceWavSha256'],folder=str(folder),resources=r['resources'])))
