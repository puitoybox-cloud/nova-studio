#!/usr/bin/env python3
"""Actual PCM: silence, quiet/loud sections, gain invariance and changed dynamics."""
import argparse,array,hashlib,importlib.util,json,math,pathlib,subprocess,sys,tempfile
p=argparse.ArgumentParser();p.add_argument('--engine',required=True);args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('comparison',root/'compare-sections.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
policy_spec=importlib.util.spec_from_file_location('policy',root/'whole-song.py');policy=importlib.util.module_from_spec(policy_spec);policy_spec.loader.exec_module(policy)
with tempfile.TemporaryDirectory() as d:
 for rate in (44100,48000,96000):
  paths=[]
  for name,gains in [('original',(0,.025,.2)),('gain',(0,.05,.4)),('compressed',(0,.05,.2))]:
   path=pathlib.Path(d)/f'{rate}-{name}.f32';block=array.array('f')
   with path.open('wb') as f:
    for amplitude in gains:
     block=array.array('f')
     for i in range(rate*3):
      value=amplitude*math.sin(2*math.pi*997*i/rate);block.extend((value,value))
     if sys.byteorder!='little':block.byteswap()
     f.write(block.tobytes())
    # Final <400ms tail must be present but explicitly loudness-invalid.
    f.write(bytes(8*(rate//10)))
   paths.append(path)
  hashes=[hashlib.sha256(x.read_bytes()).hexdigest() for x in paths]
  results=[json.loads(subprocess.check_output([args.engine,'sections',str(x),str(rate)],text=True)) for x in paths]
  uniform=module.compare(results[0],results[1]);changed=module.compare(results[0],results[2])
  assert len(uniform['sections'])==4
  assert not uniform['sections'][0]['loudnessValid'] and not uniform['sections'][-1]['loudnessValid']
  assert abs(uniform['medianSectionGainDb']-20*math.log10(2))<1e-6
  assert uniform['sectionGainVariationDb']<1e-6
  assert changed['sectionGainVariationDb']>6
  assert not policy.section_review(results[0],results[1])['excessiveDynamicsChange']
  assert policy.section_review(results[0],results[2])['excessiveDynamicsChange']
  assert not uniform['perceptualQualityVerified'] and not uniform['intelligibilityMeasured']
  assert hashes==[hashlib.sha256(x.read_bytes()).hexdigest() for x in paths]
  try:module.compare(results[0],{'sections':results[1]['sections'][:-1]})
  except ValueError:pass
  else:raise AssertionError('alignment mismatch accepted')
 print('3 rates: PCM section dynamics/gain invariance/silence/tail/alignment/source preservation PASS')
