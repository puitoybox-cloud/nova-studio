# Native saved-song continuation — 2026-10-22 JST

Base: PR #490, `550034326b3bc8dd3a230275fcaf65d3f98b9fa4`.
Main observed through `git ls-remote`: `552d56eafddfd192970c09f7d6278696cf8775c3`.
GitHub latest-PR search returned #490 as latest at start. Existing PR/main refs are not modified.

## Production changes

- A native save timeout refuses termination once, but retains close admission until the original WebKit save callback settles. A retry cannot overlap the still-running save. The engine stays alive through the existing refused-termination path.
- Shutdown refuses active final-export, lyrics-editor and AI workspace persistence operations before flushing MIDI. These operations previously were missing from `shutdownBusy()`.
- Swift regression holds the actual page save promise beyond a short native timeout, attempts a second close, releases the first save and verifies that a later close succeeds. This is a disposable WebKit fixture; it is not edited-song native app acceptance.
- Node regressions verify that final-export/lyrics busy states retain dirty notes and the original stored revision, and allow saving after completion.

## Verification

Local shutdown tests: 21/21 PASS.
Local audio Python: 509 run, 504 PASS, 5 inherited skips. ResourceWarnings were emitted; this is not a warning-free run.
Full Node and all tracked JavaScript syntax checks: running when this record was created; final results belong to PR/exact-head CI.
Local Swift/WebKit/Xcode are unavailable on this Linux host. Swift regressions run in existing Intel CI.

## Required acceptance still open

The full native `.app` UI sequence with MIDI, lyrics, AI candidates, audio, file references and history, two complete process restarts and backup restoration into a separate store is NOT verified by this patch. No fixture/API-only test is substituted for it. Input unlocking after save approval, origin/update migration and the complete saved-song native acceptance remain open.

No.20 long Logic WAV return, No.21 complete delivery acceptance, transitive release licenses, signing/hardened runtime/notarization remain open. No new demo/audio assets, Provider calls or signing credentials are introduced. No physical Intel Mac/iPad/Logic acceptance is claimed.

Formal status retained: A0 / B0 / C30. This patch does not close a complete formal feature. The original 2026-09-30 specification is referenced by the inherited `music-intel-package-30-features-20261022.json`; it was not re-read from its PDF in this Work. Shared save/close improvements apply to No.22 and No.23, with export-in-progress protection also relevant to No.21. No B promotion.

Next priority remains native edited-song save/quit/relaunch/reopen/edit/resave plus isolated complete-backup restore; only then No.20/21 production residuals.
