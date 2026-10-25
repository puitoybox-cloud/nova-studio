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
 print('5 Japanese intents: measured contrasting whole-file audio changes A/B/C settings PASS')
