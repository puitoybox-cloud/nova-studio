"""Measure Basic Pitch note precision/recall on controlled, generated fixtures."""
import argparse
import json
from pathlib import Path
import sys

import mir_eval
import numpy as np
import pretty_midi
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools/music-audio-pipeline'))
from server import process_transcription

PITCHES = {'piano': (60, 64, 67), 'voice': (55, 59, 62),
           'guitar': (45, 52, 57), 'bass': (28, 35, 40)}
RATE = 22050


def waveform(instrument, pitch, duration):
    time = np.arange(round(duration * RATE)) / RATE
    if instrument in ('piano', 'bass'):
        source_pitch = 60 if instrument == 'piano' else 36
        sample, rate = sf.read(ROOT / 'assets/music-acoustic-v1' / f'{instrument}-{source_pitch}.wav',
                               always_2d=True)
        sound = np.interp(time * rate * 2 ** ((pitch - source_pitch) / 12),
                          np.arange(len(sample)), sample.mean(axis=1), right=0)
    else:
        hz = pretty_midi.note_number_to_hz(pitch)
        phase = 2 * np.pi * hz * time
        if instrument == 'voice':
            phase += .35 * np.sin(2 * np.pi * 5 * time)
            weights = [1 / harmonic + .8 * np.exp(-((harmonic * hz - 650) / 210) ** 2)
                       for harmonic in range(1, 11)]
        else:
            weights = [np.sin(.45 * harmonic) / harmonic for harmonic in range(1, 11)]
        sound = sum(weight * np.sin(harmonic * phase) for harmonic, weight in enumerate(weights, 1))
        if instrument == 'guitar':
            sound *= np.exp(-3 * time)
    return sound * np.minimum(1, time / .02) * np.minimum(1, (duration - time) / .035)


def fixture(folder, instrument, mode):
    notes = []
    audio = np.zeros(RATE * 4)
    for index, start in enumerate((.25, 1.35, 2.45)):
        root = PITCHES[instrument][index]
        pitches = [root] if mode == 'monophonic' else [root, root + 5, root + 9]
        for pitch in pitches:
            duration = .65
            wave = waveform(instrument, pitch, duration)
            offset = round(start * RATE)
            audio[offset:offset + len(wave)] += wave
            notes.append((start, start + duration, pitch))
    path = folder / f'{instrument}-{mode}.wav'
    sf.write(path, audio / (1.2 * np.max(np.abs(audio))), RATE)
    return path, notes


def metrics(expected, midi):
    detected = [(n.start, n.end, n.pitch) for track in midi.instruments for n in track.notes]
    reference = np.array(expected)
    estimates = np.array(detected)
    values = mir_eval.transcription.precision_recall_f1_overlap(
        reference[:, :2], pretty_midi.note_number_to_hz(reference[:, 2]),
        estimates[:, :2], pretty_midi.note_number_to_hz(estimates[:, 2]),
        onset_tolerance=.075, pitch_tolerance=50, offset_ratio=None)
    return dict(expected=len(expected), detected=len(detected), precision=round(values[0], 4),
                recall=round(values[1], 4), f1=round(values[2], 4))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    args.directory.mkdir(parents=True, exist_ok=True)
    for instrument in PITCHES:
        for mode in ('monophonic', 'polyphonic'):
            audio, expected = fixture(args.directory, instrument, mode)
            reports = {}
            for variant, profile in [('generic', None), ('instrumentProfile', instrument)]:
                try:
                    process_transcription(audio, args.directory, mode, profile)
                except ValueError as error:
                    if str(error) != '音符を検出できませんでした。':
                        raise
                    reports[variant] = dict(expected=len(expected), detected=0, precision=0, recall=0, f1=0)
                else:
                    reports[variant] = metrics(expected, pretty_midi.PrettyMIDI(str(args.directory / 'transcribed.mid')))
            print(json.dumps(dict(instrument=instrument, mode=mode, **reports)), flush=True)


if __name__ == '__main__':
    main()
