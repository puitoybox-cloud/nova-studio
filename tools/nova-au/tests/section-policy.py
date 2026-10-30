#!/usr/bin/env python3
"""Actual production subprocesses: section guard, Japanese plans, resume/adoption.
Deterministic PCM fixtures, never represented as recorded vocals or listening proof.
"""
import argparse,array,hashlib,importlib.util,json,math,pathlib,subprocess,sys,time
p=argparse.ArgumentParser();p.add_argument('--engine',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--scripts',type=pathlib.Path);p.add_argument('--reference-ffmpeg');a=p.parse_args();a.output.mkdir(exist_ok=False)
root=a.scripts.resolve() if a.scripts else pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('whole',root/'whole-song.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
for instruction,role,kind in [('高音を柔らかく、低音をすっきり','unspecified','stereo-out'),('ピアノを自然に、高音を柔らかく','piano','track')]:
 assert len(w.instruction_steps(instruction,role,kind))==2
for instruction,role,kind in [('ピアノを自然に','bass','track'),('ベースの低音を整えて','unspecified','stereo-out'),('2小節だけ高音を柔らかく','piano','track'),('ピアノを自然に、低音をすっきり','piano','track'),('ピアノを自然に、ボーカルを前に出して','piano','track'),('低音をすっきり、低音をすっきり','bass','track'),('高音を柔らかく、リバーブを深く','unspecified','stereo-out'),('全体の音圧を少し上げて','vocal','track'),('AとBの中間にして','unspecified','stereo-out'),('この設定を元に戻して','unspecified','stereo-out')]:
 try:w.instruction_steps(instruction,role,kind)
 except ValueError:pass
 else:raise AssertionError(instruction)
rows=[]
for rate in (44100,48000,96000):
 raw=a.output/f'{rate}.f32'
 with raw.open('wb') as f:
  for amp in (0,.025,.15,.45,0):
   block=array.array('f')
   for i in range(rate*3):
    t=i/rate;x=amp*(.8*math.sin(2*math.pi*997*t)+.2*math.sin(2*math.pi*71*t));block.extend((x,.9*x))
   if sys.byteorder!='little':block.byteswap()
   f.write(block.tobytes())
  f.write(bytes(8*(rate//10)))
 wav=raw.with_suffix('.wav');w.wave_from_raw(raw,wav,rate);original=w.sha(wav)
 cmd=[sys.executable,'-I','-B',str(root/'whole-song.py'),str(wav),'--engine',str(a.engine.resolve()),'--project','policy','--track','stereo','--version','v1','--source','development-fixture','--kind','stereo-out','--confirm-source']
 if a.reference_ffmpeg:cmd += ['--reference-ffmpeg',a.reference_ffmpeg]
 results={}
 for name,instruction,flags in [('legacy','全体の音を自然に整えて',[]),('guarded','全体の音を自然に整えて',['--section-aware']),('loudness','全体の音圧を少し上げて',[]),('multi','高音を柔らかく、低音をすっきり、音を潰さず迫力を出して',[])]:
  out=a.output/f'{rate}-{name}';run=cmd+['--output',str(out),'--instruction',instruction]+flags
  if name=='loudness':run += ['--target-lufs','-5']
  if rate==48000 and name=='guarded':
   child=subprocess.Popen(run,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   deadline=time.monotonic()+15
   while not (out/'manifest.json').exists() and time.monotonic()<deadline:time.sleep(.01)
   assert (out/'manifest.json').exists();child.terminate();child.wait(timeout=10)
   assert json.loads((out/'manifest.json').read_text())['status']=='cancelled'
   subprocess.run(run+['--resume'],check=True,stdout=subprocess.DEVNULL)
  else:
   subprocess.run(run,check=True,stdout=subprocess.DEVNULL)
  result=json.loads((out/'manifest.json').read_text());assert result['complete'] and result['adopted'] is None
  assert len(result['artifacts'])==8 and w.sha(wav)==original
  assert result['instructionPlan']['audioAnalyzed'] is True
  assert [x['order'] for x in result['instructionPlan']['actions']]==list(range(1,len(result['instructionPlan']['steps'])+1))
  for row in result['renders'][1:]:
   expected=[y-x for x,y in zip(result['before']['bands'],row['measurement']['bands'])]
   assert result['spectralReviews'][row['label']]['bandFractionDelta']==expected
  if name!='legacy':
   profile=result['sectionPolicy']['source'];assert profile['invalidSections']==3 and profile['activeSections']==3
   assert profile['rangeLu']>24 and profile['quietSections']>=1 and profile['loudSections']>=1
   for r in result['renders'][1:]:
    assert r['sectionReview']['excessiveDynamicsChange'] is False
    assert not r['measurement']['clippedSamples'] and r['independentReference']['truePeakDbTP']+.05<=-1
    assert abs(r['matchedMeasurement']['integratedLufs']-min(x['measurement']['integratedLufs'] for x in result['renders']))<.01
   before={n:w.sha(out/n) for n in result['artifacts']}
   subprocess.run(run+['--resume'],check=True,stdout=subprocess.DEVNULL)
   assert before=={n:w.sha(out/n) for n in result['artifacts']}
   select=[sys.executable,'-I','-B',str(root/'select-whole-song.py'),str(out),'--project','policy','--track','stereo','--version','v1','--source-wav',str(wav),'--choice','B']
   assert subprocess.run(select,capture_output=True).returncode!=0
   subprocess.run(select+['--approve'],check=True,stdout=subprocess.DEVNULL)
   assert w.sha(out/'adopted.wav')==w.sha(out/'B.wav')
   subprocess.run(select[:-1]+['undo','--approve'],check=True,stdout=subprocess.DEVNULL)
   assert json.loads((out/'manifest.json').read_text())['adopted'] is None
   if name=='loudness':
    for i,r in enumerate(result['renders'][1:]):
     assert r['processing'][6]==0 and r['values'][1:3]==[0,0]
     assert abs(r['measurement']['integratedLufs']-result['before']['integratedLufs']-(.5,1,1.5)[i])<.01
  if rate==48000 and name=='loudness':
   conflict=cmd+['--output',str(a.output/'contradictory-target'),'--instruction',instruction]
   rejected=subprocess.run(conflict,capture_output=True,text=True)
   assert rejected.returncode!=0 and '目標LUFSが矛盾' in rejected.stderr
   assert not json.loads((a.output/'contradictory-target/manifest.json').read_text())['complete']
   assert w.sha(wav)==original
  results[name]=dict(elapsed=result['elapsedSecondsThisRun'],renders=result['renders'],sectionPolicy=result.get('sectionPolicy'))
 rows.append(dict(rate=rate,fixtureSeconds=15.1,sourceSha256=original,results=results))
 (a.output/'section-policy-results.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('3 rates / legacy + guarded + Japanese loudness + 3-clause plans: 8 WAVs, TP, dynamics, resume, approval, Undo PASS')
