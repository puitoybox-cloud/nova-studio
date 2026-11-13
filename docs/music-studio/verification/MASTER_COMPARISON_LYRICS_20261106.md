# Master comparison and lyric publication — 2026-11-06 JST

Baseline PR #595, HEAD 9be2dae80a7d858f52147d9dd1413171fb57c96f. Existing branches/main are unchanged.

## CI failure

Run 42182491150, job 127775091650 completed both eight-minute acoustic production executions. Source bytes, completed master hash, stable meter fields, zero clipping and corrected true-peak ceiling assertions passed. The final plan comparison failed solely on four independently generated WAV UUIDs. Artifact 13487268650 contains both original completed reports. The new comparator passes against those exact reports locally. It validates each route key against the corresponding ordered source within its own report, rejects duplicate IDs, then compares plans with stable source indices. Audio hashes and all route settings remain strict gates. No meter production change, reference change or tolerance increase is needed.

## Production fix

Lyric assignment Apply had the same post-commit replacement-view overwrite as the former PCM path: after successful compareAndPut, changing repository, preview or cached view could be overwritten by the old completion. It now returns committed/refreshPending and preserves the new view and preview. A regression reproduces the baseline failure and verifies all three context changes; committed assignment and original MIDI remain stored. The transaction, not UI refresh, determines whether the save succeeded.

## Acceptance

Seven validation gaps remain: MS12-A02, MS18-A02, MS22-A04, MS28-A02, MS28-A04, MS30-A02, MS30-A03. They require broader public-entry/mode combinations than this change demonstrates. No new verified IDs. 65/135 verified, 70 remaining, 48.15%; 63 of those require explicit specification/model/license decisions. No such decisions were inferred.

Local Chromium launch failed under sandbox restrictions (SIGABRT/ptrace denied). No local browser acceptance is claimed. Final-source full regression and matching-runtime GitHub browser evidence must be recorded before refreshing runtime-bound acceptance proofs.

## Matching-runtime execution evidence

Runtime commit 37b02976a32573e432f1fa3bdf21ab02a08ca794, music-studio.js SHA-256 4c7369b2f80864fde2316698cdfa113e6ed97498958cb4e1376efd550cd845ab. IndexedDB run 42192386360 / job 127807297453 passed steps 6–9, including the added lyric Apply interruption/restart/retry matrix. Checkpoint audible run 42192386177 / job 127807296346 passed step 5; artifact 13489859702 records exact source hashes, three successful cases, distinct A/B digests and reload Undo/Redo. Checkpoint recovery run 42192386054 / job 127807296195 passed all steps, including PCM and encoded recording process termination and archive recovery. Registered browser proof hashes were refreshed only after those successes.

Focused local tests: comparator plus independent meter 29 passed (23 unchanged FFmpeg signals), lyrics 40 passed (including three post-commit replacement contexts), Checkpoint 33 passed, helper 22 passed. Both original failed-run reports pass the new comparator. No local browser success is claimed.

Matching-source full Node regression passed in GitHub Actions: 2,911 tests, zero failed/cancelled/skipped, 214460.00755 ms, run 42192386102 / job 127807295991 step 5. Its subsequent ledger step rejected the previous music-studio.js runtime hash. After registering the actually successful Node and browser executions, both ledger generation and independent validation pass locally: A=135, verified=65, remaining=70, rate=48.15%, B=30, C=18. No production failure was reclassified by blindly refreshing hashes.
