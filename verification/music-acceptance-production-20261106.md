# PR #597 production acceptance audit

Date: 2026-11-06 JST. Baseline PR #596: `24a926fa55a6b12479be89749ef8a96acae8eac6`, 14/14 GitHub Actions successful. Runtime under test: `fd393f19cf7d4c7fc709d178770ec55335ce7fde`.

## Production change

Workspace mode, favorites and visibility writes called requestPaint even while an unadopted lyric candidate or checkpoint transaction was active. The shared busy predicate now rejects these writes, and production navigation saves, before storage or repaint. Completion also checks the current busy state, retaining lyrics, checkpoints and MIDI edits that arrive during a settings write. The new regressions fail on the immutable baseline and pass on the changed source. No audio algorithm, tolerance or acceptance requirement changed.

## Remaining validation requirements

| ID | Existing implementation / evidence | Missing full acceptance evidence |
|---|---|---|
| MS12-A02 | Vocal journal, PCM and encoded crash browser scripts, Punch/Cycle persistence tests | Long recording interruption combined with Punch/Cycle and lyric synchronization across every save/restore entrance |
| MS18-A02 | PCM mix, durable MIDI stems, Take/WAV and Auto-Finish routes | One whole-song mixed-format run proving every supported input format, placement, output and saved restart |
| MS22-A04 | IndexedDB crash/retry matrix; atomic MIDI import; deletion crash tests; checkpoint browser | Every production save entrance mapped to before-commit termination and uncertain committed-result/retry, with binary and history equality |
| MS28-A02 | Workspace browser at four widths; this change adds 15 editing/busy states × 10 actions | Complete DOM transitions including all AI candidates, save entrances and combined editing states |
| MS28-A04 | Existing explicit destination focus and responsive tests | Full keyboard-only Tab/reverse Tab/Enter/Escape, modal focus return and automated accessibility coverage across production screens |
| MS30-A02 | IndexedDB SIGKILL/retry checks for day/session, materials, AI creation, duplication, binary recovery, checkpoints, PCM/WAV and lyric Apply | Every remaining special save entrance including uncertain completion must preserve Session/day links with exactly one durable history receipt |
| MS30-A03 | Finished snapshot and fork tests | Immutable finished snapshot across every mutation entrance; negative and failure cases |

MS22-A02 audible A/B was already verified. Its actual HTMLAudioElement/OfflineAudioContext browser suite is rerun for the changed runtime; playback does not substitute for physical listening acceptance.

The IndexedDB script currently terminates real Chromium before commit for runAutoBackupCheck, createAIProject, duplicateProject, materialCreate, versionSave, versionApply/Undo/Redo, pcmApply, pcmImportLongFile, saveLyricsAssignment, productionSessionSave, recoverMissingBinary, materialCapture/Import and productionDaySave. This is useful coverage, not an exhaustive save-entrance inventory. Uncovered examples requiring separate source-to-browser mapping include whole-song transpose, external track reassignment, instrument commits, harmony adoption and arrangement commits. The number of textual repository-write call sites is not a count of UI entrances.

## Decision-dependent review

All 63 remaining decision-dependent A requirements still reference 18 open C contracts. Their acceptance includes unspecified quality thresholds, model/provider identity, distribution permission, Cloud Sync conflict policy or external integration contracts. Common storage, cancellation and navigation protections can improve without choosing a model; their presence does not fulfill the entire dependent requirement. No dependency was removed and no threshold was weakened.

No new verified ID is claimed by this patch. The formal denominator remains 135, verified 65, open 70 (48.15%).

## Final runtime validation

Local full regression: 2,916 passed, zero failed/cancelled/skipped; focused navigation/workspace: 34 passed; helper: 22 passed. Five new regressions fail against PR #596. Exact-runtime IndexedDB (42224666984), audible A/B (42224667137), checkpoint/PCM/MediaRecorder recovery (42224667204) passed. Latest workspace browser (42224666953) remains behind font installation as of this registration; only the preceding runtime has a completed four-width matrix, and the added late-state cases have Node evidence until the latest browser step succeeds. Final-head CI is separate from this exact-runtime evidence.
