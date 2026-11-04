# Interrupted storage and production session attribution

Date: 2026-11-05 JST. Base: PR #586, `46190da0db9314a21b36b7d43faf180a0bd8ccae`.

## Production changes

- Automatic retention now compares the expected old copy and the committed replacement in the same strict IndexedDB transaction as deletion. A missing replacement, changed old copy or changed repository/settings blocks deletion. Failure after publication remains a cleanup warning.
- Recording deletion rechecks repository identity after asynchronous metadata reads and inside the strict deletion transaction, including the deletion-success boundary. A switch aborts chunk and metadata removal together.
- Checkpoint adoption stores its executing Session ID. Adoption, Undo and Redo append production edits attributed to the session executing each action; the original operation and daily-note links remain intact. Validation rejects dangling operation Session IDs. Older records without this optional field remain readable.

## Verification

`tests/music-interrupted-deletion.test.js` exercises staged-delete abort, reopen, exact recording bytes, both backup copies and UI repository-switch rejection. `tests/music-autobackup-retention-race.test.js` additionally exercises stale listed copies and a missing replacement. `tests/music-production-history-special-entries.test.js` checks capture/adoption/review sessions, daily-note attribution, Undo/Redo, additive backup restore and invalid references. Focused run: 33 passed, 0 failed.

The six added Node cases fail against the base source: four expose changed behavior; two require the new conditional deletion APIs. This is not a claim that six separate acceptance requirements completed.

`scripts/music-interrupted-deletion-browser.cjs` uses real Chromium and a persistent profile. It observes a successful write/delete request, keeps that transaction uncommitted using queued IDB reads, SIGKILLs the browser process group, reopens the same profile, and compares the exact projects (including MIDI extensions and Session/day history), settings, journal metadata, chunk hashes, WAV hashes and backup records. It covers Archive restore, recording deletion and conditional backup pruning. Retry succeeds; restored WAV bytes and Session/day links match. This is controlled uncommitted-transaction process termination, not physical power loss or every uncertain-commit boundary.

Real-browser run together with the existing IndexedDB persistence and lyric-follow tests: 3 passed, 0 failed. Default Playwright Chromium ZIP installation returned truncated/non-ZIP downloads in this environment; a Chromium binary from the npm `@sparticuz/chromium` package provided a working local executable via `CHROME_EXECUTABLE`. CI uses its existing pinned Playwright installation.

Full Node regression (`node --test tests/*.test.js`): 2,864 passed, 0 failed, 0 cancelled, 0 skipped. Existing Checkpoint browser acceptance completed with no console/page errors and no external requests. Acceptance evidence digests were refreshed only after these reruns.

## Acceptance limits

No new requirement is marked verified. MS22-A04 still requires the remaining individual public save entries and uncertain-commit boundaries to be checked. MS30-A02 still requires complete special-entry attribution coverage; the new action records cover checkpoint adoption and Undo/Redo only. The other open requirements are not completed by these regressions. Hardware and listening checks remain separate.

A: 62/135 verified; 73 open; 45.93%. Existing PR branches and main were not modified. No Ready, Merge or force push.
