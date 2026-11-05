# MIDI import atomic publication — 2026-11-05 JST

Baseline: PR #590, ecbec06e261fb7a0a6717d5131115a17c61ff1c0. Its 13 PR workflows were confirmed successful through GitHub Actions API.

## Production change

`saveMidiImport` previously committed its project before attempting a separate import-history write. An interruption or receipt failure could leave an imported project without its provenance receipt. Both new and duplicate import now use `commitMidiImport`: one strict IndexedDB transaction spans project and import-history stores. Both use `add`, rejecting existing identities instead of replacing them. Duplicate import checks the source baseline inside that transaction. Context changes before completion abort the transaction; completed results remain in their original repository and do not replace another repository's UI.

The project production-history event shares the receipt ID and records mode, original filename and duplicate source identity. Source projects and their Session/day history remain copied by existing project construction, without modification to originals. A failed transaction retains the parsed preview for retry. Repositories without the atomic capability fail explicitly rather than silently reverting to split writes.

## Execution evidence

- Initial focused suite: `node --test tests/music-studio-logic-pro.test.js tests/music-production-history-*.test.js tests/music-studio-storage.test.js`: 193 passed, zero failed/cancelled/skipped.
- Auto-Finish helper: 22 passed.
- Initial complete Node regression before the final provenance event addition: 2,877 passed. Final complete regression: 2,879 passed, zero failed/cancelled/skipped, recorded in `verification/music-macless-node-summary.json`.
- Runtime commit `7f91021eb622380e1505f54b42a1e046daf3f804`, tree `5eea10b28418a24b63296918fc797141d5e91c9c`, exactly matches the local staged tree.
- [IndexedDB run 42018097276 / job 127213602147](https://github.com/puitoybox-cloud/nova-studio/actions/runs/42018097276/job/127213602147): steps 6–9 all successful; entire job successful. New step 7 executes `scripts/music-midi-import-atomic-browser.cjs`.
- That browser test queues the project add before a colliding receipt add and checks rollback of the project, unchanged existing receipt, cancellation after a successful request, stale source refusal, successful fork, actual SIGKILL of the Chromium process group, persistent-profile restart, exact source/project preservation, receipt presence and safe rejection of repeated identities.
- [Checkpoint run 42018097172 / job 127213602009](https://github.com/puitoybox-cloud/nova-studio/actions/runs/42018097172/job/127213602009): step 7 successful on the same runtime. Entire workflow status is separate.
- No local browser success is claimed: Chromium download returned incomplete archives in this environment. Actual power loss and Mac hardware are not simulated by process SIGKILL.

## Acceptance scope and remaining work

No requirement has been newly marked verified. MS22-A04 and MS30-A02 require all public entrances, not only atomic MIDI import. The 43-function inventory in `SAVE_ENTRANCE_CONTEXT_20261105.md` remains the baseline; MIDI has stronger atomic publication coverage, but this repository-level test does not establish complete public UI crash/uncertain-commit acceptance.

A: 62/135 verified, 73 open, 45.93%. Ten acceptance gaps remain: MS12-A02, MS13-A04, MS18-A02, MS19-A03, MS22-A02, MS22-A04, MS28-A02, MS28-A04, MS30-A02, MS30-A03. The other 63 A requirements remain specification/model/license-dependent; no model, contract, license or acceptance criterion was silently selected or relaxed. B=30 and C=18 remain separate.

Next: crash during the public MIDI entry before commit and during uncertain completion; remaining binary/journal/save entrances and their Session/day links; finished-snapshot immutability across every edit entry; discontinuous true-peak conformance. No additional whole requirement is claimed complete on the basis of shared storage tests.

## Additional MIDI export repository boundary

`performMidiExport` now captures the original repository before initiating the download. A synchronous download callback or a delayed receipt write can change the displayed repository. The receipt still goes to the captured repository, and delayed history/list/last-export UI publication is suppressed after a switch. New tests cover both download and history boundaries, verify the destination repository remains empty, preserve the replacement view, and compare the original project exactly. Both new tests fail against baseline ecbec06 and pass on the fix. Final focused suite: 195 passed, zero failures. Complete regression for runtime d9238f84738c03e1f311f7c88785492771f7464e: 2,881 passed, zero failed/cancelled/skipped. Latest runtime IndexedDB workflow 42019063443 / job 127216918661 succeeded, including atomic MIDI step 7 and existing recovery/delete/history steps. Checkpoint/recovery workflow 42019063359 / job 127216918764 also succeeded (steps 7–9). Proof JSON hashes now match this runtime.
