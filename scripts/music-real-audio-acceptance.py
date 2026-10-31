#!/usr/bin/env python3
"""Exercise existing audio Helper inference with an explicit local audio input.

Run in a provisioned Python environment; this script installs nothing. Demucs may
fetch its configured model if it is not already cached. This is development
acceptance, not the strict packaged runtime's distribution acceptance.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/music-audio-pipeline'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--separate', action='store_true')
    args = parser.parse_args()
    source = args.source.resolve(strict=True)
    if args.output.exists():
        parser.error('output must be a new directory; existing results are preserved')
    args.output.mkdir(parents=True)
    import server
    import basic_pitch
    import importlib.metadata
    result = {'sourceSha256': digest(source), 'basicPitchVersion': importlib.metadata.version('basic-pitch'),
              'basicPitchModelSha256': digest(basic_pitch.ICASSP_2022_MODEL_PATH),
              'strictRuntime': server.STRICT_BOOTSTRAP, 'qualityAccepted': False}
    if args.separate:
        payload = server.process_audio(source, args.output)
        midi = args.output / payload['midiFileName']
        import soundfile
        stems = []
        for path in sorted((args.output / 'demucs').rglob('*.wav')):
            info = soundfile.info(path)
            assert info.frames > 0
            stems.append({'name': path.name, 'sha256': digest(path), 'frames': info.frames, 'sampleRate': info.samplerate})
        assert len(stems) == 6, 'expected six real htdemucs_6s WAV outputs'
        result.update(stems=stems, noteCounts=payload['noteCounts'], demucsVersion=importlib.metadata.version('demucs'))
    else:
        midi = args.output / 'transcribed.mid'
        server.transcribe_pitched_stem(source, midi)
    notes = [event for event in server.extract_note_events(midi) if event[1] == 'note_on' and event[3] > 0]
    assert notes, 'actual inference returned no MIDI note-ons'
    result.update(midiSha256=digest(midi), noteOnCount=len(notes), events=notes,
                  midiBase64=base64.b64encode(midi.read_bytes()).decode('ascii'))
    (args.output / 'acceptance.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key not in ('midiBase64', 'events')}, indent=2))


if __name__ == '__main__':
    main()
