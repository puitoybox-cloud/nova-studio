#!/usr/bin/env python3
"""Local-only Music Studio audio stem separation and Audio-to-MIDI helper.

Binds to 127.0.0.1 only. Audio is written to a temporary directory, processed
locally, returned as a merged Type 1 MIDI file, then deleted with the temp tree.
"""
from __future__ import annotations

import base64
import importlib.util
import json
import math
import os
import shutil
import subprocess
import sys
import threading
import tempfile
import traceback
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8766
MAX_BYTES = 500 * 1024 * 1024
ALLOWED_EXTENSIONS = {".wav", ".wave", ".mp3", ".aif", ".aiff", ".caf", ".m4a", ".flac", ".ogg"}
ALLOWED_ORIGINS = {
    "http://127.0.0.1:8765",
    "http://localhost:8765",
    "https://puitoybox-cloud.github.io",
}
PROCESS_LOCK = threading.Lock()  # Demucs and Basic Pitch may exhaust RAM if run concurrently.
STEM_PROGRAMS = {
    "Vocals": 53,
    "Bass": 33,
    "Piano": 0,
    "Guitar": 25,
    "Other": 89,
}
STEM_CHANNELS = {
    "Vocals": 0,
    "Bass": 1,
    "Piano": 2,
    "Guitar": 3,
    "Other": 4,
    "Drums": 9,
}


def safe_name(raw: str) -> str:
    value = Path(urllib.parse.unquote(raw or "audio-input").replace("\\", "/")).name
    value = "".join(ch for ch in value if ch.isalnum() or ch in " ._-()[]")[:180].strip()
    return value or "audio-input.wav"


def estimate_bpm(path: Path) -> float:
    import librosa
    import numpy as np

    y, sr = librosa.load(str(path), sr=22050, mono=True)
    if y.size == 0:
        return 120.0
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    values = np.asarray(tempo).reshape(-1)
    bpm = float(values[0]) if values.size else 120.0
    if not math.isfinite(bpm) or bpm < 40 or bpm > 240:
        bpm = 120.0
    return round(bpm, 3)


def run_demucs(source: Path, output_dir: Path) -> Path:
    command = [
        sys.executable,
        "-m",
        "demucs.separate",
        "-n",
        "htdemucs_6s",
        "-o",
        str(output_dir),
        str(source),
    ]
    subprocess.run(command, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=60 * 60)
    candidates = [path.parent for path in output_dir.rglob("vocals.wav")]
    if not candidates:
        raise RuntimeError("Stem分離結果を確認できませんでした。Demucs htdemucs_6sの出力がありません。")
    return candidates[0]


def transcribe_pitched_stem(stem_path: Path, midi_path: Path) -> None:
    from basic_pitch.inference import predict

    _, midi_data, _ = predict(str(stem_path))
    midi_data.write(str(midi_path))


def extract_note_events(midi_path: Path):
    import mido

    source = mido.MidiFile(str(midi_path))
    tempo = 500000
    elapsed = 0.0
    events = []
    for message in mido.merge_tracks(source.tracks):
        elapsed += mido.tick2second(message.time, source.ticks_per_beat, tempo)
        if message.type == "set_tempo":
            tempo = message.tempo
        elif message.type in {"note_on", "note_off"}:
            events.append((elapsed, message.type, int(message.note), int(getattr(message, "velocity", 0))))
    return events


