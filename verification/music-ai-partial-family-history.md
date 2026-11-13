# Partial Family Apply and Editor adoption history

2026-10-03 JST. Independent Draft #278, based on freshly fetched Draft #277 `f7383c988f9d98f0854a652edeb9171d949a8fd2`. Main `552d56eafddfd192970c09f7d6278696cf8775c3` and existing PRs were not changed. No newer open PR existed at start. All open Draft HEADs and checks were fetched; their checks were successful.

## Behavior

- Explicit UI selection of Melody, Chord/Bass, Section, Arrangement, Lyrics and Continuation. Empty selection fails closed. Changing components or range invalidates Plan/Preflight. A new Family Preview also invalidates the prior Plan.
- Chord/Bass reuses the existing chord candidate to Bass materializer, not an additional chord-note renderer.
- Section/Arrangement/Lyrics remain adoption metadata. Metadata-only mode records the selected candidate metadata without MIDI changes, including Melody/Chord references. This is one existing Editor Undo/Redo unit.
- Dependencies must exist in the same candidate family and be selected explicitly. Arrangement-only and Lyrics-only are selectable but BLOCKED because their declared dependencies are missing from the selection. No dependency is auto-applied. Metadata-only mode can include those dependencies explicitly without writing MIDI. Melody and Continuation together remain a guarded conflict.
- Exact partial measure selection reuses the candidate bridge's selection/narrowing implementation. Plan displays the selected exact measure/tick range and actual subset counts. Crossing existing notes remain indivisible and rejected. New proposals clip to the exact boundary.
- Family Apply stages workspace adoption before the real Editor commit. Existing Editor snapshots now carry runtime-only AI workspace snapshots through a WeakMap binding; no parallel Undo stack and no added saved MIDI field.
- MIDI and adoption status, adopted arrays, selection/dependency metadata and workspace history restore together. Save rebasing preserves the bound object. Undo while a metadata-only save is in flight remains pending and is not overwritten by completion of the older save.
- Preflight failures and failed final guarded Editor commit leave MIDI, workspace and both history stacks unchanged.
- Existing cache keys advanced for modified assets. Host changes only advance its existing Music Studio script URLs; no Nova Studio integration or new feature was added to the host.

## Verification

- Local full `node --test`: 1034/1034 PASS, FAIL 0, skipped 0.
- All 127 tracked JavaScript files `node --check`: PASS.
- `git diff --check`: PASS.
- Core/integration tests cover Melody-only, Bass-only, Section-only, Melody+Bass, metadata-only, Preview/Cancel nonmutation, empty/invalid selection, unselected and absent dependencies, family mismatch, stale Project/Track/range/workspace, protected ranges, final commit rollback, metadata Undo/Redo, older/later normal MIDI history, save/reopen, JSON export/import, Backup/Restore, old-project render write 0, exact tick 1000 with meter change, legacy lock plus additive partial unlock, and lock metadata preservation.
- Real Google Chrome 154 workflow 37037149448 succeeded at checkpoint `9d111da0baf45d01e9a6785989674a0496699a92` for 1440/820/390. Each width passed five partial Apply/Undo/Redo/Save/Reopen cases plus Arrangement/Lyrics dependency rejection, with empty warning/error/pageerror and external-request captures. The script writes its actual Git HEAD into the artifact report.
- The final source refinement adds exact selected-range Plan display and save-race/lock coverage. Its exact-HEAD browser CI must pass before completion is reported. See the final Draft PR description and Actions report for final-HEAD results.

## Physical-device acceptance still needed

Intel Mac/Chrome: touch neither production songs nor backups; synthetic partial Apply, Undo/Redo, Save/Reopen and playback. M1 iPad/Safari: component checkbox/range interactions, narrow layout, Confirm/Cancel, Undo/Redo and Save/Reopen. Keystation Mini 32 MK3: recording/playback after a synthetic partial Apply. CI Chrome is not physical Mac/iPad/MIDI acceptance.

Draft only. No main changes, existing PR changes, Ready, Merge, Auto Merge, force push, Live Provider/External AI/API Key communication, production song or backup use, automatic migration or load-time write.
