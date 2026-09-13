# Local Audio Stem / MIDI Pipeline

## Purpose

Music Studio can already import external MIDI as exact Track-ID based unassigned Tracks. This pipeline adds the missing local-only audio path:

`MP3 / WAV / AIFF / CAF / M4A / FLAC / OGG -> Stem separation -> Audio-to-MIDI -> existing External Song Import -> Track Review`

## Local processing boundary

- The browser sends the selected audio only to `http://127.0.0.1:8766`.
- The helper binds only to `127.0.0.1`.
- No Live Provider API or External AI API call is used.
- Input audio and generated temporary stems are created under an OS temporary directory and removed after the response is produced.
- Browser requests require `X-Nova-Audio-Pipeline: 1` and an allowed Music Studio origin.

## Stem separation

The helper uses Demucs `htdemucs_6s` and looks for:

- Vocals
- Drums
- Bass
- Guitar
- Piano
- Other

A missing or silent stem is skipped rather than creating an empty Track.

## Audio-to-MIDI

- Vocals / Bass / Guitar / Piano / Other use Basic Pitch for note transcription.
- Drums use local onset detection and a conservative GM mapping: Bass Drum 36, Snare 38, Closed Hi-Hat 42.
- Tempo is estimated locally from the source audio and written into the merged Type 1 MIDI.
- The resulting MIDI is passed through the existing External Song Import boundary; Music Studio does not invent role assignments automatically.

## Mac startup

`tools/music-audio-pipeline/START_AUDIO_PIPELINE.command` creates a private Python virtual environment on the first run and installs the local processing dependencies. Later runs reuse that environment.

`tools/music-audio-pipeline/STOP_AUDIO_PIPELINE.command` stops the local helper.

The first Demucs processing can download the model if it is not already cached. This is a model/package download, not a Provider or External AI API request.

## Safety and compatibility

- `schemaVersion` remains `1.0`.
- `APP_VERSION` remains `1.4.0`.
- Existing MIDI Import remains unchanged.
- Existing external Track Review / Assignment remains the explicit assignment boundary.
- Existing Track-ID editing, playback, recording, Melody Correction, Quantize, and single-Track export paths are reused after import.
