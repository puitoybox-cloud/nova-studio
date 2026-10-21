# Track-range checkpoints and original-source recovery — 2026-10-21 JST

Original specification: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, Library libfile_fea4127fde5c81919fee8296d5c7647d; read all five pages /166 lines this session. Original numbers/names remain in the adjacent 30-feature ledger.

## Recovery baseline

GitHub main: 552d56eafddfd192970c09f7d6278696cf8775c3. Latest saved checkpoint #480: 4cb46a64485a7a5995bd27e48beea0fa040efbfe; base c76351d09dd60c985c123b83caf605a157e273d5; Draft/Open/mergeable. Ten exact-head workflows completed successfully. All 227 open PRs (225 Draft) were read individually for refs/state/mergeability; all 227 exact-head check collections were fetched, immutable latest commits and changed-file sets read from fetched git objects. Snapshot: music-range-recovery-start-20261021.json. No unsaved stopped-Work state was assumed or used.

New Draft #481 stacks on #480. Ordinary shell push had no credentials and did not publish; authenticated GitHub blob/tree/commit/ref operations preserved the same verified tree. No Force push/main/old-PR changes.

## Production changes

- No.22: Project → Checkpoints → Music → Track / Measures. Select a source checkpoint, track and inclusive start/end measures; Compare displays exact tick range, replaced/adopted/outside-note counts; Adopt publishes with the existing atomic CAS. Other tracks, outside notes and all source versions remain unchanged. Different versions can supply subsequent disjoint ranges.
- Exact existing MeterMap handles mid-measure signature events. Timeline metadata and target track settings must agree. Dependent sound/audio/code metadata must agree. Linked lyrics/score/AI workspaces, measure locks, locked/protected notes or tracks, boundary-spanning notes and colliding note identities reject rather than guess. This is deliberately constrained MIDI composition; it is not complete arbitrary cross-domain version merging.
- Persistent operation entries retain the selected track/range. Existing original snapshots, abandoned redo branches, Undo/Redo, JSON/additive/full archive identity rebinding remain.
- No.23/24: Recover source form lists descriptors from current and historical snapshots. Explicit original-file reselection checks size and every SHA-256 chunk, then atomically adds the absent original body with unchanged descriptor ID and immutable snapshots. Existing binaries are never replaced; matching retry returns already-present. Wrong bytes, cancellation, capacity, stale/repository/storage conflict and transaction abort reject. Descriptors without trustworthy identities still use the existing explicit legacy file-binding path; no guessed migration or fallback sound.
- No.30: persisted checkpoint/adoption chronological timeline, with timestamp, source name, track/range or dependency groups, applied/undone/retained-branch state. This is explicit version provenance, not complete session/day history or completed-version freezing.
- No new sound packs, listening demos, provider calls or cloud service choices.

## Verification

Local initial complete Node run: 2526/2528, two failures were stale escaped cache-version expectations. Corrected expectations: related 45/45 PASS; subsequent complete Node 2529/2529 PASS, failure/skip0,112.318s, before the final timeline-only rendering addition. Final full rerun follows that addition.

Focused checkpoint/range/recovery tests 13/13 PASS: other track/outside retention, exact mid-bar meter, boundary/lock/dependency/identity rejection, durable Undo/Redo and additive restore, exact historical-only binary repair, wrong bytes/cancel/quota rejection, idempotent retry. Python audio pipeline509 run /504 PASS /5 existing skips; generation Python36/36 PASS. Python source unchanged.

Exact first #481 HEAD 1a92fe6180960786336bb5473ba2936d4b141a42 checkpoint-recovery CI39562390307 SUCCESS: existing historical WAV/UI/restart/recovery plus new actual form range adoption at1440/1180/820/390, historical-only missing original-file selection, wrong-file rejection, original bytes and complete rebackup/restore. Final-head CI must be checked independently; earlier passes are not attributed to later commits.

Physical Mac/iPad, Swift/Xcode and local Chrome are not available in this container. Required native/Swift, real ONNX/Sinsy, eight-minute Stem/Mix/Master/Export and browser acceptance run in exact-head GitHub CI. Pending or unavailable evidence is never counted successful.

## Formal verdict and remaining work

A0 / B0 / C30. None is proven to have only physical acceptance remaining. All original requirements/prior residuals remain in music-range-recovery-30-features-20261021.json; implementation does not itself establish complete feature closure.

No.22: arbitrary linked MIDI/code/lyrics/AI/audio range merging, independent audible checkpoint A/B, forced-exit/power-loss automatic recovery, standalone distribution acceptance remain. Maximum32 checkpoints/32 retained adoption operations/64MiB metadata unchanged; no automatic history trimming.

No.23: all legacy local dependency migration acceptance, automatic crash recovery/update protection, cross-device acceptance and Cloud Sync architecture/implementation remain. Cloud service/auth/encryption/conflict/offline decisions are not selected without Tia. Unknown-hash old references cannot be authenticated automatically.

Other28: explicit version provenance and safe missing-source repair improve No.30/24; complete session/day/final-version management and whole-product diagnosis/repair remain. Original policy/backend/license/distribution and domain-specific obligations remain for the other26. No formal B promotion justified.

Next: linked-score/AI-aware track/range composition with dependency-specific previews; complete legacy dependency migration; crash/update recovery. Keep physical acceptance for Tia and Ready/Merge gated on Tia approval.
