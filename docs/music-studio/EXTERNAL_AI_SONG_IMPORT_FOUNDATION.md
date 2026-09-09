# External AI Song Import Foundation

## Scope

This foundation adds a provider-neutral boundary for user-supplied external songs. The editor exposes that boundary through a separate compact External Song Import entry; it does not call an AI service or alter Logic Pro projects.

- MIDI input reuses the existing independent SMF Type 0/1 parser and Version 1 conversion.
- Every imported MIDI track keeps a source-derived unique Track ID and enters with `roleAssignment: "unassigned"`.
- Names, MIDI channel 10, Program Change, or track order do not promote an external track to Melody, Drums, or Bass.
- Track Registry validation rejects duplicate, missing, blank, and non-string Track IDs before project creation.
- Editor normalization adds the existing empty Melody, Drums, and Bass compatibility tracks without deleting, reordering, or promoting imported tracks.
- All MIDI export includes additional imported tracks; part exports retain the existing Melody, Drums, and Bass behavior.

## Editor UI connection

- Selecting a `.mid` or `.midi` file calls `MusicStudioExternalSongImport.prepareMidiImport(...)`; parsing and assignment policy are not duplicated in the UI.
- A new Version 1 project is persisted only after parsing, Track Registry validation, summary validation, and project validation succeed.
- The result displays file name, MIDI type, total and playable track counts, note count, initial BPM, time signature, and the unassigned status.
- The existing MIDI Import and Logic Pro MIDI Import remain independent and retain their prior behavior.

## External Track Review / Assignment

- The editor lists each external Track carrying an explicit `roleAssignment`, including Track ID, name, MIDI channel, optional Program, note count, and current assignment.
- The user may draft Unassigned, Melody, Drums, or Bass and must choose Apply Assignment before project data changes. Cancel discards the draft.
- Assignment changes only the external Track's optional `roleAssignment`; Track ID, notes, channel, Program, ordering, and the three fixed compatibility Tracks remain unchanged.
- One external Track per assigned role is accepted. Duplicate roles, unknown Track IDs, invalid roles, and invalid Track Registry data reject the complete Apply operation without partial mutation.
- The fixed Editor tabs still resolve by `part`, so assignment metadata does not make an external Track directly editable in this change. Dynamic Track UI is a separate future boundary.
- Normalization and All MIDI Export treat every explicit external assignment as metadata and do not heuristically promote or duplicate that Track.

## Audio boundary

WAV, MP3, AIFF, CAF, M4A, FLAC, and OGG intake creates a metadata-only descriptor. It does not read or retain the body or path and returns `awaiting-audio-processing`. A future implementation may attach stem separation, Audio-to-MIDI, and explicit track review behind `nextBoundary`; none of those stages run in this change.

The editor UI accepts MIDI only in this stage. Audio UI intake remains deferred.

Audio bytes and paths are not inserted into `music-studio-project`. The existing `schemaVersion: 1.0` and `APP_VERSION: 1.4.0` remain unchanged.

## Compatibility boundary

The existing Logic Pro MIDI import keeps its prior suggestion policy. The new external-song MIDI entry requests the parser's `explicit-only` assignment policy, so existing saved data and existing import behavior do not migrate. Project JSON, IndexedDB, backup, reload, Editor, Playback, and Standard MIDI File writer continue using their existing Version 1 structures.
