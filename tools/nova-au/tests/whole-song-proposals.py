#!/usr/bin/env python3
"""Measure contrasting audio; all requested Japanese intents use those measurements."""
import argparse,array,json,math,pathlib,subprocess,sys,tempfile
p=argparse.ArgumentParser();p.add_argument('--engine',required=True);a=p.parse_args()
with tempfile.TemporaryDirectory() as d:
 paths=[]
 for name,hz,amp in [('low',70,.05),('high',9000,.2)]:
  path=pathlib.Path(d)/(name+'.f32');v=array.array('f')
  for n in range(48000):
   x=amp*math.sin(2*math.pi*hz*n/48000);v.extend((x,x))
  if sys.byteorder!='little':v.byteswap()
  path.write_bytes(v.tobytes());paths.append(path)
 intents=[('ボーカルを前に出して','vocal'),('ピアノを優しく温かい音にして','piano'),('ストリングスを柔らかくして','strings'),('ベースの低音を整えて','bass'),('曲全体を自然にまとめて','unspecified')]
 for instruction,role in intents:
  plans=[json.loads(subprocess.check_output([a.engine,'plan',str(path),'48000',instruction,role,'track'],text=True))for path in paths]
  assert plans[0]['input']['bands'][0]>.99 and plans[1]['input']['bands'][2]>.99
  assert plans[0]['choices']!=plans[1]['choices'],instruction
  assert plans[0]['choices'][0]!=plans[0]['choices'][2],instruction
 # New wording must enter the same measured proposal, never unapproved adoption.
 aliases=[('ピアノを自然に聞こえるように','ピアノを温かく自然にして','piano'),('高音がきついので柔らかく','高音を少し抑えて','unspecified'),('低音をすっきりさせて','低音が強すぎるので調整して','bass')]
 for alias,canonical,role in aliases:
  for path in paths:
   command=[a.engine,'plan',str(path),'48000']
   plans=[json.loads(subprocess.check_output(command+[text,role,'track'],text=True)) for text in (alias,canonical)]
   assert plans[0]==plans[1],alias
 # Instructions requiring comparison history or loudness/dynamics policy must not
 # silently fall back to an unrelated proposal.
 for text in ('AとBの中間にして','この設定を元に戻して','音を潰さずに迫力を出して','全体の音圧を少し上げて'):
  rejected=subprocess.run([a.engine,'plan',str(paths[0]),'48000',text,'unspecified','stereo-out'],capture_output=True,text=True)
  assert rejected.returncode!=0 and '未対応' in rejected.stderr,text
 print('3 Japanese aliases: exact measured equivalence; 4 unsupported history/loudness intents explicitly rejected PASS')
 print('5 Japanese intents: measured contrasting whole-file audio changes A/B/C settings PASS')
