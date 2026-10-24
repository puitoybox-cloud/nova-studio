#!/usr/bin/env python3
"""Local, bounded PCM WAV -> NOVA DSP comparison. Never contacts a provider."""
import argparse, array, hashlib, json, pathlib, subprocess, sys, tempfile, wave
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('wav', type=pathlib.Path)
p.add_argument('--engine', required=True, type=pathlib.Path)
p.add_argument('--output', required=True, type=pathlib.Path)
p.add_argument('--project', required=True)
p.add_argument('--track', required=True)
p.add_argument('--source', required=True, choices=['logic-render', 'recorded-audio', 'development-fixture'])
p.add_argument('--instruction', required=True)
a = p.parse_args()
if a.output.exists(): p.error('output must be a new directory')
with wave.open(str(a.wav), 'rb') as w:
    rate, channels, width, total = w.getframerate(), w.getnchannels(), w.getsampwidth(), w.getnframes()
    if channels not in (1, 2) or width not in (2, 3, 4) or not 22050 <= rate <= 192000:
        p.error('PCM16/24/32 mono/stereo, 22050..192000 Hz required')
    raw = w.readframes(min(total, rate * 2))
    decoded = array.array('f')
    for i in range(0, len(raw), width * channels):
        vals = [int.from_bytes(raw[i+c*width:i+(c+1)*width], 'little', signed=True) / (1 << (width*8-1)) for c in range(channels)]
        decoded.extend(vals if channels == 2 else vals * 2)
if sys.byteorder != 'little': decoded.byteswap()
with tempfile.TemporaryDirectory(prefix='nova-local-') as tmp:
    pcm = pathlib.Path(tmp) / 'input.f32'
    pcm.write_bytes(decoded.tobytes())
    result = subprocess.run([str(a.engine.resolve()), str(pcm), str(rate), str(a.output.resolve()), a.instruction], check=True, capture_output=True, text=True)
    report = json.loads(result.stdout)
# Hash the exact selected PCM and the complete WAV without loading the entire source into RAM.
h = hashlib.sha256()
with a.wav.open('rb') as f:
    for block in iter(lambda: f.read(1048576), b''): h.update(block)
report.update(format='nova-wav-comparison-v1', projectId=a.project, trackId=a.track,
              source=a.source, sourceWavSha256=h.hexdigest(), selectedPcmSha256=hashlib.sha256(raw).hexdigest(),
              sourceFrames=total, startFrame=0, selectedFrames=len(decoded)//2, instruction=a.instruction,
              method='same NOVA DSP offline; initial filter state zero; RMS attenuation matching, not LUFS',
              hostTrackAutomaticallyVerified=False, logicProjectBackupIncluded=False)
for row in report['renders']:
    for suffix in ['', '-rms-matched']:
        file = a.output / (row['label'] + suffix + '.wav')
        row['sha256' + suffix] = hashlib.sha256(file.read_bytes()).hexdigest()
(a.output / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
