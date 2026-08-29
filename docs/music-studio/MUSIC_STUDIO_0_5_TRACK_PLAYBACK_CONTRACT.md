# Music Studio 0.5 Track Playback Contract

## Status and scope

This document fixes the PR1 boundary for Music Studio 0.5. It does not add the final three-track transport UI, Mute / Solo UI, GM Drum Map UI, or multi-track recording workflow. No new `MS-xx` identifier is assigned.

## Existing implementation reused

- `music-studio-editor.js` is the source of truth for the three editable parts. `PARTS` defines Melody as channel 1 / program 0, Drums as channel 10 / no program, and Bass as channel 2 / program 32. `normalizeMidiData` and `trackPart` retain imported identifiers and add missing standard parts without replacing unknown tracks.
- `music-studio-audio.js` owns the existing shared Web Audio scheduler. `playTracks(tracks, timing)` schedules all supplied tracks against one PPQ, tempo, start origin, tick range, and AudioContext. It also owns the Drums and Bass sound-path differences. A second scheduler is not introduced.
- `music-studio.js` owns transport orchestration: Play / Stop, playhead animation, tempo, loop range, playback start time, count-in, metronome, and recording lifecycle. The existing Melody entry point remains unchanged in this PR.
- `music-studio-midi.js` and `music-studio-midi-parser.js` remain the Standard MIDI export / import boundaries. Export already excludes `muted: true` tracks; import retains channel, program, note timing, and channel 10 drum detection.
- Version 1 project JSON, IndexedDB, backup, import / export, and duplication already preserve the MIDI track objects. Editor changes use the existing `change` / Undo / Redo path; playback and playhead state do not.

## Common descriptor

`music-studio-playback.js` converts an existing track to the runtime-only descriptor below without mutating the source:

```js
{
  id,
  part,
  role,
  channel,
  program,
  notes,
  muted,
  solo,
  soloEligible
}
```

`id`, `part`, `channel`, `program`, and `notes` are derived from the existing track. `role` is one of `melody`, `drums`, or `bass` when the existing `part` or `id` identifies that role. Notes are cloned and retain their existing fields, including `id`, `pitch`, `startTick`, `durationTicks`, `velocity`, lock state, input metadata, and imported metadata.

The scheduler input is `track -> playback descriptor -> existing audio playTracks`. The audio scheduler receives only active descriptors and therefore does not own Mute / Solo policy.

## Track identity and special cases

- Melody: existing `part: melody` / `id: melody`; normalized default channel 1 and program 0.
- Drums: existing `part: drums` / `id: drums`; normalized default channel 10 and `program: null`. Pitch remains the GM drum note number. Drum sound selection remains inside the audio adapter, not the descriptor or transport.
- Bass: existing `part: bass` / `id: bass`; normalized default channel 2 and program 32. It remains a normal pitched note track. Playback does not apply transpose or octave changes; those belong to explicit editing operations.

No duplicate part / channel catalog is added to the playback module. It consumes the identifiers normalized by the Editor source of truth.

## Mute / Solo policy

- `muted` is already an optional Version 1 track field used by Editor normalization, project round trips, backup, and MIDI export. It remains compatible and no new field is added.
- Runtime `mutedByTrackId` can override the stored value during playback without changing the project.
- `solo` is runtime-only in 0.5 PR1 through `soloByTrackId`. It is not written to Project, settings, or Editor state and does not enter Undo / Redo.
- If at least one eligible, unmuted track is soloed, only those tracks are active. Otherwise every unmuted track is active. Muted always wins over solo.

A later UI PR must make an explicit product decision before persisting Solo or changing the existing Mute persistence behavior. That change must remain optional and Version 1 compatible.

## Transport boundary

`createTransportState(midiData, runtime)` produces runtime state for:

- playing / stopped
- current tick / playhead
- PPQ and BPM
- loop enabled, start, and end
- playback start origin
- active playback track IDs

Transport does not own Melody note data or a Melody-only position. Loop and playhead remain one shared tick timeline. Project-backed count-in / metronome settings remain outside this minimal playback contract.

## Scheduler boundary

`schedulePlaybackTracks(synth, tracks, transportState)` is the common entry point. It applies Mute / Solo selection and delegates to the existing `synth.playTracks` scheduler with PPQ, BPM, start tick, end tick, AudioContext start time, and lead time. The single-track `playNotes` path is retained only as a compatibility fallback.

The scheduler does not edit tracks, notes, Project state, Undo / Redo, loop state, or playhead state. Drums and Bass do not receive separate schedulers.

## Persistence and compatibility

- Project format remains `music-studio-project`.
- Project schema remains Version 1 / `schemaVersion: 1.0`.
- `APP_VERSION` remains `1.4.0`.
- No settings field, IndexedDB version, environment variable, credential, provider, or live API boundary changes.
- Playback descriptors, active selection, Transport snapshots, and Solo state are runtime-only.
