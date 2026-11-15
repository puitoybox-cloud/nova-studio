# Retained reference originals and complete archive — 2026-10-11 JST

Source: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, all five pages read on 2026-10-11. GitHub freshly fetched: main 552d56eafddfd192970c09f7d6278696cf8775c3; base #397 Draft/Open/mergeable, HEAD 3a60972e487d7c85f05e73488df52c4b969880b1, all five exact-head workflows SUCCESS. All 144 Open PR details, HEAD/base/mergeability/commits/files fetched; Draft CI retrieved and 22 historical failed job logs fetched. No conflicting Draft. No pre-existing PR/branch/main writes.

## Production subrequirements delivered

1. Project screen offers original-file selection outside the unsaved project form.
2. New generic file references can retain exact original bytes, including MIDI/audio files.
3. Existing midiAssets can retain explicitly selected original bytes without replacing parsed MIDI data.
4. Existing audioAssets can retain explicitly selected original bytes.
5. Existing fileReferences can retain explicitly selected original bytes.
6. Existing asset/file identities, dependency links and opaque metadata remain preserved on reselection.
7. Stored descriptors include original filename, MIME type, byte length and chunk SHA-256 identities.
8. Immutable Blob storage survives JSON metadata cloning.
9. File bytes and revised project metadata commit in one existing IndexedDB transaction.
10. Quota failure rolls back both file bytes and metadata.
11. Storage/state conflicts reject before publication.
12. Dirty edits, active recording and shutdown reject transfers.
13. A second overlapping file/archive transfer is rejected.
14. Cancellation invalidates the operation; bounded hash reads check cancellation between chunks.
15. Native cooperative shutdown refuses an active file transfer.
16. Fresh repository reads verify retained byte length and hashes before use.
17. Original-file download is connected to verified retained storage after reopen.
18. Manual generic Backup routes reference-bearing songs through the binary archive even without long WAV.
19. Automatic Backup also routes reference-bearing songs through that archive.
20. Legacy references with no retained bytes fail full archive creation rather than reporting complete Backup.
21. Archive combines long WAV and reference originals, packing shared identities once and rejecting conflicts.
22. Preview verifies every retained byte before writes; confirmed Restore revalidates and commits additively.
23. Restore remaps retained binary identities while retaining original asset relationships, mixes, MIDI, unknown fields and existing destination songs.
24. File chooser, storage status, reselection and original download adapt to small screens; new IDs are encoded in inline handlers and names escaped. Host/standalone loaders and stylesheet cache keys are refreshed.

This is 24 small production behaviors, not 24 completed major features. Generic retained files are byte preservation, not new audio decoding or AI processing. Users explicitly select the file associated with a legacy reference; file association is not guessed from filenames or paths. Replacement retains old stored bytes; automatic binary garbage collection is not introduced.

## Verification

Full Node, Python, all-JS syntax and whitespace results plus final exact-head CI will be recorded in the Draft PR. Transactional regressions cover actual Blob preservation, independent reopen, three reference fields, generic/manual/automatic Backup, mixed WAV/MIDI archives, duplicated shared assets, opaque metadata/dependency preservation, corrupt bytes, cancellation, quota rollback, dirty states and escaped UI identifiers. The existing real Chrome production script adds file chooser/reload/archive/additive Restore and viewport checks at 1440/820/390, with console/external-request arrays required empty.

Local Swift/Xcode/Chrome have not passed: Swift/Xcode unavailable; Playwright browser download returned invalid ZIP content. CI evidence is reported separately and only after success. Virtual MIDI/browser evidence does not establish physical Keystation or WKWebView persistence.

## Formal completion and remaining software

No.22/23/20 and No.25 protection are closer to completion. No major feature is promoted to A or B: A0/B0/C30 remains the conservative evidence-based classification. No completion percentage or claim that 100% is reached.

Remaining software includes automatic linkage of all import/backend generated artifacts into retained originals, Cloud Sync architecture and conflict/encryption implementation, native independent-process song migration/update/distribution, model/runtime/license asset closure, production AI vocal/harmony/pitch/timing/recording flows, mastering LUFS/true peak and package export, and complete requirement/evidence mapping across all 30 major features. Archive preserves selected bytes; it cannot recover files never selected or absent from storage. JSON remains metadata-only for referenced files.

Mac-only acceptance: Intel Keystation capture/Stop/reopen/play/edit; app red-window close/Cmd-Q/relaunch and update/migration; Helper/signing/notarization, real conversion accuracy and Logic round trip. iPad-only acceptance: file picker permissions, touch/Japanese layout, WKWebView suspension/termination/relaunch and real storage quota. No user saved songs/backups accessed, no Live Provider calls, no Ready/Merge/Auto Merge/force push.
