"""Actual relocated Intel package-only execution and native failure guards.

Host Python orchestrates only. Every audio stage and subprocess uses the copied
package interpreter/FFmpeg/engine with an empty PATH. No Homebrew libraries.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('bundle', type=Path);p.add_argument('host', type=Path);p.add_argument('output', type=Path)
a=p.parse_args();a.output.mkdir(exist_ok=False)
bundle=a.output/'relocated space/NovaMix.component'
bundle.parent.mkdir()
# Distribution archive preserves executable modes; a raw Actions ZIP does not.
with tarfile.open(a.output/'runtime-delivery.tar.gz','w:gz') as archive:
    archive.add(a.bundle,arcname='NovaMix.component')
def delivery_filter(member,destination):
    clean=tarfile.data_filter(member,destination)
    if clean is not None and clean.isdir(): clean.mode=member.mode & 0o755
    return clean
with tarfile.open(a.output/'runtime-delivery.tar.gz') as archive:
    archive.extractall(bundle.parent,filter=delivery_filter)
for path in [bundle,*bundle.rglob('*')]:
    if path.is_dir(): assert path.stat().st_mode & 0o055 == 0o055,path
    elif path.is_file(): assert path.stat().st_mode & 0o044 == 0o044,path
resources=bundle/'Contents/Resources';runtime=resources/'Runtime'
python=runtime/'Python/bin/python3.12';ffmpeg=runtime/'FFmpeg/bin/ffmpeg'
engine=bundle/'Contents/MacOS/nova-whole-song'
env={'PATH':'/nonexistent','LANG':'en_US.UTF-8'}
subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(bundle)],check=True)
# Test orchestration is external; all production scripts are the bundled bytes.
source=Path(__file__).resolve().parents[1]
with (a.output/'matrix.log').open('w') as out:
    subprocess.run([str(python),'-I','-B',str(source/'tests/whole-song.py'),
        '--scripts',str(resources),'--reference-ffmpeg',str(ffmpeg),
        '--engine',str(engine),'--output',str(a.output/'matrix'),'--long'],
        env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
with (a.output/'section-policy.log').open('w') as out:
    subprocess.run([str(python),'-I','-B',str(source/'tests/section-policy.py'),
        '--scripts',str(resources),'--reference-ffmpeg',str(ffmpeg),
        '--engine',str(engine),'--output',str(a.output/'section-policy')],
        env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
with (a.output/'multitrack.log').open('w') as out:
    subprocess.run([str(python),'-I','-B',str(source/'tests/multitrack-audio.py'),
        '--scripts',str(resources),'--ffmpeg',str(ffmpeg),'--engine',str(engine),
        '--output',str(a.output/'multitrack')],env=env,stdout=out,stderr=subprocess.STDOUT,check=True)
# Processing must preserve the complete seal, including no stdlib bytecode writes.
subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(bundle)],check=True)
# dyld trace records what the relocated executables actually load. macOS system
# libraries are platform dependencies; all other images must stay in the bundle.
traces=[]
for executable,args in ((python,['-I','-B','-c','import json,hashlib,wave,fcntl,subprocess,resource,math']),
                        (ffmpeg,['-version'])):
    probe=subprocess.run([str(executable),*args],env=dict(env,DYLD_PRINT_LIBRARIES='1'),capture_output=True,text=True,check=True)
    lines=[line for line in probe.stderr.splitlines() if line.startswith('dyld[') and '/ ' not in line and ' /' in line]
    assert lines,probe.stderr
    for line in lines:
        path=Path(line[line.index(' /')+1:]).resolve()
        assert str(path).startswith(('/System/Library/','/usr/lib/',str(bundle.resolve())+'/')),line
    traces.extend(lines)
(a.output/'dyld-trace.txt').write_text('\n'.join(traces))
# Host invokes the actual view method; NSOpenPanel and physical Logic excluded.
def host(destination, succeeds):
    result=subprocess.run([str(a.host),str(bundle),str(python),str(ffmpeg),str(destination)]+([] if succeeds else ['expect-rejection']),env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
    (destination.parent/(destination.name+'.log')).write_text(result.stdout)
    assert result.returncode==0,result.stdout
    if not succeeds: assert json.loads((destination/'rejection.json').read_text())['operationRejected']
host(a.output/'native', True)
evidence=json.loads((a.output/'native/ui-evidence.json').read_text())
assert Path(evidence['reply']['runtime']['pythonExecutable']).resolve()==python.resolve()
assert evidence['reply']['runtime']['ffmpegSha256']==hashlib.sha256(ffmpeg.read_bytes()).hexdigest()
assert evidence['reply']['runtime']['engineSha256']==hashlib.sha256(engine.read_bytes()).hexdigest()
# Mutate only a disposable copied package, never the built distribution.
victim=runtime/'Python/lib/python3.12/json/__init__.py'
original=victim.read_bytes();victim.write_bytes(original+b'\n# corrupt\n')
host(a.output/'corrupt', False);victim.write_bytes(original)
renamed=ffmpeg.with_name('ffmpeg.missing');ffmpeg.rename(renamed)
host(a.output/'missing', False);renamed.rename(ffmpeg)
m=runtime/'inventory.json';original=m.read_bytes();j=json.loads(original);j['pythonVersion']='0';m.write_text(json.dumps(j))
host(a.output/'version', False);m.write_bytes(original)
# Even with original bytes restored, validate the entire sealed copied bundle.
subprocess.run(['/usr/bin/codesign','--verify','--deep','--strict',str(bundle)],check=True)
report=dict(format='nova-contained-acceptance-v1',path=str(bundle),externalPath=env['PATH'],
    matrix=json.loads((a.output/'matrix/whole-song-results.json').read_text()),
    nativeView=True,missingRejected=True,corruptionRejected=True,versionRejected=True,
    physicalLogic=False,publicationEligible=False)
(a.output/'result.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='matrix'}))
