"""Exercise the actual streaming CLI including gain/bypass and rejection paths."""
import argparse
import array
import json
import math
from pathlib import Path
import subprocess
import tempfile
p=argparse.ArgumentParser();p.add_argument('--engine',type=Path,required=True);args=p.parse_args()
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp)
    for rate in (44100,48000,96000):
        samples=array.array('f')
        for i in range(rate):samples.extend([.1*math.sin(2*math.pi*997*i/rate),.08*math.sin(2*math.pi*223*i/rate)])
        source=root/f'in-{rate}.f32';source.write_bytes(samples.tobytes())
        for bypass in (0,1):
            output=root/f'out-{rate}-{bypass}.f32'
            cmd=[str(args.engine.resolve()),'shared-process',str(source),str(rate),str(output),'0','-1','-6','0','0',str(bypass),
                 '0','180','4000','1000','0','1','0','-18','2','10','150','6','0']
            result=json.loads(subprocess.check_output(cmd));assert result['measurement']['frames']==rate and result['minimumLimiterGain']==1
            rendered=array.array('f');rendered.frombytes(output.read_bytes());assert len(rendered)==len(samples)
            factor=1 if bypass else 10**(-6/20)
            assert max(abs(a-b*factor) for a,b in zip(rendered,samples))<1e-7
            assert subprocess.run(cmd,capture_output=True).returncode!=0 # cannot overwrite
            before=output.read_bytes();cmd[4]=str(root/f'invalid-{rate}-{bypass}.f32');cmd[5]='3'
            assert subprocess.run(cmd,capture_output=True).returncode!=0 # no hidden mastering gain
            assert output.read_bytes()==before and source.read_bytes()==samples.tobytes()
print('shared-process CLI at 44.1/48/96kHz: gain/bypass/length/no-overwrite/no-extra-gain PASS')
