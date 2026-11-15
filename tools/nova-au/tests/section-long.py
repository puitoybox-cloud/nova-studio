#!/usr/bin/env python3
"""Complete 480s opt-in production subprocess, including section passes and cleanup."""
import argparse,importlib.util,json,pathlib,resource,subprocess,sys,time
p=argparse.ArgumentParser();p.add_argument('--engine',type=pathlib.Path,required=True);p.add_argument('--source',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--scripts',type=pathlib.Path);p.add_argument('--reference-ffmpeg');a=p.parse_args()
root=a.scripts.resolve() if a.scripts else pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('whole',root/'whole-song.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
info=w.wav_info(a.source);assert info['frames']==480*48000 and info['sampleRate']==48000
before=w.sha(a.source);cmd=[sys.executable,'-I','-B',str(root/'whole-song.py'),str(a.source),'--engine',str(a.engine.resolve()),'--output',str(a.output),'--project','section-long','--track','stereo','--version','v1','--source','development-fixture','--kind','stereo-out','--instruction','全体の音圧を少し上げて','--confirm-source']
if a.reference_ffmpeg:cmd+=['--reference-ffmpeg',a.reference_ffmpeg]
start=time.monotonic();usage=resource.getrusage(resource.RUSAGE_CHILDREN)
subprocess.run(cmd,check=True,stdout=subprocess.DEVNULL)
wall=time.monotonic()-start;finished=resource.getrusage(resource.RUSAGE_CHILDREN)
m=json.loads((a.output/'manifest.json').read_text());assert m['complete'] and m['adopted'] is None and len(m['artifacts'])==8 and w.sha(a.source)==before
for index,row in enumerate(m['renders'][1:]):
 assert not row['sectionReview']['excessiveDynamicsChange'] and not row['measurement']['clippedSamples']
 assert abs(row['measurement']['integratedLufs']-m['before']['integratedLufs']-(.5,1,1.5)[index])<.01
 assert row['independentReference']['truePeakDbTP']+.05<=-1
hashes={n:w.sha(a.output/n) for n in m['artifacts']}
subprocess.run(cmd+['--resume'],check=True,stdout=subprocess.DEVNULL)
assert hashes=={n:w.sha(a.output/n) for n in m['artifacts']}
evidence=dict(completeSubprocessWallSeconds=wall,completeSubprocessCpuSeconds=finished.ru_utime+finished.ru_stime-usage.ru_utime-usage.ru_stime,scope='480s 48kHz fixture; all source and candidate section measurement passes, decode, independent reference, matching and cleanup included',sourceSha256=before,wavHashes=hashes,sectionPolicy=m['sectionPolicy'],renders=m['renders'],physicalLogic=False,perceptualQualityVerified=False)
(a.output.parent/'section-long-results.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2))
print(json.dumps(evidence,ensure_ascii=False))
