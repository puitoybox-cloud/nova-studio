# Exact range contract for metadata Family adoption

2026-10-03 JST. Independent Draft #279 / feature/music-ai-family-metadata-range-v1, based on freshly fetched Draft #278 0777660e8871830b0d167fd00cbc13ced150d1c4. Main and all 23 existing Drafts were read from GitHub; all Draft HEADs were mergeable and their returned CI runs succeeded. The fetched refs show #278 is the newest checkpoint. See music-ai-family-metadata-range-audit.json for exact HEADs/checks. Main HEAD is 552d56eafddfd192970c09f7d6278696cf8775c3; its pages build/deployment run 35718789435 succeeded.

## Confirmed gap and resulting behavior

At #278, metadata-only conversion skipped MIDI selection validation. Section-only and metadata-only Melody/Family Plans accepted ranges outside candidate bounds, failed to display the selected tick interval, and recorded no exact tick interval. Fifteen new regressions failed before the correction. Twelve further regressions reproduced incomplete/malformed range inputs being silently expanded to the full range.

Every selected component now validates the explicit range against its original candidate before adoption, including metadata components and metadata-only mode. Missing endpoints, malformed input, noninteger/reversed and outside ranges fail closed. No explicit range still means the original candidate's whole range. Plan shows exact measures and ticks for metadata. Adoption selection gains optional ticks using the existing generic selection field, with no workspace/schema version change. Source candidate metadata, MIDI and project sections are not rewritten by metadata-only adoption. Older saved selections without ticks continue to load unchanged.

Existing atomic commit, rollback, dependencies, locks, Undo/Redo and persistence are reused. No Family foundation was rebuilt. Only the modified Family Apply asset URL advances to 1.0.2 in the existing standalone/host loaders.

## Validation

- Baseline exact #278: node --test 1034/1034 PASS, FAIL/skipped 0.
- Revised source: node --test 1063/1063 PASS, FAIL/skipped 0; all 127 tracked JavaScript node --check PASS; git diff --check PASS.
- Core range regressions: 27 new tests reproduced failure before the corresponding correction. Invalid selections leave MIDI, workspace and Undo/Redo unchanged. Valid exact tick 1000 metadata ranges display/adopt precisely and restore through Undo/Redo without changing candidate values.
- Integration exercises Plan -> Preflight -> Cancel -> Plan -> Preflight -> Confirm -> Undo -> Redo -> Save -> Reopen -> JSON -> Backup/Restore with exact adoption tick assertions, including metadata-only and existing MIDI partial Apply. Old-project render/load write-zero checks pass.
- Chrome 154.0.8037.57 at checkpoint cd5877d89480ecd309de0195df3f249a4037f2b9: run 37091527098 SUCCESS; 1440/820/390 PASS, 42 captures total, empty console error/warning/pageerror and external-request arrays. Includes original flows plus metadata Melody, rejected Section outside range, rejected metadata Family outside range, and exact metadata tick persistence. Scoped MIDI repair run 37091527110 SUCCESS.
- This final refinement adds malformed-input rejection. Final exact remote-HEAD CI must complete; the Draft PR final verification records that HEAD and runs. Local Chrome is unavailable, so no local-browser success is claimed.

## Remaining acceptance and next scope

Physical Intel Mac/Chrome and M1 iPad/Safari: use a separate synthetic project; select Section or Metadata only for M1-1, check exact Plan ticks, Preflight -> Confirm -> Undo -> Redo -> Save -> Reopen. Select beyond the generated candidate range and confirm BLOCKED with no mutation. Verify MIDI playback and Keystation Mini 32 MK3 recording/playback after an ordinary MIDI partial Apply. Linux Chrome does not establish physical-device acceptance.

Section/Arrangement/Lyrics remain adoption metadata, not rendering into project sections or new instrumental MIDI. Continuation dependency/conflict policy remains blocked under the existing Family rule; no new policy is inferred in this unit.

No main/existing-PR changes, real songs/backups, load-time write, migration, feature removal, Live Provider/External AI/API Key communication, Ready/Merge/Auto Merge or force push. Checkpoints are saved through the GitHub connector with non-force ref advances.