def refine_clear_melody(events, source_path: Path):
    """Correct and join fragments only where the original audio has a clear single tone.

    A mixture with chords, percussion, or a strong harmonic spectrum is left to
    Basic Pitch. This conservative check is useful when stem separation changes
    the fundamental or Basic Pitch splits one continuous tone into several notes.
    """
    import numpy as np
    import soundfile as sf

    try:
        channels, sr = sf.read(str(source_path), dtype="float32", always_2d=True)
        audio = np.mean(channels, axis=1)
    except (RuntimeError, ValueError):
        # Some supported containers require the runtime's librosa decoder.
        import librosa
        audio, sr = librosa.load(str(source_path), sr=22050, mono=True)
    if len(audio) == 0:
        return events

    notes = []
    active = {}
    for time, kind, pitch, velocity in events:
        key = int(pitch)
        if kind == "note_on" and velocity > 0:
            active.setdefault(key, []).append((float(time), int(velocity)))
        elif key in active and active[key]:
            start, strength = active[key].pop(0)
            if time > start:
                notes.append([start, float(time), key, strength])
    if not notes:
        return events

    def reference_pitch(start, end):
        center = (start + end) / 2
        width = min(0.18, end - start)
        if width < 0.075:
            return None
        left = max(0, int((center - width / 2) * sr))
        segment = audio[left:min(len(audio), left + max(1, int(width * sr)))]
        if len(segment) < int(0.075 * sr):
            return None
        segment = segment - np.mean(segment)
        power = float(np.sum(segment * segment))
        if power < len(segment) * 1e-7:
            return None
        # A window reduces spectral leakage at note edges. Require the strongest
        # peak to explain almost all power: chords and harmonic instruments fail.
        windowed = segment * np.hanning(len(segment))
        spectrum = np.abs(np.fft.rfft(windowed, n=65536)) ** 2
        frequencies = np.fft.rfftfreq(65536, d=1 / sr)
        band = (frequencies >= 80) & (frequencies <= 1800)
        indices = np.flatnonzero(band)
        peak = indices[np.argmax(spectrum[band])]
        frequency = frequencies[peak]
        midi_pitch = round(69 + 12 * math.log2(frequency / 440))
        if not 24 <= midi_pitch <= 96:
            return None
        # Measure the fraction of energy near the peak on the original waveform.
        # The high threshold deliberately excludes chords and complex timbres.
        nearby = (frequencies >= frequency - 12) & (frequencies <= frequency + 12)
        if float(np.sum(spectrum[nearby])) / float(np.sum(spectrum[band])) < 0.85:
            return None
        return midi_pitch

    def continuous_at(boundary):
        def rms(start, end):
            chunk = audio[max(0, int(start * sr)):min(len(audio), int(end * sr))]
            return float(np.sqrt(np.mean(chunk * chunk))) if len(chunk) else 0.0
        before = rms(boundary - 0.06, boundary - 0.03)
        after = rms(boundary + 0.03, boundary + 0.06)
        middle = rms(boundary - 0.009, boundary + 0.009)
        return min(before, after) > 1e-4 and middle >= 0.65 * min(before, after)

    for note in notes:
        detected = reference_pitch(note[0], note[1])
        if detected is not None and abs(detected - note[2]) <= 2:
            note[2] = detected
    notes.sort(key=lambda note: (note[0], note[2]))
    merged = []
    for note in notes:
        if (merged and merged[-1][2] == note[2]
                and -0.02 <= note[0] - merged[-1][1] <= 0.03
                and continuous_at((note[0] + merged[-1][1]) / 2)):
            merged[-1][1] = max(merged[-1][1], note[1])
        else:
            merged.append(note[:])
    result = []
    for start, end, pitch, velocity in merged:
        result.extend(((start, "note_on", pitch, velocity), (end, "note_off", pitch, 0)))
    return sorted(result, key=lambda event: (event[0], event[1] == "note_on"))


def drum_events(stem_path: Path):
    import librosa
    import numpy as np

    y, sr = librosa.load(str(stem_path), sr=22050, mono=True)
    if y.size == 0:
        return []
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr, units="frames", backtrack=False)
    if len(onset_frames) == 0:
        return []
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    rms = librosa.feature.rms(y=y)[0]
    result = []
    for frame in onset_frames:
        idx = min(int(frame), len(centroid) - 1, len(rms) - 1)
        c = float(centroid[idx]) if len(centroid) else 0.0
        energy = float(rms[idx]) if len(rms) else 0.0
        if c >= 4500:
            note = 42  # closed hi-hat
        elif c >= 1800:
            note = 38  # acoustic snare
        else:
            note = 36  # bass drum
        velocity = max(35, min(127, int(45 + energy * 900)))
        seconds = float(librosa.frames_to_time(frame, sr=sr))
        result.append((seconds, "note_on", note, velocity))
        result.append((seconds + 0.06, "note_off", note, 0))
    return result


def write_track(output, name: str, events, bpm: float, program: int | None, channel: int):
    import mido

    track = mido.MidiTrack()
    output.tracks.append(track)
    track.append(mido.MetaMessage("track_name", name=name, time=0))
    if program is not None and channel != 9:
        track.append(mido.Message("program_change", program=program, channel=channel, time=0))
    absolute_tick = 0
    for seconds, kind, note, velocity in sorted(events, key=lambda item: (item[0], 0 if item[1] == "note_off" else 1)):
        target_tick = max(0, round(seconds * output.ticks_per_beat * bpm / 60.0))
        delta = max(0, target_tick - absolute_tick)
        absolute_tick = target_tick
        track.append(mido.Message(kind, note=max(0, min(127, note)), velocity=max(0, min(127, velocity)), channel=channel, time=delta))


