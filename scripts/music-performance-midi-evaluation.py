"""Compare isolated performance audio with its aligned reference MIDI."""

import argparse
from hashlib import file_digest
import json
from pathlib import Path
import runpy
from tempfile import TemporaryDirectory
from time import perf_counter

import pretty_midi

benchmark = runpy.run_path(str(Path(__file__).with_name('music-guitar-performance-evaluation.py')))
compare = benchmark['compare']
process_transcription = benchmark['process_transcription']


def notes(path):
    midi = pretty_midi.PrettyMIDI(str(path))
    return [(note.start, note.end, note.pitch) for track in midi.instruments if not track.is_drum for note in track.notes]


def digest(path):
    with path.open('rb') as stream:
        return file_digest(stream, 'sha256').hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('instrument', choices=['piano', 'guitar', 'voice', 'bass'])
    parser.add_argument('recordings', nargs='+', type=Path, help='WAV files with an aligned .midi or .notes.json file of the same basename')
    args = parser.parse_args()
    records = []
    with TemporaryDirectory() as directory:
        output = Path(directory)
        for recording in args.recordings:
            reference = recording.with_suffix('.midi')
            if reference.is_file():
                expected = notes(reference)
            else:
                reference = recording.with_suffix('.notes.json')
                expected = json.loads(reference.read_text())
                if not all(isinstance(row,list) and len(row)==3 and 0<=row[0]<row[1] and 0<=row[2]<=127 for row in expected):
                    parser.error(f'{reference} must contain [onset seconds, offset seconds, MIDI pitch] rows')
            if not expected:
                parser.error(f'{reference} has no pitched reference notes')
            for mode in ('monophonic', 'polyphonic'):
                start = perf_counter()
                result = process_transcription(recording, output, mode, args.instrument)
                elapsed = round(perf_counter() - start, 3)
                records.append({
                    'recording': recording.stem, 'instrument': args.instrument, 'mode': mode,
                    'audioSha256': digest(recording), 'referenceSha256': digest(reference),
                    'inferenceSeconds': elapsed, **compare(expected, notes(output / result['midiFileName'])),
                })
    print(json.dumps({'comparison':'Pitch and onset within 75 ms, note offsets excluded.',
                      'humanCorrectionSeconds':None,'records':records}, indent=2))


if __name__ == '__main__':
    main()
