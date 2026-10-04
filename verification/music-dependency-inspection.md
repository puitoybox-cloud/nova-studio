# Read-only dependency foundation

Date: 2026-10-04 JST. Base #290 bd9fdd7bf777f4bbc34dd02481805572a0005169. Fresh main 552d56eafddfd192970c09f7d6278696cf8775c3. Start snapshot: music-dependency-start.json. 37 open / 35 Draft, all Draft mergeable; returned head Actions successful. #10/#35 non-Draft conflicting, no returned Actions. No new physical FAIL evidence found in fetched current PR reports; no conversion algorithm changed.

Sources: MS-00B section 3 assetId/storage.reference/derivedFromAssetId; MS-04 fileReferences id/missing (documented proposal, not finalized binary contract); music-studio.js makeProject/exportProject/markExternal/backupObject/repositories; music-studio.html; audio-pipeline endpoint/revision; Python requirements; native wrapper and MIDI bridge; existing storage/settings/Logic and offline acceptance regressions.

Pure service, explicitly invoked only. No app/load/UI hook, IO, fetch, persistence, mutation, repair, migration, deletion or asset import. Reports do not include raw references/tokens. Duplicate identity namespaces distinguish fileReferences from assets; MIDI/audio share derivedFromAssetId namespace. No inference from filenames/checksum to identity. Remote URL expiry cannot be confirmed; classified unassessed, never valid resolution. Explicit blob/data references are temporary. Undefined legacy collections produce empty inventory without adding fields. Snapshot stale guard has no storage handle. Unknown extension fields stay untouched.

Standalone CLI statically checks direct entry script/style paths and optional tooling; transitive CSS/JS resources and installed packages/model weights are explicitly unassessed. Static presence is not standalone runtime compatibility or license evidence. No production loader change.

Local node --test 1332/1332 PASS, FAIL/skipped 0; 18 new tests include normal/missing/duplicate/unknown/temporary/malformed/stale/legacy/Cancel/JSON/Backup and repository Save/Reopen zero-write. Initial Backup comparison caught nondeterministic default-settings timestamps in test fixture; fixed by supplying fixed synthetic settings, no production change.

No Python changes. Audio-to-MIDI offline acceptance unchanged; no Intel real conversion or physical PASS. Save/Backup and all existing regressions retained. Big-feature status unchanged; A 0/30. Deferred binary/Take/audio Version/Checkpoint, Cloud Sync destination/encryption/conflicts, Provider/pricing/Local/voice model, licensing/capacity remain unset. Physical Batch A/B/C consolidated in master plan.
