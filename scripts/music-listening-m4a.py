"""Encode and independently decode every comparison file with pinned FFmpeg 7.0.2."""
import hashlib
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path
import imageio_ffmpeg

ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
version = subprocess.check_output([ffmpeg, '-version'], text=True).splitlines()[0]
if not version.startswith('ffmpeg version 7.0.2-'): raise RuntimeError('unexpected FFmpeg: ' + version)
for directory in map(Path, sys.argv[1:]):
    manifest = json.loads((directory / 'Manifest.json').read_text())
    if not manifest['completed'] or len(manifest['files']) != 8: raise RuntimeError('incomplete WAV generation')
    converted = []
    for entry in manifest['files']:
        source = directory / entry['name']
        if hashlib.sha256(source.read_bytes()).hexdigest() != entry['sha256']: raise RuntimeError('WAV changed')
        target = source.with_suffix('.m4a')
        subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-y', '-i', str(source), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(target)], check=True)
        with tempfile.TemporaryDirectory() as temp:
            decoded = Path(temp) / 'decoded.wav'
            subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-i', str(target), '-c:a', 'pcm_s16le', str(decoded)], check=True)
            with wave.open(str(decoded)) as audio:
                seconds = audio.getnframes() / audio.getframerate()
                if audio.getnchannels() != 2 or audio.getframerate() != 48000 or abs(seconds-entry['seconds']) > .1: raise RuntimeError('AAC format/duration mismatch')
        converted.append(dict(name=target.name, bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), decodedSeconds=seconds))
    (directory / 'M4A-Manifest.json').write_text(json.dumps(dict(ffmpeg=version, files=converted, physicalApplePlayback='Pending Tia acceptance'), indent=2)+'\n')
    (directory / 'README.txt').write_text('NOVA sound comparison / 2026-10-20\nHQ = acoustic sample instruments. Other files = previous synthesis.\nSame source MIDI and ONNX A/B/C fixture; sound changes only.\nONNX composition includes rule-based harmony/instrumentation; drums rule-arranged.\nStems are candidate A. Full Mix includes original melody.\nM4A: AAC-LC 192 kbps, 48 kHz stereo; software decode checked. Physical iPhone/iPad playback pending.\nHQ samples: one dynamic layer, finite sustain, no true string legato. See licenses.\n')
