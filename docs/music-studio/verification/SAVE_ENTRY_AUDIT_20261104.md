# Save entry audit — 2026-11-04 JST

Baseline: PR #581, `a75fbbe72c3dfe614cc3b03134044c067dbbdd91`.

This is a source inventory of direct repository writes through `target`/`repository` in music-studio.js, not an assertion that every public wrapper or transaction has passed crash acceptance. Repository methods and delegated modules also require review.

| Enclosing production function | Repository operation | Source line |
|---|---|---:|
| `versionCommit` | `compareAndFork` | 367 |
| `versionCommit` | `compareAndPut` | 367 |
| `loadSettings` | `putSettings` | 637 |
| `importScoreVocal` | `putLongWav` | 899 |
| `saveLyricsAssignment` | `compareAndPut` | 1055 |
| `pcmCommit` | `compareAndPut` | 1403 |
| `retainReferenceFile` | `putLongWav` | 1448 |
| `recoverMissingBinary` | `putLongWav` | 1573 |
| `restoreLongWavArchive` | `restoreLongArchive` | 1736 |
| `pcmImportLongFile` | `putLongWav` | 1782 |
| `vocalJournalAction` | `deleteVocalJournal` | 2032 |
| `vocalStart` | `createVocalJournal` | 2127 |
| `vocalStart` | `appendVocalJournal` | 2130 |
| `vocalSave` | `putLongWav` | 2165 |
| `vocalEdit` | `compareAndPut` | 2177 |
| `vocalWorkspaceWrite` | `compareAndPut` | 2191 |
| `vocalReplacementApply` | `putLongWav` | 2400 |
| `vocalCompEdit` | `compareAndPut` | 2410 |
| `vocalCompSave` | `putLongWav` | 2425 |
| `vocalPublishForMix` | `putLongWav` | 2490 |
| `saveWorkspace` | `putSettings` | 3106 |
| `createMidiTestProject` | `put` | 3232 |
| `performMidiExport` | `putMidiHistory` | 3234 |
| `saveMidiImport` | `compareAndFork` | 3408 |
| `saveMidiImport` | `put` | 3408 |
| `saveMidiImport` | `putMidiImportHistory` | 3408 |
| `importExternalSongFile` | `put` | 3430 |
| `instrumentProjectCommit` | `compareAndPut` | 3581 |
| `saveMidiEditorSnapshot` | `compareAndPut` | 4038 |
| `saveMidiEditorSnapshot` | `put` | 4038 |
| `createAIProject` | `put` | 4040 |
| `submitCreate` | `put` | 4115 |
| `duplicateProject` | `put` | 4132 |
| `askDelete` | `delete` | 4133 |
| `importText` | `compareAndPut` | 4157 |
| `persistSettings` | `putSettings` | 4175 |
| `restoreBackup` | `restoreMetadata` | 4230 |
| `performAutoBackupCheck` | `deleteAutoBackup` | 4274 |
| `performAutoBackupCheck` | `putAutoBackup` | 4274 |
| `saveCurrentProject` | `compareAndPut` | 4279 |
| `midiRenderForMix` | `putLongWav` | 4655 |
| `finalSave` | `compareAndPut` | 4852 |
| `finalRecordDelivery` | `compareAndPut` | 4870 |
| `materialCapture` | `compareAndPut` | 5005 |
| `materialImport` | `compareAndPut` | 5013 |
| `materialCreate` | `compareAndFork` | 5024 |

## Tested boundaries

`scripts/music-indexeddb-browser-persistence.cjs`: real browser process SIGKILL during a held, successful IndexedDB request; restart verifies exact equality of the entire project list, retry must change state, second SIGKILL/restart verifies exact committed equality. Entries: productionDaySave, productionSessionSave (finish), versionSave, materialCapture, materialImport, importText (collision), finishedOpen, restoreBackup, pcmImportLongFile. Fixture retains sessions, days, checkpoints and MIDI material history.

`tests/music-production-tools.test.js`: material capture/import now record session-linked automatic edits; failed CAS leaves storage and UI unchanged, additive restore retains edits, sessions and productionHistory.

## Open scope

MS22-A04 and MS30-A02 remain open. Outstanding: individual editor and AI publication paths, binary/journal/automatic-backup/settings/MIDI-history transaction crash coverage, delete paths, native file paths, and all public wrapper conditions. No uncertain commit boundary or power-loss guarantee is inferred. This matrix only covers the listed nine entry operations; PCM import also verifies binary rollback (no orphan) and exact committed binary bytes after restart.

## Decisions required before dependent implementation

The following is the existing category C decision list from the formal ledger. No model, quality threshold or license choice is assumed. Each decision needs explicit selected behavior/model version, offline/online contract, budget, quality acceptance examples and redistribution/commercial-use permissions where relevant.

| ID | Decision |
|---|---|
| MS03-C01 | 音声解析方式と品質閾値 |
| MS04-C01 | 文章理解・作曲モデルとライセンス・品質基準 |
| MS05-C01 | 会話理解モデルと実行権限契約 |
| MS07-C01 | 生成モデルとSection配置方針 |
| MS08-C01 | Destinationと音源生成モデルの契約 |
| MS09-C01 | 実音声コード解析モデルと品質基準 |
| MS10-C01 | 歌詞生成モデル・読みアクセント方式 |
| MS11-C01 | 歌唱モデルの配布ライセンスと品質基準 |
| MS14-C01 | 本人声モデルと同意・ライセンス |
| MS16-C01 | 分離モデルweightと再配布許諾 |
| MS17-C01 | 変換モデルの対象楽器と精度基準 |
| MS20-C01 | Logic直接操作とlogicxの公式方式 |
| MS21-C01 | 音源と依存物の再配布条件 |
| MS23-C01 | Cloud Sync同期先・暗号化・競合・offline方針 |
| MS25-C01 | 対象モデルの容量・配布許諾・署名公証方式 |
| MS26-C01 | 有料Provider・価格根拠・課金取消契約 |
| MS27-C01 | Provider交換と旧モデルの互換方針 |
| MS29-C01 | 文章意味検索モデルとライセンス |

Local validation: 2,843 Node tests passed, zero failed (`node --test`); checkpoint browser completed with no errors; nine-entry process-kill matrix passed. Local browser binary: @sparticuz/chromium (npm distribution); canonical Playwright 1.58.2 browser remains the CI environment. Full ledger validation passed after refreshing existing acceptance proof digests from these successful executions. No new verified requirement IDs.
