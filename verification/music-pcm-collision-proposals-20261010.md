# PCM proposals and real audio relationships — 2026-10-10 JST

Source checkpoint: #364, efd2157729eadbfa9cd6fbbb2ac2e3af072c8a8a. Current main 552d56eafddfd192970c09f7d6278696cf8775c3. 111 Open PRs / 109 Draft independently retrieved with all details and first up-to-100 commits/files/exact-head workflow runs; no request failures. Older pagination/all historic logs not exhaustive. Base exact-head workflow 37945847440 software/native SUCCESS; decoded logs independently read.

## Actual production work

- Short PCM now uses the same measured RMS/peak/clipping/crest/dynamics/approximate 200/2000Hz bands and local proposal rules as long streamed WAV. Measures candidate audio before exposing selection.
- Combined Gain/EQ/Compression previews support real A/B playback and individual setting selection. Changed settings are built on a copy and committed with one compare-and-put. Original PCM, MIDI, unknown fields and other assets remain unchanged. Existing per-setting histories provide Undo/Redo; this increment does not add combined-history Undo. JSON, backups and processed WAV use existing production persistence/export.
- Real saved PCM and authenticated streamed WAV are compared using whole-asset band-energy overlap and signed RMS differences. Vocal identity requires explicit user selection. No MIDI-only acoustic measurement, timing alignment, mixed-output clipping or speech/perceptual verdict is claimed. Vocal warning uses visible editing criteria (<3dB margin and >0.3 middle-band overlap). Whole-asset overlap is a risk indicator, not a masking test.
- After relationship analysis, overlapping non-vocal assets can receive a third measured proposal (3dB attenuation and a 3dB cut in the most overlapping approximate band), using existing PCM/WAV A/B and Save paths. No learned model or ideal-mix claim.
- Cancellation invalidates analysis and pending saves. Stale project/repository/selection, quota, corrupt input/binary, saturated candidate, silence and history limits fail closed. Long files keep bounded decoding/DSP; no complete Float array is introduced.

## Verification

13 new short-PCM tests cover independent sine RMS, distinct proposals/outputs, playback buffers, partial/full adoption, one-CAS save, per-control Undo/Redo, JSON/backup roundtrip, original/MIDI/other-asset preservation, quota/history-capacity rollback, real vocal margin/energy overlap, silence/separated bands, cancellation, storage conflict, corruption/clipping, tampering and missing audio. Two new authenticated long-WAV tests cover cross-format relationships, streamed third-candidate playback/save and corrupt/cancel rejection.

Full final Node, Python, syntax, whitespace and exact-head CI results are recorded in the new PR body after publication. Python local 508 run / 503 PASS / five existing skips. Syntax: 181 JS, 53 Python, five shell scripts PASS. Initial full suite exposed only an obsolete cache-version assertion, corrected to the new production cache key; no tests removed or weakened. Final suite rerun required.

Browser 1440/820/390, Console error/warn and browser external requests UNVERIFIED: existing Playwright cannot launch because Chromium executable is absent. No download/install performed. Swift and unsigned macOS/iPad builds require new exact-head GitHub Actions; local Swift/Xcode unavailable. Test doubles do not prove audible playback or physical restart durability. No live provider calls made.

## Specification and completion

Current Music_Studio_最終機能仕様書_v1.pdf (confirmed 2026-09-30) read completely, five pages / 166 extracted lines, on 2026-10-10 JST. No.18 lists Volume/EQ/Compression/spatial/collision/vocal audibility/multiple Mix comparisons. Actual PCM proposal binding and approximate audio-relationship comparison gaps are closed, but spatial processing, aligned/perceptual audibility acceptance and learned-model processing remain incomplete. No.18 is not formally complete.

Global software %, physical-test readiness %, percentage delta and exact remaining-subrequirement count cannot be confirmed: no fully evidenced common denominator/current exhaustive acceptance audit. This change adds zero formal A completions; previous recorded formal A 0/30 is historical, not a fresh global audit. Do not describe global software as 100%.

Physical checks: Intel Mac/iPad A/B audibility, permission/latency, restart persistence, large-file memory/quota, concurrent tabs, processed download/archive recovery and native package acceptance; existing Intel Mac Audio-to-MIDI accuracy also remains outstanding. Next priorities: aligned audio collision/vocal analysis and spatial processing, then external dependency binary backup/recovery. No Ready/Merge/Auto Merge/force/main/existing PR mutation, signing, installs or sales.
