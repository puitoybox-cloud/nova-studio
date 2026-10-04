# 保存契約候補：依存closure・容量・権限・復旧の技術証拠

確認日：2026-10-04 JST。取得した#292 HEAD `29a9223d23a16bb4de5cac0040ce6867dd4a7201`を基準に確認。第2段階、#22/#23/#25/#27。A/B/Cの採用は決定しない。以下はコードの証拠と未確認を分けた報告であり、保存schemaではない。

## 容量と寿命の境界

| 対象・証拠 | コードから確認できる事実 | 確認できないこと／必要な次調査 |
|---|---|---|
| `music-studio.js` indexedDbRepository | DB version 5、projects/settings/autoBackups/midiHistory/midiImportHistory。put経路はclone後にstoreへ渡す。binary専用store・content index・pin/GC契約は確認できない。 | IndexedDB自体のbinary可否・quotaはこのコードでは証明しない。Mac/iPadの容量・eviction・失敗・再起動・永続性をBatch A/Bで測定。 |
| 同clone / exportProject / backupObject | cloneはJSON stringify/parse。exportProjectはcloneとmarkExternal後、整形JSON textを作る。BackupもProjectをcloneする。音声本体を含まない既存metadata契約。 | Blobを今のProjectへ入れて保存できるとは推定しない。binary→JSON encodingや最終形式を採用しない。memory peak・copy回数の実測なし。 |
| 同runAutoBackupCheck | snapshotとJSON textを作り、TextEncoderがあればUTF-8 byte数、なければtext.length×2。`bytes > 4*1024*1024`でtoo-large。等号はこのgateでは拒否されない。成功後maxCopies以降を削除。 | この4,194,304は既存autoBackupの計算値gateであり端末quota・Project上限・manual Backup上限ではない。binary snapshot複製を将来足す場合のmemory/serialization/途中失敗を別に測定。 |
| 同revision / productionHistory / MIDI履歴 / aiWorkspace.history | revisionは保存世代。productionHistory、MIDI import/export履歴、AI制作履歴は別のmetadata経路。 | これらを音声Version・Take・Checkpoint・binary保持期間と同一視しない。 |
| `music-studio-editor.js` snapshot/change/undo/redo | snapshotはmidiData等のclone。changeのUndo配列は100を超えるとshift、Redoを消去。音声本体のpin契約はない。`music-studio-ai-family-apply.js`もJSON clone。 | 100は既存MIDI Undoの境界であり音声保持policyではない。将来binaryをsnapshotへ置く場合の重複可能性、参照だけの場合の元byte寿命を契約reviewへ残す。 |
| Take / Audio Version / Checkpoint | #292までのコードで最終永続schemaを確認できない。今回のgraphは呼出し側が明示したレビュー用関係だけ。 | 同content複数assetと同asset別contentを区別する方式、dedup/pin/GC/retentionはF。共有binary nodeへの参照は一回走査するが、実storage dedupの証明ではない。 |

実測capacity、serializationのmemory peak、Mac/iPadの最大値は確認できません。申告byteLength合計は実容量ではなく、論理binary nodeの申告合計。未申告数とsafe integer overflowを別報告する。content一致を推測して合計から差し引かない。

## 権限・所有権

`music-studio.js` inspectAudioReference / markExternal、`music-studio-dependency-inspection.js`はmetadata。一時参照、external、requiresReselection、declared missingは表現可能だが、moved/deleted/offline/permission失効の実原因をこの情報だけで区別できない。URLとassetIdを存在証明にしない。HTTP URLや外部参照からmanaged ownershipを推定しない。今回reportは参照URL・digest値を出力しない。

`music-studio-audio-pipeline.js` processAudioLocally/importAudioFileは明示file入力を既存loopback Helperへ渡し、MIDI処理結果とsource filename/stem metadataを扱う。元音声binaryのmanaged永続保存・Take寿命を証明しない。今回この経路は実行しない。新moduleにfile handle・repository・fetcherは渡さない。権限要求、copy、relink、repair、delete、migrationなし。

permissionはunverified/unavailable/requires-reselectionの申告を分離。granted申告をbyte verificationへ格上げしない。managed/externalはownershipClaimで、検証はunverified。contentClaimはalgorithmとdigestがあるかだけを検査する非永続レビュー入力。algorithm採用・digest形式・byte照合は実装しない。digestMismatch=trueも「不一致の申告」であり実計算ではない。

## closure・Backup・復旧

`music-studio-dependency-closure-inspection.js`はCommonJS明示呼出し専用。production HTML/loaderへ接続しない。`inspect(project, review)`のreviewはnodes/edges/rootsの非永続レビューgraph。現在のProjectからTake/Version/Checkpoint/Model/Plugin schemaを推測しない。nodeのkindは検査対象を分類するためであり将来schemaの採用ではない。

既存inventoryを再利用。現asset IDはlogicalAssetId、binary nodeとcontentClaimは別。既存asset→明示logical mapping→binary/external nodeが不足ならunmodeledとして報告。重複IDは曖昧targetへ結ばず、欠損edge・malformed・未知kind・version契約未決定・孤立nodeを報告。cycle-safeな走査で到達範囲を表現する。入力に書かれていない依存は検出不能なのでexhaustive=unverifiedを維持する。

coverageのincluded/excluded/external/missing/unverifiedは申告で、temporaryはnon-portable、権限再選択はrequires-reselection、未知kindはunsupportedとして別報告。included申告でもbyte存在・digest・所有権はunverified。現Backupはmetadata-only。空Projectや全included申告でもcompleteはnot-established、restoreReadyはfalse。

既存`restoreBackup`はversion 1 metadataの追加復元で、Project単位の失敗を数えて処理を続ける。将来のcomplete binary Restoreに必要な全体atomicityは証明できない。現在のRestoreを変更しない。将来gateにpartial-failure/missing-binary/unknown・unsupported version/duplicate identity/digest mismatch/external unavailable/permission unavailableを列挙。実binary Restoreは行わない。

sessionはProjectとreview両方のJSON snapshotを比較しstale拒否、Cancel後は再検査拒否。reportはProject/IndexedDB/Backupへ保存しない。unknown fields保持、Save/Reopen/JSON/Backup/legacy zero-writeは合成repositoryで検証。保存や復元成功そのものの物理証明とは区別する。

## Standaloneと次工程

`scripts/music-studio-standalone-dependency-inspection.js`の既存静的配布検査を継承。`music-studio.html`のローカルscript/style、Audio HelperのPython/Model、native WKWebView/CoreMIDI、host navigationを分離する。新graphはModel/Plugin/Helper/native MIDI/host/externalをruntimeDependenciesへ分けるが実行互換PASSではない。metadataだけで開けるかも今回のreportではunverified、physicalVerification=pending。

次は第2段階の残る契約review：レビューgraphを将来の実依存resolver・byte検証へ接続する条件、容量実測手順、権限失効と復旧原子性の受入条件。A/B/C、binary形式、hash/digest、Take/Version/Checkpoint/package schema、GC/retention、Cloud/暗号化/conflict、Provider/料金/Model/Logic policyはFを維持。#22/#23/#25/#27判定変更なし、A 0/30。Batch A/Bに容量・file permissionを集約し、音声制作完成後のBatch Cにbyte移行・完全復旧を残す。
