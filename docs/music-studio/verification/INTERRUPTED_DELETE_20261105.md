# Interrupted deletion and production session attribution — 2026-11-05 JST

Baseline: PR #586, 46190da0db9314a21b36b7d43faf180a0bd8ccae.

Project deletion previously awaited a project read and then deleted through the mutable global repository. A switch could delete a same-ID song in a different repository. It also lacked a compare-and-delete check against newer saved revisions. Deletion now uses the captured repository and baseline, with strict-durability IndexedDB comparison and deletion in one transaction. Both request callbacks check the context and abort on conflict; pending editor changes block the operation.

The final journal metadata read checked the repository before an await only. A switch during the await was reproduced and previously still called deletion. It now checks after reading and supplies a synchronous guard inside the deletion transaction, before requests and after the final delete request. Metadata and chunks remain in the same transaction.

Checkpoint adoption now records the acting session on the operation, validates its referential integrity, and appends session-attributed automatic timeline entries for adoption and Undo/Redo. Daily entries and original checkpoint session provenance remain unchanged, including through JSON import.

Validation: initial full Node regression 2,864 passed / 0 failed. Additional transactional model tests pass for newer-revision refusal, abort after the delete request, exact metadata/chunk retention after reopen, and successful retry. Final-source full regression is recorded separately in the verification summary.

Real Chromium SIGKILL tests were added for interrupted journal and backup deletion and complete retry, plus a transaction guard abort. Local execution is blocked: Chromium is absent; Playwright download receives HTTP 403, Domain not in allowlist. The browser workflow runs this test on the exact PR head. A local transaction model is not real process-crash or power-loss evidence.

No new verified requirement. MS22-A04 and MS30-A02 remain open. 62/135 verified, 73 remaining, 45.93%. Archive restore interruption and every public save entry still require complete acceptance coverage. Existing browser evidence remains tied to its previously tested runtime until rerun in CI; do not rewrite its hashes as if a local browser passed.
