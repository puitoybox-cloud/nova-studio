# Long WAV portable recovery — 2026-10-09 JST

## Outcome

Add working Full WAV Archive export/import controls to the existing Backup screen. The versioned binary container holds project JSON, settings and original WAV Blob slices; it does not base64-encode or read the entire input archive into an ArrayBuffer. Manifest size is capped at 64 MiB. Existing JSON backup/restore behavior remains intact.

Before committing recovery, verify every 1 MiB SHA-256 chunk, WAV sample validity, frame count, sample rate, channel count, manifest entry identity/size/order, missing and trailing bytes. Reject projects with external MIDI/audio/file references: this archive cannot honestly include those unowned binaries. Preserve inline short PCM, MIDI project data and unknown project fields. New project and WAV identities preserve existing songs. Settings, projects and WAV records commit in a single add-only IndexedDB transaction; request/constraint/quota failures abort all writes. Repository/editor-state changes, cancellation and settings conflicts refuse success. Transaction timeout aborts a stuck recovery. No partial success message is emitted.

## Evidence

Latest GitHub inventory: 108 Open PRs, 106 Draft; all Drafts mergeable, two older non-Draft PRs #10/#35 conflicting. Metadata, HEAD/base, commit and file counts and PR-event Actions re-read for all 108; see inventory JSON. Actual file diffs and historical logs were not exhaustively re-audited. Latest safe checkpoint #361 HEAD 0ece49e1b1767e221c9ce5708a97bdc823c19eba, base e60c44209fbed9c3ce710db1b505a01908101b36. Main 552d56eafddfd192970c09f7d6278696cf8775c3. Independently retrieved create-event run 37929671146 SUCCESS and decoded software/native job logs. PR-filtered empty runs are not interpreted as failed CI.

Node full suite 1960/1960 PASS; six new archive regressions, 12 storage/restore tests total. The 2,100,000-frame original WAV is 4,200,044 bytes. Whole-input archive reads are prohibited in the portability test. Reopen byte equality, mixed inline PCM, unknown/MIDI metadata, missing/corrupt/trailing data, capacity rollback, cancellation/stale editor and repeated restore are covered. The structured-clone IndexedDB transaction model is not real browser durability proof. Its add key handling was corrected to respect projectId as well as binary id.

Python: 508 run, 503 PASS, five unchanged optional-dependency skips. All 180 tracked JS syntax, 53 Python compile, five shell syntax and diff whitespace PASS. New offline create-event workflow uses existing runner tools, no installs/downloads/signing. Local Swift/Xcode unavailable. Browser launch failed: missing Chromium executable. 1440/820/390, Console error/warn and external traffic are UNVERIFIED. CI at final exact HEAD is reported in the PR after publication.

## Specification and completion

Read current Music_Studio_最終機能仕様書_v1.pdf in full, five pages, confirmed 2026-09-30, retrieved 2026-10-09. No.23 requires full Backup, migration, dependencies, corruption checking and recovery; this increment closes only the portable local WAV+project+settings recovery gap for archives without external references. No.18 requires volume/EQ/compression plus spatial/collision/audibility/multiple proposals. Long WAV DSP controls, persistent settings, A/B, Undo/Redo and processed export remain disconnected. Binary automatic backups and external reference archives remain unfinished.

The specification does not define numerical weighting or an atomic subrequirement denominator, and the complete current production/physical evidence has not been audited against all requirements. Software %, physical-test-start readiness %, their previous-run deltas and total remaining subrequirements are UNVERIFIED; no guessed numbers. Repository readiness matrix last recorded formal A 0/30; this change adds zero formal A and does not establish a new exhaustive formal audit. One implementation gap is closed at the software transaction-model level; global completion is not claimed.

## Next and physical acceptance

Next: connect authenticated saved WAV to bounded Gain/EQ/Compression render, persist settings and history, then A/B and processed export. Extend archive support to all dependency binaries and automatic recovery.

Physical checks, grouped for later: real IndexedDB close/browser restart and archive recovery; actual quota, abort, blocked upgrade and concurrent tabs; iPad Safari import/download/memory behavior; Intel Mac Audio-to-MIDI accuracy and native package acceptance. No Mac operation requested now.

Draft only. No Ready/Merge/Auto Merge/force/main/existing PR mutation, provider API, install/download/signing, sales, saved-song deletion or backup alteration.
