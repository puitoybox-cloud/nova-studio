# New project and duplicate publication safety — 2026-11-04 JST

Baseline: Draft PR #584, `3d20562e6d838f1552b5b2d79586f30025a59f81`, tree `7a5cdc995673d2ad1fbb72a3ca7e4c40f471c4a7`. GitHub API confirmed the draft remained open and 18/18 returned check runs succeeded. This counts check runs rather than the previously reported 13 workflows.

## Production corrections

AI New Song previously used unconditional `put` with a caller-supplied project ID. A collision overwrote the saved project. New-song form, MIDI test project, new MIDI import and external-song import also used unconditional publication. All five now use one create-only `compareAndPut(project, undefined, guard)` transaction. Existing IDs, racing writers and changed repositories fail closed. Creation provenance is committed inside the project transaction. External-song file reading captures its repository before awaiting the file; changing repositories cannot redirect its publication.

Normal duplicate previously read its source and performed an unconditional destination write. It now uses `compareAndFork` to compare the exact source snapshot and require an absent destination in the same transaction. The saved copy includes source ID and revision in a `project-duplicate` receipt. Existing source audio, MIDI, checkpoints, production history and binary references are preserved. A concurrent source revision, deletion, destination collision, repository change or storage failure refuses the fork.

## Reconciliation of the baseline 51 direct publication sites

The baseline inventory remains in RECOVERY_LYRICS_ACCEPTANCE_20261104.md. Five logical new-project entries now delegate to `publishNewProject`; their direct writes moved into that helper. One normal duplicate entry now uses the existing guarded fork family. A smaller lexical direct-write count must not be interpreted as fewer public entry points.

| Public entry | Boundary after correction | New evidence |
|---|---|---|
| createAIProject | create-only compareAndPut | Existing ID collision, simultaneous same ID, quota failure; real Chromium SIGKILL before commit, reopen, absence and retry |
| submitCreate | shared create-only compareAndPut | Shared transaction contract; full regression; individual form SIGKILL still pending |
| createMidiTestProject | shared create-only compareAndPut | Full regression; individual SIGKILL still pending |
| saveMidiImport (new) | shared create-only compareAndPut | Full regression; individual SIGKILL still pending |
| importExternalSongFile | shared create-only compareAndPut | Repository change during read; storage failure; full regression; individual SIGKILL still pending |
| duplicateProject | source compare + destination add in compareAndFork | Concurrent source update, source invariance, saved provenance; real Chromium SIGKILL before add transaction commit, reopen, absence and retry |

The browser test holds a real IndexedDB write transaction alive, then sends actual SIGKILL to the owned Chromium process group. Reopening the same persistent profile confirms exact source equality and no additional destination project. Retry succeeds and commits provenance. This demonstrates process interruption, not physical power loss. Completed-transaction creation receipts are checked after retry; uncertain external-delivery boundaries are not accepted by inference.

## Acceptance status

MS22-A04 and MS30-A02 remain open. No requirement is newly marked verified. Counts remain **62/135 verified, 73 open, 45.93%**. Among open A requirements, **63** retain declared C dependencies and **10** have no declared C dependency. Model, provider, cloud conflict, supported-format and licensing decisions have not been substituted with technical assumptions.

Remaining priority: individual public save entries and commit boundaries for checkpoint/fork, archive restore, automatic backup/pruning, recording journal, settings and MIDI histories; timeline attribution policy for special actions. Creation provenance in productionHistory is not claimed as full active-session timeline coverage. Other open software requirements include recording interruption, synchronized resume, all-material mix, independent true-peak accuracy, audible checkpoint comparison, editing-state navigation/accessibility and finished snapshot invariance.

## Validation

Final results and exact runtime/test hashes are recorded in verification/music-project-create-safety-20261104.json. Existing acceptance proof records are refreshed only after their current-source suites pass. No protected PR or main is modified; the deliverable uses a new branch and Draft PR.
