# Automatic backup retention safety — 2026-11-04 JST

Baseline: Draft PR #585, HEAD `69d5c64f66f58d3878ebc0f64968b735f961e257`. GitHub connector confirmed the open draft and all 14 returned workflows completed successfully on this SHA.

## Production corrections

Automatic backup captured its project/settings baseline before publication but read maxCopies after awaiting storage. Switching repositories or changing retention during the write could delete old copies under a different policy. Retention now uses the captured policy and checks the repository and exact project/settings baseline before cleanup and each deletion. A conflict retains old copies. Publication and cleanup outcomes are separate: failure to delete an old copy reports the newly committed backup as saved, with a cleanup warning.

A delayed backup list read from a previous repository could replace the current repository's restore choices; a delayed read failure could clear them. List results and errors now update state only while their captured repository remains current.

## Validation and boundaries

- Final Node suite: 2,857 passed, 0 failed; includes seven new publication, retention-policy, repository-switch and stale-list regressions.
- Real Chromium persistence/lyrics: 2 passed, 0 failed. Added actual SIGKILL while the automatic-backup put request succeeded inside an uncommitted real IndexedDB transaction. Reopening the same persistent profile retains the exact old backup, project, session, daily and material history. Retry saves the exact complete project collection and then prunes the old copy. Existing create/fork, material and missing-binary interruption scenarios also pass.
- Checkpoint browser: completed=true, errors=[], external=[] on current sources. Acceptance hashes refreshed after successful current-source execution.
- Synthetic-microphone PCM recording: actual SIGKILL during recording, fresh-process discovery, exact committed PCM equality, full Archive restore equality and duplicate recovery refusal passed. This is not physical power-loss or microphone hardware acceptance.

- Encoded recording: SIGKILL, retained container bytes, decoded PCM, unfinished automatic Archive migration, full Archive restore and atomic recovery markers all passed.

## Requirement disposition

No new requirement is marked verified. MS22-A04 still requires every public save entry and remaining Archive/journal/pruning transaction and uncertain-commit boundary. This new browser scenario covers automatic-backup publication, not interruption during deletion of an old backup. MS30-A02 still requires complete special-entry active-session attribution. Counts remain 62/135 verified, 73 open, 45.93%. The 63 open A requirements with C dependencies retain model/provider, quality, format, cloud-conflict and licensing decisions; no decision was inferred. The other software acceptance gaps remain separately open.

Evidence: `verification/music-auto-backup-retention-20261104.json`, `verification/music-macless-node-summary.json`, `verification/music-recovery-lyrics-browser-20261104.json` and `verification/music-pcm-journal-crash-browser.json` and `verification/music-encoded-journal-crash-browser.json`.
