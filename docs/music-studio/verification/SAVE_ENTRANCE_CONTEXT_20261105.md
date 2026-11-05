# Save-entry context isolation — 2026-11-05 JST

Baseline: PR #589 / c14e2dced5d36d9df3b504f74713f41bca27ab35, 13/13 workflows successful (GitHub API checked this session).

## Production corrections

- MIDI new/duplicate import writes its metadata history through the original repository. It checks both repository and import-preview identity after project publication and after history reads, retaining the committed project receipt without replacing another view or routing to it. History display failures no longer misreport the committed project as an unsuccessful import.
- AI new-song, MIDI test-project, form new-project and external-MIDI creation skip view publication after a repository switch. Project duplication and MIDI-material forks return committed/refreshPending receipts after a switch; the source and its saved history remain unchanged.
- A delayed project-list read no longer overwrites a replacement repository view or project state changed while the read was pending. This matters because the list is later used as input to editing and backup operations.

Nine new regressions cover new/duplicate MIDI import at project and history boundaries, AI creation, duplication, material fork and two stale-refresh cases. The five create/fork/refresh regressions all fail against original production source and pass on the fix. Focused full files: 181 passed, zero failed. Complete Node regression: 2,877 passed, zero failed/cancelled/skipped, 252,610.035392 ms. VM/memory boundary tests are not process-crash or physical power-loss evidence.

## Save-entry acceptance matrix additions

| Entry | New local boundary evidence | Real-browser extension | Remaining gap |
| --- | --- | --- | --- |
| MIDI new/duplicate import | Commit and history repository switches; original source unchanged, committed project reloaded | Existing create/fork storage coverage | Each MIDI public entry process interruption and atomic cross-store history publication |
| AI creation and project duplication | Committed source/provenance retained; replacement view unchanged | Existing SIGKILL/restart/retry for both | Each form/test/import entry and uncertain commit handling |
| Material-derived project | Committed receipt and provenance retained; source unchanged | Added SIGKILL/restart/retry | All user-facing material form boundaries |
| Checkpoint save | Existing Node lifecycle regressions | Added SIGKILL/restart/retry and session link | Every adopt/Undo/Redo public boundary |
| Session finish | Existing Node migration/recovery regressions | Added SIGKILL/restart/retry | All Session public boundaries |
| Refresh | Repository switch and same-repository editor mutation reject stale list | Existing reopen coverage | Complete concurrent background-reader audit |

Browser extensions are pending execution until a successful exact-source CI step is recorded. No local browser run is claimed: this runtime has no Chrome executable.

## Requirements

MS22-A04 and MS30-A02 remain open; these additional entrance checks do not establish their complete acceptance. No new verified IDs. 62/135 verified, 73 open, 45.93%. The 73 consist of 10 existing-implementation acceptance gaps and 63 requirements awaiting specification/model/licensing decisions. B=30 and C=18 remain separately managed. MS12-A02 (all long-recording recovery paths), MS19-A03 (including discontinuous true-peak conformance), and MS30-A03 (all finished-version edit entrances) also lack complete evidence; no relaxed acceptance or model selection is made here.

Next priority: MIDI project/import-history atomic publication; remaining binary/save/journal entrance crash cases; full finished-snapshot immutability coverage. Physical Mac, microphone, listening and actual power loss remain unverified.
