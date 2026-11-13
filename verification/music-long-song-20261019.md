# Whole-song storage and strings continuity — 2026-10-19 JST

Parent: #463 f9fbfc938af7925002bb94d0b7e5fb9fc70c045c. main 552d56eafddfd192970c09f7d6278696cf8775c3. Before product edits, 208 Open Draft PRs #256–463 were retrieved: HEAD/base/mergeability, latest commit metadata, paginated filenames, first-page PR-event workflow runs. All requests succeeded. Search was split by creation dates because the connector caps results at 100. No newer Draft was returned. Historical workflow pagination and old failure logs are not an exhaustive audit. Parent's four PR workflows completed SUCCESS; do not reuse those results for this change.

## Product changes

- Version-2 whole-song persistence stores the original exact MIDI signature once per candidate instead of every bar. The existing source notes, section settings, confirmed chords, source IDs and generation facts remain present.
- Readers support version 1 without rewriting it. Version 2 rejects an embedded per-bar signature, stale parent data, malformed excluded bars and invalid model notes. All-bar validation still occurs before any adoption.
- Planning calculates the source signature once and uses a shallow read-only context view per bar, avoiding repeated full-session cloning (including edit history).
- Preview note lists visit each destination track once; previously each bar appended the entire accumulated destination track again. This fixes quadratic duplication in preview memory, not the underlying per-bar model request count.
- New strings common tones are tied when exactly adjacent, on the same destination and pitch, and velocities differ by at most 8. Existing note IDs and protected/crossing notes are excluded. Ties are calculated after the selected bars are assembled, so partial selection cannot extend outside it.
- Strings velocity advances 35% toward the requested section level per bar instead of staying at the preceding level indefinitely. This is MIDI note-on velocity, not CC automation/crossfade or a new soundfont.
- Existing standalone and embedded loaders use refreshed asset URLs. Real-model browser CI asserts compact persistence and unique preview note IDs at all four widths; its existing audition/adoption/export flow remains.

These are deterministic rule/persistence changes after the existing real ONNX generation. No additional AI model, sample library, live Provider call or source-song rewrite. Piano/bass/drum performance algorithms are unchanged in this increment. This is not 20–30 independent production feature closures.

## Measured long fixture (not an ONNX benchmark)

144 bars, 4/4, 72 BPM, 480 seconds, PPQ480; 576 source notes; 3,748 total notes after full rule materialization/adoption including original tracks. A/B/C JSON 837,493 bytes versus legacy 25,079,605 bytes (96.66% smaller). Backup JSON 1,224,741 bytes. Whole isolated fixture 76,491 ms in this shared Linux environment. Fixture covers plan, persisted A/B/C, full Preview/Apply, original tracks unchanged, save, fresh project reopen and full JSON backup restore. Its model MIDI input is a small fixed SMF reused per bar, NOT 144 bars of actual ONNX inference. It renders no PCM: audioBytes=null. No 8-minute real model generation, full-song WAV/PCM capacity or human musical quality acceptance is claimed. Existing 4,096-note audition cap remains; longer/dense songs require a shorter audition selection.

Focused regression: compact vs legacy identical render; stale/malformed references rejected; unique note IDs in preview; selected strings tied inside range; original tracks unchanged; exact Undo/Redo; candidate metadata version and MIDI preserved through backup. Existing whole-song/performance focused 16/16 PASS. Long-continuity suite 3/3 PASS. Python audio 509 run /504 PASS /5 existing skips; existing ResourceWarnings and deliberate abnormal HTTP logs. Local generation constraints8/transport3/startup4 PASS. Changed JS node --check and git diff --check PASS.

Full Node final result and new-HEAD remote CI are reported in the PR. Local Swift/Xcode, Chrome executable, ONNX weights and Sinsy binaries are absent; remote actual generation/native/browser results must be checked at the new HEAD. Four-bar real CI is not evidence of eight-minute model performance.

## Formal status and remaining work

Current Library original Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, was read in full: five pages/166 lines on 2026-10-19 JST. The 30-row ledger remains A0/B0/C30: no full UI/backend/runtime/storage/restore/policy closure established by this change. No new B inferred from tests.

Next: eight-minute real ONNX sequential generation and interruption/time/memory acceptance, bounded audition/PCM/export comparison, denser-song performance, server-side inference cancellation (Stop currently discards results), sub-bar chord changes, key/chord rebase, four-instrument expression and human listening, HTTPS reconnection and all remaining 30-feature backend/policy/distribution gaps. Physical Intel Mac/iPad operation and real-song listening belong to Tia.

No main/old PR/source MIDI/backup modification, Force push, Ready, Merge, live Provider or unlicensed asset introduction.
