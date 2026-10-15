# Project-local PCM instrument production — 2026-10-15 JST

Parent: PR #427 / 48912060821046652cbde9adeff337f7140ae7bc. Main read as 552d56eafddfd192970c09f7d6278696cf8775c3. All 174 Open Draft PR details (HEAD/base/mergeability) and exact-head check runs re-read; conflicts #10 and #35 left untouched. No newer Open PR than #427. Parent has eight successful check jobs across six workflows.

## Implementation

- Bind an existing saved PCM asset to the selected exact MIDI Track with a manually declared root note.
- Select or clear the binding through the compact Sound（音源）menu. PCM import remains in Mix; samples must be <=10 seconds, mono/stereo and unclipped after saved mix processing.
- Preserve source samples and MIDI note/program/channel identities; binding records only asset ID and root pitch.
- Undo/Redo, normal autosave, explicit MIDI save, reopen and JSON backup restore retain the binding and source PCM.
- Route actual BufferSource playback through velocity gain and master output, with semitone playback-rate transposition, natural sample end, note-off release and Stop cancellation.
- Shared scheduler preserves the binding after mute/solo filtering and tempo/range scheduling. Clipped-start playback offsets into the sample.
- Use the bound instrument for MIDI monitor, piano-key preview and vocal accompaniment, including the existing appended continuous recording cycles.
- Missing samples remain silent and are exposed in scheduler diagnostics/editor status rather than silently substituting an oscillator.
- Validate bindings and sample format/limits; preserve source PCM via defensive copies. Update host/standalone cache versions together.

## Verification and limits

Focused audio/playback/host/entry tests: 88 PASS. Restore/version corrections: 58 PASS. Production instrument tests: 3 PASS, including actual saveMidiEditor -> repository get -> reopened edit -> backup -> restoreBackup -> repository get equality. Complete Node suite and Python suite running at initial publication; final result will be recorded in the PR. JavaScript syntax and whitespace checked before publication.

Local Chromium was unavailable; download returned an invalid/truncated archive. Added actual browser/IndexedDB/Web Audio/viewport integration to the existing exact-head CI. Viewport success is pending CI; physical Safari/iPad/microphone/MIDI acceptance is unverified.

No real instrument sample pack exists in the inspected repository (only synthetic WAV fixtures). This connects user-imported short PCM and does not provide an acoustic instrument library, multisampling, SF2, loop points, model inference, AI composition runtime or AI vocal synthesis. AI generation remains incomplete. Formal No.1–30 remain C (A0/B0/C30), carried forward conservatively; completion percentage cannot be confirmed. This scoped implementation does not meet 20–30 substantive feature items.

No main/existing PR modification, force push, Ready/Merge/Auto Merge, Live Provider API calls, or original-data deletion.
