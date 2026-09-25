"""Regression against the WAV and MIDI captured during the September 25 test."""
import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))
import server


@unittest.skipUnless(all(importlib.util.find_spec(name) for name in ("mido", "soundfile", "numpy")),
                     "audio analysis dependencies are unavailable")
class SyntheticMelodyAccuracyTests(unittest.TestCase):
    def test_observed_vocals_match_source_after_refinement(self):
        import mido

        audio = ROOT / "fixtures" / "synthetic_six_notes.wav"
        midi = mido.MidiFile(ROOT / "fixtures" / "observed_six_notes_stems.mid")
        self.assertEqual((midi.type, len(midi.tracks)), (1, 7))
        vocals = next(track for track in midi.tracks
                      if any(msg.type == "track_name" and msg.name == "Vocals" for msg in track))
        elapsed = 0.0
        events = []
        for message in vocals:
            elapsed += mido.tick2second(message.time, midi.ticks_per_beat, 500000)
            if message.type in {"note_on", "note_off"}:
                events.append((elapsed, message.type, message.note, message.velocity))
        self.assertEqual([event[2] for event in events if event[1] == "note_on"],
                         [60, 65, 67, 67, 67, 72, 72, 72, 72, 67, 67, 60])
        refined = server.refine_clear_melody(events, audio)
        self.assertEqual([event[2] for event in refined if event[1] == "note_on"],
                         [60, 64, 67, 72, 67, 60])
        starts = [event[0] for event in refined if event[1] == "note_on"]
        for actual, expected in zip(starts, (0, .75, 1.5, 2.25, 3., 3.75)):
            self.assertLess(abs(actual - expected), .05)

    def test_build_merged_midi_routes_refinement_into_vocals(self):
        import mido
        import shutil
        import tempfile

        source = ROOT / "fixtures" / "synthetic_six_notes.wav"
        captured = mido.MidiFile(ROOT / "fixtures" / "observed_six_notes_stems.mid")
        vocal_track = next(track for track in captured.tracks
                           if any(msg.type == "track_name" and msg.name == "Vocals" for msg in track))
        with tempfile.TemporaryDirectory() as folder:
            work = Path(folder)
            stems = work / "stems"
            stems.mkdir()
            shutil.copyfile(source, stems / "vocals.wav")
            basic_pitch_output = mido.MidiFile(type=1, ticks_per_beat=captured.ticks_per_beat)
            basic_pitch_output.tracks.append(vocal_track)
            def transcribe(_stem, target):
                basic_pitch_output.save(target)
            with patch.object(server, "transcribe_pitched_stem", side_effect=transcribe):
                result, labels, counts = server.build_merged_midi(stems, work, source, 120)
            self.assertEqual((labels, counts), (["Vocals"], {"Vocals": 6}))
            output = mido.MidiFile(result)
            self.assertEqual([message.note for message in output.tracks[1]
                              if message.type == "note_on" and message.velocity > 0],
                             [60, 64, 67, 72, 67, 60])

    def test_chord_like_source_does_not_override_pitch(self):
        import math
        import struct
        import tempfile
        import wave

        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "chord.wav"
            sr = 22050
            with wave.open(str(source), "wb") as wav:
                wav.setparams((1, 2, sr, 0, "NONE", "not compressed"))
                samples = [int(9000 * (math.sin(2 * math.pi * 330 * i / sr)
                                       + math.sin(2 * math.pi * 440 * i / sr)))
                           for i in range(sr)]
                wav.writeframes(struct.pack("<%dh" % len(samples), *samples))
            events = [(.1, "note_on", 65, 80), (.8, "note_off", 65, 0)]
            self.assertEqual(server.refine_clear_melody(events, source), events)

    def test_separate_repeated_notes_remain_separate(self):
        import math
        import struct
        import tempfile
        import wave

        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "repeated.wav"
            sr = 22050
            with wave.open(str(source), "wb") as wav:
                wav.setparams((1, 2, sr, 0, "NONE", "not compressed"))
                samples = [int(12000 * math.sin(2 * math.pi * 440 * i / sr))
                           if not .47 <= i / sr <= .53 else 0 for i in range(sr)]
                wav.writeframes(struct.pack("<%dh" % len(samples), *samples))
            events = [(.1, "note_on", 69, 80), (.5, "note_off", 69, 0),
                      (.5, "note_on", 69, 80), (.9, "note_off", 69, 0)]
            refined = server.refine_clear_melody(events, source)
            self.assertEqual(sum(event[1] == "note_on" for event in refined), 2)


if __name__ == "__main__":
    unittest.main()
