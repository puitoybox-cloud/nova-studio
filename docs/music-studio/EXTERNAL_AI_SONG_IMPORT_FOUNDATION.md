# External AI Song Import Foundation

## Scope

This foundation adds a provider-neutral boundary for user-supplied external songs. It does not call an AI service, alter Logic Pro projects, or add a new editor UI.

- MIDI input reuses the existing independent SMF Type 0/1 parser and Version 1 conversion.
- Every imported MIDI track keeps a source-derived unique Track ID and enters with `roleAssignment: "unassigned"`.
- Names, MIDI channel 10, Program Change, or track order do not promote an external track to Melody, Drums, or Bass.
- Track Registry validation rejects duplicate, missing, blank, and non-string Track IDs before project creation.
- Editor normalization adds the existing empty Melody, Drums, and Bass compatibility tracks without deleting, reordering, or promoting imported tracks.
- All MIDI export includes additional imported tracks; part exports retain the existing Melody, Drums, and Bass behavior.

## Audio boundary

WAV, MP3, AIFF, CAF, M4A, FLAC, and OGG intake creates a metadata-only descriptor. It does not read or retain the body or path and returns `awaiting-audio-processing`. A future implementation may attach stem separation, Audio-to-MIDI, and explicit track review behind `nextBoundary`; none of those stages run in this change.

Audio bytes and paths are not inserted into `music-studio-project`. The existing `schemaVersion: 1.0` and `APP_VERSION: 1.4.0` remain unchanged.

## Compatibility boundary

The existing Logic Pro MIDI import keeps its prior suggestion policy. The new external-song MIDI entry requests the parser's `explicit-only` assignment policy, so existing saved data and existing import behavior do not migrate. Project JSON, IndexedDB, backup, reload, Editor, Playback, and Standard MIDI File writer continue using their existing Version 1 structures.