def build_merged_midi(stem_dir: Path, work_dir: Path, source: Path, bpm: float) -> tuple[Path, list[str], dict[str, int]]:
    import mido

    output = mido.MidiFile(type=1, ticks_per_beat=480)
    meta = mido.MidiTrack()
    output.tracks.append(meta)
    meta.append(mido.MetaMessage("track_name", name="Music Studio Audio Pipeline", time=0))
    meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(bpm), time=0))
    meta.append(mido.MetaMessage("time_signature", numerator=4, denominator=4, time=0))

    generated = []
    counts = {}
    source_stems = [
        ("Vocals", "vocals.wav"),
        ("Drums", "drums.wav"),
        ("Bass", "bass.wav"),
        ("Guitar", "guitar.wav"),
        ("Piano", "piano.wav"),
        ("Other", "other.wav"),
    ]

    for label, filename in source_stems:
        stem_path = stem_dir / filename
        if not stem_path.exists() or stem_path.stat().st_size <= 44:
            continue
        if label == "Drums":
            events = drum_events(stem_path)
        else:
            midi_path = work_dir / f"{label.lower()}.mid"
            transcribe_pitched_stem(stem_path, midi_path)
            events = extract_note_events(midi_path)
            if label == "Vocals":
                events = refine_clear_melody(events, source)
        note_count = sum(1 for event in events if event[1] == "note_on" and event[3] > 0)
        if note_count == 0:
            continue
        write_track(output, label, events, bpm, STEM_PROGRAMS.get(label), STEM_CHANNELS[label])
        generated.append(label)
        counts[label] = note_count

    if not generated:
        raise RuntimeError("分離されたStemからMIDIノートを生成できませんでした。")

    output_path = work_dir / f"{source.stem}_stems.mid"
    output.save(str(output_path))
    return output_path, generated, counts


def process_audio(source: Path, work_dir: Path):
    bpm = estimate_bpm(source)
    stems_root = run_demucs(source, work_dir / "demucs")
    midi_path, stems, note_counts = build_merged_midi(stems_root, work_dir, source, bpm)
    return {
        "ok": True,
        "version": 1,
        "localOnly": True,
        "bpm": bpm,
        "stems": stems,
        "noteCounts": note_counts,
        "midiFileName": midi_path.name,
        "midiBase64": base64.b64encode(midi_path.read_bytes()).decode("ascii"),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "NovaMusicAudioPipeline/1.0"

    def _origin(self):
        return self.headers.get("Origin", "")

    def _cors(self):
        origin = self._origin()
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Nova-Audio-Pipeline, X-Nova-File-Name")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")

    def _json(self, status: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if self._origin() and self._origin() not in ALLOWED_ORIGINS:
            self._json(403, {"ok": False, "message": "Originを許可していません。"})
            return
        self._json(204, {})

    def do_GET(self):
        if self.path != "/health":
            self._json(404, {"ok": False, "message": "Not found"})
            return
        self._json(200, {
            "ok": True,
            "version": 1,
            "localOnly": True,
            "host": HOST,
            "port": PORT,
            "python": sys.version.split()[0],
            "demucs": importlib.util.find_spec("demucs") is not None,
            "basicPitch": importlib.util.find_spec("basic_pitch") is not None,
        })

    def do_POST(self):
        if self.path != "/process":
            self._json(404, {"ok": False, "message": "Not found"})
            return
        if self._origin() and self._origin() not in ALLOWED_ORIGINS:
            self._json(403, {"ok": False, "message": "Originを許可していません。"})
            return
        if self.headers.get("X-Nova-Audio-Pipeline") != "1":
            self._json(403, {"ok": False, "message": "Music Studioのローカル処理要求ではありません。"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BYTES:
            self._json(413, {"ok": False, "message": "音声ファイルは500 MiB以下にしてください。"})
            return
        filename = safe_name(self.headers.get("X-Nova-File-Name", "audio-input"))
        if Path(filename).suffix.lower() not in ALLOWED_EXTENSIONS:
            self._json(415, {"ok": False, "message": "対応する音声形式ではありません。"})
            return
        if not PROCESS_LOCK.acquire(blocking=False):
            self._json(409, {"ok": False, "busy": True, "message": "別の音声を処理中です。完了後に再試行してください。"})
            return
        try:
            with tempfile.TemporaryDirectory(prefix="nova-music-audio-") as temp:
                work_dir = Path(temp)
                source = work_dir / filename
                remaining = length
                with source.open("wb") as handle:
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise RuntimeError("音声ファイルの受信が途中で終了しました。")
                        handle.write(chunk)
                        remaining -= len(chunk)
                payload = process_audio(source, work_dir)
                self._json(200, payload)
        except subprocess.TimeoutExpired:
            self._json(504, {"ok": False, "message": "Stem分離が60分以内に完了しませんでした。"})
        except Exception as error:
            traceback.print_exc()
            self._json(500, {"ok": False, "message": str(error)})
        finally:
            PROCESS_LOCK.release()

    def log_message(self, format, *args):
        print(f"[Nova Audio Pipeline] {self.address_string()} - {format % args}")


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("Nova Music Studio Audio Pipeline")
    print(f"Local endpoint: http://{HOST}:{PORT}")
    print("Audio never leaves this Mac through this helper.")
    print("First Demucs processing may download its model if it is not already cached.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
