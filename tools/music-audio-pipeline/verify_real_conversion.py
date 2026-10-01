#!/usr/bin/env python3
"""CI diagnostic: run actual Demucs and Basic Pitch on the captured WAV."""
import base64
import hashlib
import json
import sys
import tempfile
from pathlib import Path

import mido
import server


def main(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    source = Path(__file__).with_name("fixtures") / "synthetic_six_notes.wav"
    report = {"sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
              "helperSourceDigest": server.SOURCE_DIGEST,
              "pipelineRevision": server.PIPELINE_REVISION}
    try:
        with tempfile.TemporaryDirectory(prefix="nova-real-audio-test-") as temporary:
            payload = server.process_audio(source, Path(temporary))
        midi_bytes = base64.b64decode(payload["midiBase64"])
        midi_path = output_dir / "actual_stems.mid"
        midi_path.write_bytes(midi_bytes)
        midi = mido.MidiFile(midi_path)
        report["bpm"] = payload["bpm"]
        report["noteCounts"] = payload["noteCounts"]
        report["tracks"] = {}
        for track in midi.tracks:
            name = next((message.name for message in track if message.type == "track_name"), "unnamed")
            elapsed = 0.0
            active = {}
            notes = []
            tempo = mido.bpm2tempo(payload["bpm"])
            for message in track:
                elapsed += mido.tick2second(message.time, midi.ticks_per_beat, tempo)
                if message.type == "note_on" and message.velocity > 0:
                    active.setdefault(message.note, []).append(elapsed)
                elif message.type in ("note_on", "note_off") and hasattr(message, "note"):
                    starts = active.get(message.note, [])
                    if starts:
                        notes.append({"pitch": message.note, "start": round(starts.pop(0), 3),
                                      "end": round(elapsed, 3)})
            report["tracks"][name] = sorted(notes, key=lambda note: note["start"])
        actual = [note["pitch"] for note in report["tracks"].get("Vocals", [])]
        report["expectedVocals"] = [60, 64, 67, 72, 67, 60]
        report["actualVocals"] = actual
        report["passed"] = actual == report["expectedVocals"]
    except Exception as error:
        report["passed"] = False
        report["error"] = f"{type(error).__name__}: {error}"
    finally:
        (output_dir / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False))
        print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["passed"] else 1


if __name__ == "__main__":
    sys.exit(main(Path(sys.argv[1])))
