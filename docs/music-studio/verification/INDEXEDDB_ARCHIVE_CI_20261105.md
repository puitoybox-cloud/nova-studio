# IndexedDB CI and committed Archive safety — 2026-11-05 JST

Base: Draft PR #588, `650154ac445b11b2be704235fe71f024a19e3130`.
Changes: Draft PR #589, branch `fix/music-indexeddb-ci-20261105`.

## Established CI failure

[Job 126936886242](https://github.com/puitoybox-cloud/nova-studio/actions/runs/41933748594/job/126936886242) passed physical IndexedDB persistence, browser restart, SIGKILL, interrupted project/backup publication and retry. The following lyrics test failed at browser launch: absent Playwright `chromium_headless_shell-1208`. It omitted the workflow's `CHROME_EXECUTABLE=/usr/bin/google-chrome`. Both launches now honor that explicit executable; assertions remain enabled.

Both browser tests passed on production runtime `d096bfb1fb0e72392d3fb6cd672769f83f95a8f3`, [job 127062910349, step 6](https://github.com/puitoybox-cloud/nova-studio/actions/runs/41972234278/job/127062910349). The next step exposed an Archive fixture preparation error (`long-wav-stale-import`), after deletion assertions had run. Prepare the selected PCM project and named WAV before importing. This was a harness correction; the production stale-import check remains intact.

## Production fix

`restoreLongWavArchive` now records a successful transaction receipt before checking whether the caller's repository, cancellation token, signal or UI baseline became stale. A stale completion returns `ok:true, committed:true, viewRefreshPending:true` and does not append restored songs/settings into another view. Precommit failure remains `ok:false, committed:false`. This prevents a completed restore being confused with an uncommitted operation and avoids retrying on a false failure receipt.

Two regression cases reproduce the repository-switch and cancel boundary after the actual repository transaction commits. The prior production source fails both cases; the corrected source passes. Reopen checks retain one additive restored copy, unchanged current view, exact WAV bytes, production session, daily note and session-linked automatic edits.

## Verification

- `node --test tests/*.test.js`: 2,868 passed, zero failed/cancelled/skipped; 106,956.712022 ms. Source hashes and log digest: `verification/music-macless-node-summary.json`.
- Production history, delete conflict and automatic retention tests: 33 passed, zero failed.
- Ledger validation: 62/135 verified, 73 remaining, 45.93%; B:30, C:18.
- Checkpoint browser UI/restart step passed on the same production runtime: [job 127062909899, step 7](https://github.com/puitoybox-cloud/nova-studio/actions/runs/41972234051/job/127062909899). Browser evidence files identify exact successful steps, separately from whole-workflow conclusions.
- Local Chromium is unavailable; its download returned an invalid archive. No local physical-browser success is claimed.

`scripts/music-delete-crash-browser.cjs` exercises physical browser SIGKILL during journal/backup deletion and Archive restore. Archive interruption holds a real IDB add transaction after request success, compares every object store (including exact WAV/journal bytes) after restart, retries, checks session/day links and tests a further restart. A successful execution of this step in PR #589's current CI is required to claim physical Archive acceptance; consult its final checks rather than the earlier failed fixture execution.

No new requirement is marked verified. MS22-A04 still requires all public save entrances and interruption boundaries. MS30-A02 still requires complete special-entry attribution coverage. These focused improvements do not establish full acceptance, Mac hardware behavior, actual power-loss behavior or listening quality. Existing PRs and main are unchanged; no Ready, Merge or force push.
