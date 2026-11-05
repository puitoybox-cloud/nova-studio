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

Browser extensions passed on HEAD ce24a31d47f1b55448c7e333dbebee1ad33d79d1: run 41989093194 / job 127116774549, step 6 (both browser tests successful). Steps 7–8 also passed, covering interrupted journal/backup deletion, Archive rollback/retry, export-only history and production-history contracts. Checkpoint UI/restart passed on the same HEAD: run 41989093155 / job 127116774635, step 7. Both complete workflows succeeded. No local browser run is claimed: this runtime has no Chrome executable. Additional focused storage/recovery suite: 21 passed. Auto-Finish helper suite: 22 passed.

## Requirements

MS22-A04 and MS30-A02 remain open; these additional entrance checks do not establish their complete acceptance. No new verified IDs. 62/135 verified, 73 open, 45.93%. The 73 consist of 10 existing-implementation acceptance gaps and 63 requirements awaiting specification/model/licensing decisions. B=30 and C=18 remain separately managed. MS12-A02 (all long-recording recovery paths), MS19-A03 (including discontinuous true-peak conformance), and MS30-A03 (all finished-version edit entrances) also lack complete evidence; no relaxed acceptance or model selection is made here.

Next priority: MIDI project/import-history atomic publication; remaining binary/save/journal entrance crash cases; full finished-snapshot immutability coverage. Physical Mac, microphone, listening and actual power loss remain unverified.

## Remaining entrance inventory

Reconciled against the 51 lexical publication sites in RECOVERY_LYRICS_ACCEPTANCE_20261104.md. Repeated methods in a function are grouped below; delegated creation writes remain public entries. Lines refer to this production source. Every row still lacks complete entry-level interruption/uncertain-commit/session-history acceptance, even where focused Node/browser cases pass. This table does not count shared transaction tests as full public-entry acceptance.

| Production function | Current source line | Whole entry accepted |
| --- | ---: | --- |
| `versionCommit` | 357 | No |
| `loadSettings` | 648 | No |
| `importScoreVocal` | 892 | No |
| `saveLyricsAssignment` | 1059 | No |
| `pcmCommit` | 1412 | No |
| `retainReferenceFile` | 1440 | No |
| `recoverMissingBinary` | 1568 | No |
| `restoreLongWavArchive` | 1686 | No |
| `pcmImportLongFile` | 1783 | No |
| `vocalRecoverJournal` | 2000 | No |
| `vocalRecoverEncodedJournal` | 2026 | No |
| `vocalJournalAction` | 2047 | No |
| `vocalImportRescue` | 2073 | No |
| `vocalPCMRecorder` | 2108 | No |
| `vocalStart` | 2128 | No |
| `vocalSave` | 2182 | No |
| `vocalEdit` | 2193 | No |
| `vocalWorkspaceWrite` | 2210 | No |
| `vocalReplacementApply` | 2420 | No |
| `vocalCompEdit` | 2434 | No |
| `vocalCompSave` | 2449 | No |
| `vocalPublishForMix` | 2507 | No |
| `saveWorkspace` | 3124 | No |
| `createMidiTestProject` | 3256 | No |
| `performMidiExport` | 3258 | No |
| `saveMidiImport` | 3432 | No |
| `importExternalSongFile` | 3443 | No |
| `instrumentProjectCommit` | 3603 | No |
| `saveMidiEditorSnapshot` | 4061 | No |
| `createAIProject` | 4072 | No |
| `submitCreate` | 4147 | No |
| `duplicateProject` | 4164 | No |
| `importText` | 4183 | No |
| `persistSettings` | 4218 | No |
| `restoreBackup` | 4241 | No |
| `performAutoBackupCheck` | 4295 | No |
| `saveCurrentProject` | 4334 | No |
| `midiRenderForMix` | 4690 | No |
| `finalSave` | 4905 | No |
| `finalRecordDelivery` | 4922 | No |
| `materialCapture` | 5049 | No |
| `materialImport` | 5064 | No |
| `materialCreate` | 5072 | No |

The first expanded browser run failed because the material-create branch was accidentally included in the older AI/duplicate result aggregation. Its separate assertion branch was unreachable. Correcting that test-only dispatch preserved the original assertions and added exact material provenance/pitch checks; the full expanded browser step then passed. Production runtime is unchanged between these two CI heads.
