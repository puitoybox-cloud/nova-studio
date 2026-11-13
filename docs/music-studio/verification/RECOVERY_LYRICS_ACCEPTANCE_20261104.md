# Recovery and lyric acceptance — 2026-11-04 JST

Baseline: PR #583, `e7ccc3edc8cf4b2e29157064272ccf9c037cc42c`; GitHub connector verified 13/13 successful workflows.

## Production corrections

- Missing-binary recovery now appends a session-linked `dependency-recovery` audio event in the same `putLongWav` transaction as authenticated original bytes and project revision. Existing matching binaries remain idempotent; corrupt binaries remain protected. Checkpoint snapshots and original descriptors are unchanged.
- Lyric follow tracks the actual active DOM element as well as the lyric index, so rerendered panels recenter without advancing the transport. Stop removes current/ARIA markers. Saved assignments, tempo maps and audio are untouched.

## Acceptance decisions

| ID | Conditions and evidence | Decision |
|---|---|---|
| MS24-A04 | Explicit file submission; no-file refusal; wrong hash; quota; cancel before/during hashing; concurrent source write; fresh-runtime reopen/retry; atomic receipt and bytes; idempotent repeat; archive receipt roundtrip; real Chromium SIGKILL during the active binary/project transaction and retry | verified after successful current-source regression |
| MS12-A04 | Explicit saved track; variable tempo; rest and stale/duplicate rejection; real DOM highlight/scroll; same-index rerender; count-in; stop cleanup; persisted assignment timing | verified after successful current-source regression |
| MS22-A04 | Missing-binary transaction SIGKILL added; all public saves and transaction families still need full kill-boundary coverage | open |
| MS30-A02 | Missing-binary receipt fixed; creation/fork and remaining special-action policy/coverage still incomplete | open |

## Save publication call sites

This lexical inventory lists direct `target`/`repository`/`journalTarget` writes in the current production file. It complements the transaction-family inventory in SPECIAL_SAVE_HISTORY_20261104.md. Wrapper actions, aliased stores, archive/journal internals and external delivery boundaries must also be covered before MS22-A04 is complete. It does not claim exhaustive crash acceptance.

| Production function | Persistence method | Source line |
|---|---|---:|
| `versionCommit` | `compareAndFork` | 371 |
| `versionCommit` | `compareAndPut` | 371 |
| `loadSettings` | `putSettings` | 641 |
| `importScoreVocal` | `putLongWav` | 903 |
| `saveLyricsAssignment` | `compareAndPut` | 1059 |
| `pcmCommit` | `compareAndPut` | 1407 |
| `retainReferenceFile` | `putLongWav` | 1452 |
| `recoverMissingBinary` | `putLongWav` | 1578 |
| `restoreLongWavArchive` | `restoreLongArchive` | 1741 |
| `pcmImportLongFile` | `putLongWav` | 1787 |
| `vocalRecoverJournal` | `sealVocalJournal` | 1994 |
| `vocalRecoverEncodedJournal` | `sealVocalJournal` | 2015 |
| `vocalJournalAction` | `deleteVocalJournal` | 2042 |
| `vocalImportRescue` | `importVocalJournal` | 2087 |
| `vocalPCMRecorder` | `closeVocalJournal` | 2098 |
| `vocalPCMRecorder` | `appendVocalJournal` | 2108 |
| `vocalStart` | `createVocalJournal` | 2137 |
| `vocalStart` | `appendVocalJournal` | 2140 |
| `vocalStart` | `sealVocalJournal` | 2145 |
| `vocalSave` | `putLongWav` | 2175 |
| `vocalEdit` | `compareAndPut` | 2187 |
| `vocalWorkspaceWrite` | `compareAndPut` | 2201 |
| `vocalReplacementApply` | `putLongWav` | 2410 |
| `vocalCompEdit` | `compareAndPut` | 2420 |
| `vocalCompSave` | `putLongWav` | 2435 |
| `vocalPublishForMix` | `putLongWav` | 2500 |
| `saveWorkspace` | `putSettings` | 3116 |
| `createMidiTestProject` | `put` | 3242 |
| `performMidiExport` | `putMidiHistory` | 3244 |
| `saveMidiImport` | `compareAndFork` | 3418 |
| `saveMidiImport` | `put` | 3418 |
| `saveMidiImport` | `putMidiImportHistory` | 3418 |
| `importExternalSongFile` | `put` | 3440 |
| `instrumentProjectCommit` | `compareAndPut` | 3591 |
| `saveMidiEditorSnapshot` | `compareAndPut` | 4048 |
| `saveMidiEditorSnapshot` | `put` | 4048 |
| `createAIProject` | `put` | 4050 |
| `submitCreate` | `put` | 4125 |
| `duplicateProject` | `put` | 4142 |
| `importText` | `compareAndPut` | 4167 |
| `persistSettings` | `putSettings` | 4185 |
| `restoreBackup` | `restoreMetadata` | 4240 |
| `performAutoBackupCheck` | `putAutoBackup` | 4284 |
| `performAutoBackupCheck` | `deleteAutoBackup` | 4284 |
| `saveCurrentProject` | `compareAndPut` | 4289 |
| `midiRenderForMix` | `putLongWav` | 4665 |
| `finalSave` | `compareAndPut` | 4862 |
| `finalRecordDelivery` | `compareAndPut` | 4880 |
| `materialCapture` | `compareAndPut` | 5015 |
| `materialImport` | `compareAndPut` | 5023 |
| `materialCreate` | `compareAndFork` | 5034 |

## Remaining work

The 75 baseline open A requirements were reviewed against dependency declarations and current software evidence: 63 still declare C dependencies and 12 have no declared C dependency. This batch closes two of the latter; the other ten stay open. No dependency was removed to increase counts.

Next software priorities: remaining project/fork/archive/automatic-backup/journal/settings crash boundaries and special history provenance; full recording-interruption acceptance; waveform/lyric/note resume; all-material mix; independent discontinuous true-peak accuracy; audible checkpoint A/B; edit-state navigation/accessibility; finished snapshot invariance. Model/provider, cloud conflict policy, supported material formats, rights declarations and distribution licensing require their recorded C decisions.

Intel Mac, microphone hardware, listening and power-loss acceptance remain separate. Chromium tests use actual process-group SIGKILL and reopened persistent profiles; they do not emulate a power cut.

## Validation

Current-source results and hashes are stored in verification/music-recovery-lyrics-browser-20261104.json and the refreshed Node/Checkpoint proofs. Targeted Node regression: 60 passed, 0 failed. Browser: 2 passed, 0 failed. Checkpoint report: completed=true, errors=[], external=[]. Full regression result recorded in verification/music-macless-node-summary.json.

Final full regression: 2,844 passed, 0 failed (138,468.665356 ms), concurrency=4. Ledger validation passed: 62/135 verified, 73 open, 45.93%. MS22-A04 and MS30-A02 remain open.
