# Song checkpoints and complete recovery — 2026-10-20 JST

Original: Music Studio 最終機能仕様書 v1, confirmed 2026-09-30, Library libfile_fea4127fde5c81919fee8296d5c7647d; current full five pages /166 lines read. Original numbers/names retained in adjacent 30-feature ledger. The PDF explicitly excludes arbitrary whole-project historical rewind. This change adds named candidate snapshots and explicit part adoption, not a rewind control.

Base: Draft #479 /c76351d09dd60c985c123b83caf605a157e273d5; base has 13/13 successful exact-head checks. Start: all226 open PR metadata fetched individually, 224 Drafts; all224 Draft exact-head check-run collections fetched. No newer PR. Main552d56eafddfd192970c09f7d6278696cf8775c3. Raw normalized evidence in start snapshots. Historical PRs are not modified.

## Actual production behavior

No.22 保存・曲バージョン管理:
- Project → Checkpoints: explicit named snapshot creation, list with source revision/time, difference preview and selected part adoption.
- Normal save/autosave/MIDI editing history remain separate. Snapshots are flat and omit the checkpoint ledger, avoiding recursive growth.
- Four selectable groups: Music (MIDI/chords/lyrics/assignments/AI candidates/instrument bindings), Audio/Mix (source/edit/mix/master/export settings), Notes, and song Details. When the counterpart dependency domain differs, Music and Audio must be selected together. This is constrained group composition, not arbitrary track/range-level merging.
- Preview does not write. Adoption binds an immutable proof to the exact current project and selection. Stale/mutated previews are rejected.
- Atomic compare-and-put uses strict durability. Dirty edits, recording/count-in/Stop, active processing, shutdown, repository changes and concurrent stored edits prevent publication.
- Persisted adoption Undo/Redo checks the exact semantic content before changing it. Intervening edits cause a conflict instead of erasing work. Abandoned redo branches remain retained in the operation ledger; append-only output histories remain retained.
- Explicit Cancel and AbortSignal reach hashing and the pending IndexedDB write transaction. No success is reported until transaction completion. Quota failure leaves the stored song unchanged.
- All retained binary dependencies are authenticated before checkpoint/adoption publication. Missing source or instrument bytes are rejected. Maximum32 checkpoints /32 adoption operations and64MiB project metadata; capacity rejection never trims prior entries. This limit is not suitable for unbounded history.
- JSON import, duplicate, metadata additive restore and complete archive restore rebind historical project identities; old projects without the optional ledger remain compatible. Existing vocal replacement/Comp metadata are preserved by project normalization.

No.23 バックアップ・復旧・移行:
- Complete archive collection now traverses every checkpoint and adoption before/after snapshot, including assets no longer selected in the current song. Shared assets are packed once; inconsistent shared identities fail before publication.
- Existing complete restore hash/format validation and single add-only metadata+binary+settings transaction cover these retained assets. Existing songs are not overwritten.
- New project IDs, WAV IDs, route keys, selected takes/masters and result references are remapped inside snapshots too. Checkpoint names and adoption branches survive restoration.
- Metadata-only restore rejects historical-only long-WAV dependencies; completeness inspection cannot claim a complete backup for historical reference files.
- Restore estimates free capacity before reading all binary bodies; checkpoint commit estimates metadata capacity before CAS. Missing estimate support is explicitly unavailable. Estimates cannot guarantee the next write; transaction abort remains authoritative for quota races.
- UI/source cache identities updated together to1.4.196.

This is one integrated checkpoint/recovery implementation, not20–30 independently completed major features. The other28 functions receive regression checks; no separate original-spec requirement is claimed closed for them.

## Formal acceptance

A0 / B0 / C30 retained. No.22 still lacks independent audible A/B checkpoint comparison and granular cross-version track/range composition acceptance, forced-exit/power-loss automatic recovery and complete standalone runtime acceptance. No.23 still lacks all old local-dependency migration acceptance and approved Cloud Sync authentication/encryption/conflict/offline/recovery architecture and implementation. No external service is selected and no Live Provider request is authorized or made.

All30 original required-content entries and previous residuals are in music-checkpoints-30-features-20261020.json. This is an evidence map with open obligations, not a claim all30 were independently recertified.

## Verification state at initial publication

- New checkpoint semantics:9/9 local Node tests passed (explicit version/partial adoption/undo/redo, branches, conflicts, cancellation, quota, stale proof, identity migration, malformed old data/capacity).
- Local real IndexedDB transaction model (fake-indexeddb, not a browser/device): historical-only WAV → complete archive → additive restore → adoption undo → restored Music/Audio adoption → exact original WAV load PASS.
- Python audio pipeline:509 run /504 pass /5 existing skips.
- Full Node and all-JS syntax /git diff checks are running/final results to be updated. An initial full run found stale cache assertions; all entry identity assertions were updated, not disabled.
- Local Chrome download was truncated; local browser acceptance and Swift unavailable. New final-head CI executes actual UI actions at1440/1180/820/390 (1180×820 iPad landscape), process exit/restart, historical-only binary archive, corrupt restore rejection, additive restoration, restored Undo/adoption and fresh complete backup. Console error/warn and external request arrays must be empty.
- Existing final-head CI remains responsible for real ONNX/Sinsy, Swift/native builds, MIDI/vocal/Mix/Master/export regressions. Prior-head results are not attributed to this increment.

Next: validate this exact-head recovery workflow, then close finer checkpoint composition/A-B and old dependency migration; Cloud Sync service and policy decisions stay explicit residuals. Physical Mac/iPad acceptance belongs to Tia. Draft only; no Ready/Merge/main/old-PR changes, force push or original-data/backups deletion.

UI follow-up: preserve the selected parts/checkpoint after comparison, invalidate adoption proof on selection edits, use readable dark-surface labels/checkbox rows and human field names; browser CI installs Japanese fonts. Earlier 5547136 checkpoint browser run passed and its artifact SHA256a36c724da1246fd8c3699eb85f0d2232a9ba9144766f5ac4dc515d1543107535 was verified and screenshots reviewed; it is not final follow-up evidence.

AI follow-up: a restored Music group must rebind AI workspace baseRevision before capturing adoption-after history, not only when publishing the new project revision. A controlled AI A/B/C checkpoint + complete recovery experiment exposed a safe rejection from the mismatched historical revision; now fixed. The committed AI regression verifies candidate values, retained notes, every snapshot revision, additive restore and Undo/Redo. The controlled full-IDB model also verifies AI candidates + historical-only MIDI/WAV + restored re-edit/save/Mix/Master/ZIP. Prior-head CI results remain prior-head evidence.
