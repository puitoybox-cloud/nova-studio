# Vocal production acceptance — 2026-10-31 JST

Source baseline: PR #551, official HEAD e1ea5c4dcb1b39d5efcce93e13da8200557fc389. Its 26 workflows completed successfully. Local baseline 4b31ae9f36dc7f5f49dc95a5caa4f2532365d0e6 has the identical tree 2d26ee28bab780ee0e6a8955942a47282a2ca0d6. Original worktree was clean; this work uses a separate worktree and independent branch.

Production changes:
- Local Vibrato reduction uses voiced pitch confidence, a local median and user strength 0–1. Short pitch correction segments now use duration-preserving centred resampling; candidate selection, Before/After, atomic adoption and Undo use the existing non-destructive Take editor. Key/MIDI/length correction is bypassed when Vibrato is selected.
- Reference-vocal/Take comparison reads the actual authenticated PCM for both assets, applies saved trim/gain/pitch edits, and measures note-local median pitch cents and voiced onset/offset milliseconds. The reference must be a score-linked vocal. Musical score changes reject it; title-only changes during additive restore are ignored. Timing-edited sources must first be rendered. Audio and MIDI remain unchanged by comparison.
- Comparison UI connects explicitly to MIDI correction preview and separate new Take capture at the existing placement. Neither action overwrites a prior Take. Reports are tied to project snapshot and repository/generation; cancellation, unsaved edits and changed score fail closed. Reports are recalculated after reopen/restore rather than serialized as authoritative measurements.
- Standalone/host Studio cache 1.4.222 and host-loader 1.5.99 ensure updated source selection.

Completed stable IDs (4): MS13-A02, MS15-A02, MS15-A03, MS15-A04. Evidence is the exact named tests and source/runtime hashes in music-macless-node-summary.json, validated by scripts/music-macless-ledger.py. A=135, verified=49, remaining=86, acceptance=36.30%. Remaining triage: implementation=3, existing acceptance incomplete=20, C-dependent=63. B=30 and C=18 remain open. Requirements were not added, removed or reworded.

Acceptance details:
- Synthetic vibrato-bearing PCM is processed and measured again: output pitch spread is reduced; duration and original bytes remain unchanged. Exact Undo/Redo, fresh repository reopen and Full WAV Archive rendered bytes agree. Strength validation, silence/steady pitch/note jumps, cancel and atomic save failure are covered.
- Independently encoded reference/Take WAVs differ by 50 cents and 80ms. Detector differences are checked against those known inputs. Fresh reopen and additive complete restore produce the same comparison. Silence yields unavailable fields, not a perfect score. Changed score, self-reference, unsaved edits and late cancellation reject.
- Comparison action invokes the real correction-preview entry. New capture saves a third Take without changing either source; fresh reopen and full restore retain all three.

Limits: monophonic voiced analysis, 80ms window / 40ms hop, nearest note association; ambiguous adjacent equal-pitch windows are unavailable. These are acoustic voiced bounds, not phoneme/lyric onset certification. PCM editor capacity remains 125 seconds and 512 correction candidates; select a shorter range if necessary. Granular/local resampling is not formant-preserving professional vocal quality certification; physical Mac/listening acceptance is still open. No paid API or model/weight/license decision was made.

Decision inventory and the 63 A dependency mapping: docs/music-studio/MACLESS_DECISIONS_20261031.md. Next implementation: MS24-A02 global performance diagnosis, MS24-A03 safe reduction, MS28-A03 natural-language screen guidance. Existing-path acceptance 20 items also remains open pending its specific evidence.

Regression contrast: all seven new comparison/Vibrato tests fail against unchanged PR #551 source (same initial tree); all seven pass with this production source. The baseline run used a separate temporary CWD and never replaced the working or protected source.

Validation: complete Node suite 2774 passed, 0 failed/cancelled/skipped; duration 199957.224636ms. Auto-Finish helper 22 passed. Entry/cache focused suite 82 passed. Named comparison/Vibrato acceptance is included in that complete Node run. Whitespace and ledger hash validation passed.
