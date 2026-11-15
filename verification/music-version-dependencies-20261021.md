# Version composition and dependency recovery — 2026-10-21 JST

Original specification: Music_Studio_最終機能仕様書_v1.pdf (2026-09-30), all five pages / 166 lines read. Starting #481 HEAD 9cc2ca33482475f5b45277203c0e419f43215ecf; base 4cb46a64485a7a5995bd27e48beea0fa040efbfe. Main 552d56eafddfd192970c09f7d6278696cf8775c3.

## Production changes

- No.22 保存・曲バージョン管理: identical unassigned lyric versions and chord context are retained during MIDI track/measure adoption. Assigned note scores, AI workspaces, rendered vocals and melodies remain bundle-only. Dependency/timeline/sound/lock/boundary/identity guards remain. Preview lists retained dependencies; original checkpoints and branches remain immutable. Undo/Redo, save and additive restore retain text.
- No.23 バックアップ・復旧・移行: Checkpoints → Recover source → Check dependencies checks actual bytes of current/history dependencies by size, stored hash metadata and SHA-256. Reports verified, missing, corrupt, conflicting identity and unauthenticated legacy references with locations and date. Cancellation, stale project/repository, changed persisted song and read errors discard partial reports. Reports are transient observations; rerun after repair or external binary changes.
- Authenticated historical missing files can be repaired even with unrelated legacy references. Only absent bytes are added, retaining original metadata/snapshots. Wrong bytes, identity conflicts and existing corrupt bodies are refused. Exact retry is idempotent. Unresolved legacy files still prevent complete backup.
- No.24 Music Studio診断・安全修復: actionable missing/legacy/corruption diagnostics and exact original-file recovery through project UI. This does not complete whole-product automatic repair.
- Cache version 1.4.198 in standalone/host entrypoints. Shallow temporary metadata copies bound recovery-view memory; persisted snapshots are not rebound.

## Evidence

Local full Node 2535/2535 PASS, failure/skip 0, 117.613s; final focused 19/19 PASS after shallow-copy optimization. First full run had two stale escaped cache assertions, corrected before passing run. All 255 JS source syntax checks PASS; changed sources rechecked; git diff --check PASS. Audio Python 509 run / 504 PASS / 5 existing skips, generation Python 36 PASS. No Python/Swift source changed.

Initial published HEAD 5bd5820e411c35e62f6dcde5f80105a3945cd911 browser CI failed because the test clicked a button inside a collapsed details panel after a rerender. The browser test now explicitly opens its containing panels before clicking. That earlier browser run is not a pass. Final exact-head CI must independently confirm four viewport widths 1440/1180/820/390, restart, backup/restore, retained lyrics, dependency report and original-byte recovery. Swift/native/real ONNX+Sinsy/eight-minute regressions must also complete; pending/skipped checks are not successes.

Local Chrome download failed. Execution-server transport disconnected after first publication; additional local commands cannot be confirmed. The browser test follow-up is saved remotely and CI provides its validation. No physical Intel/iPad acceptance claim.

## Formal verdict and next work

A0 / B0 / C30; accompanying ledger retains all original numbers/names and residuals. No percentage inferred. No.22 retains arbitrary linked AI/score/audio composition, independent audible A/B and complete acceptance. No.23 retains complete old-format migration, forced-exit/update automatic recovery, cross-device acceptance and Cloud Sync architecture/service implementation. No.24 retains whole-product automatic repair. Other 27 features receive no completion promotion.

Next priority: dependency-scoped AI/score adoption with stale-generation handling, legacy migration, interruption-safe restore/update recovery. No cloud/auth/payment/storage choice. No main/previous Draft/Ready/Merge/force push/Live Provider action, no original song/audio/history/backup deletion.
