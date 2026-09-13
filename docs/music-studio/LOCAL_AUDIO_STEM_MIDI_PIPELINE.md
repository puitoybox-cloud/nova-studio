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

Routine use is designed to avoid Terminal.

The repository contains a macOS helper app packaging workflow. It builds `Nova Music Audio Helper.app`, bundles the local pipeline source, and produces a downloadable ZIP artifact.

On launch, the app:

1. copies the bundled pipeline into `~/Library/Application Support/Nova Music Audio Helper/pipeline`;
2. creates or reuses a private Python virtual environment;
3. installs or repairs the local-only dependencies, including `setuptools<82` compatibility for `pkg_resources`;
4. starts the helper on `127.0.0.1:8766`;
5. confirms `/health` reports the Nova local-only helper;
6. opens Music Studio in Chrome.

If the helper is already healthy, the app simply opens Music Studio. It does not open Terminal.

`tools/music-audio-pipeline/START_AUDIO_PIPELINE.command` and `STOP_AUDIO_PIPELINE.command` remain developer/fallback helpers and are not intended as the normal day-to-day user path.

The first Demucs processing can download the model if it is not already cached. This is a model/package download, not a Provider or External AI API request. The selected song audio is not sent to the model source.

## macOS packaging

`.github/workflows/music-audio-helper-macos.yml` packages the app on macOS, validates `Info.plist`, ad-hoc signs the bundle, verifies the signature, and uploads `Nova-Music-Audio-Helper-macOS.zip` as a workflow artifact.

## Safety and compatibility

- `schemaVersion` remains `1.0`.
- `APP_VERSION` remains `1.4.0`.
- Existing MIDI Import remains unchanged.
- Existing external Track Review / Assignment remains the explicit assignment boundary.
- Existing Track-ID editing, playback, recording, Melody Correction, Quantize, and single-Track export paths are reused after import.
