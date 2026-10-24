#!/usr/bin/env python3
"""Independent FFmpeg reference, long-file, resume and explicit adoption checks."""
import argparse, array, importlib.util, json, math, pathlib, re, subprocess, sys, time, wave
root = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('whole', root / 'whole-song.py')
w = importlib.util.module_from_spec(spec); spec.loader.exec_module(w)
p=argparse.ArgumentParser();p.add_argument('--engine',type=pathlib.Path,required=True);p.add_argument('--output',type=pathlib.Path,required=True);p.add_argument('--long',action='store_true');a=p.parse_args();a.output.mkdir(exist_ok=False)

def fixture(path,rate,seconds):
    # Actual encoded audio, deterministic tonal mixture with attacks, gated heads/tails
    # and varying envelope. Development fixture, never represented as Logic audio.
    block=array.array('f')
    for n in range(rate):
        t=n/rate
        env=.08+.1*math.sin(math.pi*t)**2
        l=env*(math.sin(2*math.pi*997*t)+.35*math.sin(2*math.pi*61*t)+.12*math.sin(2*math.pi*9011*t))
        r=.8*l+.015*math.sin(2*math.pi*223*t)
        block.extend([l,r])
    if sys.byteorder!='little':block.byteswap()
    with path.open('wb') as f:
        for j in range(seconds):f.write(bytes(len(block)*4) if j in (0,seconds-1) else block.tobytes())

def run(*args):return json.loads(subprocess.check_output([str(a.engine.resolve()),*map(str,args)],text=True))
report=[]
for rate in (44100,48000,96000):
 for seconds in ((30,240,480) if a.long else (30,)):
    raw=a.output/f'fixture-{rate}-{seconds}.f32';fixture(raw,rate,seconds)
    started=time.monotonic();m=run('meter',raw,rate)['measurement'];elapsed=time.monotonic()-started
    wav=raw.with_suffix('.wav');w.wave_from_raw(raw,wav,rate)
    ref=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(wav),'-filter_complex','ebur128=peak=true','-f','null','-'],capture_output=True,text=True,check=True).stderr.split('Summary:')[-1]
    lu=float(re.search(r'I:\s*([-\d.]+) LUFS',ref)[1]);tp=float(re.search(r'Peak:\s*([-\d.]+) dBFS',ref)[1])
    assert abs(m['integratedLufs']-lu)<.15,(rate,seconds,m,ref)
    assert abs(m['truePeakEstimateDbTP']-tp)<.5,(rate,seconds,m,ref)
    assert m['frames']==rate*seconds and m['complete'] and m['shortTermValid']
    report.append(dict(rate=rate,seconds=seconds,meter=m,referenceLufs=lu,referenceDbTP=tp,meterWallSeconds=elapsed))
    # Whole production chain at all rates for 30s and 4/8 min at 48k.
    if seconds==30 or rate==48000:
        out=a.output/f'comparison-{rate}-{seconds}'
        cmd=[sys.executable,str(root/'whole-song.py'),str(wav),'--engine',str(a.engine.resolve()),'--output',str(out),'--project','fixture','--track','stereo','--version','v1','--source','development-fixture','--kind','stereo-out','--confirm-source']
        with (a.output/f'production-{rate}-{seconds}.json').open('w') as log:
            subprocess.run(cmd,stdout=log,check=True)
        result=json.loads((out/'manifest.json').read_text());assert result['complete'];assert result['adopted'] is None
        for row in result['renders']:
            assert row['measurement']['frames']==rate*seconds
            assert abs(row['matchedMeasurement']['integratedLufs']-min(x['measurement']['integratedLufs'] for x in result['renders']))<.01
            if row['label']!='original':assert row['measurement']['truePeakEstimateDbTP']<=-1 and row['measurement']['clippedSamples']==0
        before={n:w.sha(out/n) for n in result['artifacts']}
        subprocess.run(cmd+['--resume'],stdout=subprocess.DEVNULL,check=True)
        assert before=={n:w.sha(out/n) for n in result['artifacts']}
        adopt=[sys.executable,str(root/'select-whole-song.py'),str(out),'--project','fixture','--track','stereo','--version','v1','--source-wav',str(wav),'--approve']
        subprocess.run(adopt+['--choice','B'],check=True,stdout=subprocess.DEVNULL)
        assert w.sha(out/'adopted.wav')==w.sha(out/'B.wav')
        subprocess.run(adopt+['--choice','undo'],check=True,stdout=subprocess.DEVNULL)
        assert json.loads((out/'manifest.json').read_text())['adopted'] is None
        report[-1]['production']=dict(elapsed=result['elapsedSecondsThisRun'],resources=result.get('resources'),renders=result['renders'],artifactBytes=sum((out/n).stat().st_size for n in result['artifacts']))
    # Keep all comparison WAVs, discard only reproducible temporary fixture raw.
    raw.unlink()
    (a.output/'whole-song-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
# Abrupt intersample fixtures expose the short FIR's reference differences.
# Production adoption must additionally satisfy the independent peak ceiling;
# this does not loosen the mixed/gated matrix's existing 0.5-dB reference check.
peak_guard=[]
for rate in (44100,48000,96000):
    raw=a.output/f'intersample-{rate}.f32'
    values=array.array('f')
    for i in range(rate*2):
        x=.8*math.sin(2*math.pi*.25*i+math.pi/4) if i%(rate//2)<rate//20 else 0;values.extend([x,x])
    raw.write_bytes(values.tobytes());wav=raw.with_suffix('.wav');w.wave_from_raw(raw,wav,rate)
    out=a.output/f'peak-guard-{rate}'
    cmd=[sys.executable,str(root/'whole-song.py'),str(wav),'--engine',str(a.engine.resolve()),'--output',str(out),'--project','peak-fixture','--track','stereo','--version','v1','--source','development-fixture','--kind','stereo-out','--target-lufs','-5','--confirm-source']
    subprocess.run(cmd,stdout=subprocess.DEVNULL,check=True)
    result=json.loads((out/'manifest.json').read_text());assert result['independentPeakCeilingVerified']
    for row in result['renders'][1:]:
        assert row['independentReference']['truePeakDbTP']+.05<=-1
        assert row['measurement']['clippedSamples']==0
    peak_guard.append(dict(rate=rate,before=result['renders'][0],renders=result['renders'][1:],resources=result['initialCompletedRun']))
    raw.unlink()
(a.output/'peak-guard-results.json').write_text(json.dumps(peak_guard,indent=2))
