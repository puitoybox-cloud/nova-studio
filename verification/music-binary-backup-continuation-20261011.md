# Binary Backup and reviewed recovery — 2026-10-11 JST

Source: Music_Studio_最終機能仕様書_v1.pdf, 2026-09-30; all five pages reread 2026-10-11. Base #396, 0f36624de7cfde69e35180ecc128584fb06fcad2. Its six exact-head workflows succeeded. Main 552d56eafddfd192970c09f7d6278696cf8775c3. Fresh 143 Open PR / 141 Draft audit: each HEAD/base/mergeability/commit and file count fetched, Draft workflow runs retrieved; no Draft conflict. See start audit JSON.

18 production subrequirements implemented (not 18 completed major features):

1. Automatic Backup includes original long WAV bytes through the existing portable archive.
2. IndexedDB auto-backup writer retains immutable Blob instead of JSON-cloning it away.
3. Automatic backup exposes the archive's actual byte size.
4. Automatic backup refuses pending edits and active transport.
5. Concurrent automatic requests share one promise.
6. Missing backup writer fails instead of reporting a successful save.
7. Source state/repository change aborts automatic snapshot publication.
8. Automatic WAV recovery routes to validated preview instead of metadata-only Restore.
9. Backup list identifies records containing actual WAV bytes.
10. Archive chooser validates before offering publication.
11. Preview shows project/WAV counts and size.
12. Restore requires explicit confirmation from that preview.
13. Optional settings restore retains destination settings in the existing atomic transaction.
14. Confirmation revalidates archive bytes before writing.
15. Cancel invalidates transfer generation and clears selected preview.
16. Concurrent archive operations fail safely; native cooperative close refuses archive/automatic operations in progress.
17. Failed preview clears previous selection; transfer busy state releases after failure.
18. Generic manual Backup routes WAV songs to the binary archive; dated filenames, settings-only archives and refreshed host/standalone caches support the path.

Production changes: music-studio.js, app.js, music-studio.html. No schema increment. Restore remains additive with new project/asset identities and one metadata/binary/settings transaction. External midiAssets/audioAssets/fileReferences still block complete archives; no false complete claim. Legacy JSON and automatic JSON records remain supported. Existing retention settings remain in use; auto archive size is constrained by actual storage quota, and platform quota acceptance remains physical.

Regression evidence: new transactional fixture cases exercise independent storage/reopen, Blob persistence, source preservation, quota rollback, dirty-state rejection, concurrent promises, preview without writes, cancellation, settings retention, failed selection, generic Backup and empty projects. Real Chrome script adds actual IndexedDB automatic Blob Backup/reload and confirmed additive recovery at 1440/820/390; screenshot per width. The Native Swift workflow now runs when the core changes.

Local full Node/Python/syntax results and exact-head CI statuses are recorded in the PR description once execution completes. Swift/Xcode/Chrome are unavailable locally; no local pass is claimed. Forced OS kill/power loss and actual macOS/iPad persistence remain unverified.

All major features No.1–30 remain C: A0/B0/C30. This improves No.22/23 and native safety without establishing all subrequirements. Total residual denominator and completion percentage remain unverified. Remaining software: external dependency file inclusion, backend/model/vocal production closure, mastering, native independent-process lifecycle, update/origin migration, full requirement/evidence mapping and distribution/license closure. Conditional Cloud/model/provider/own-voice/Logic choices remain unresolved per spec page 5.

Physical Mac: Keystation capture/Stop/reopen/play/edit; red-window close/Cmd-Q/relaunch; quota/interruption/update; Intel Helper/signing and six-note conversion quality; Logic round trip. Physical iPad: touch/Japanese layout, permissions, suspension/relaunch. No saved user songs/backups accessed, main/old PR write, Ready/Merge/Auto Merge/force push or Live Provider calls.
