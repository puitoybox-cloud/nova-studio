# Audio / Take / Version / Checkpoint / complete Backup：レビュー用契約候補

確認日：2026-10-04 JST。基準：#291 `58ea34fa6c6ef14a070f84664f49621d7d9323a1`。第2段階。これは保存policyの採用決定ではない。

## 現在確認できる契約

- `music-studio.js` makeProject/validateProject：Project format/schemaVersion/revision、audioAssets/midiAssets/fileReferences。revisionは整数の保存世代であり音声Versionではない。Take/音声Version/名前付きCheckpointの保存契約は確認できない。
- createRepository：IndexedDB v5のprojects/settings/autoBackups/midiHistory/midiImportHistory。既存ストアを変更しない。memoryRepositoryは合成検証に使えるが物理容量・永続性を証明しない。
- backupObject/markExternal：Version 1 JSON、参照metadata、binariesIncluded=false、再選択。validateBackupは未知Backup versionを拒否。restoreBackupは追加復元で既存Project衝突時は新IDを生成、AI workspaceを再bindingする。完全音声Backupではない。
- JSON exportは既存Projectのclone。unknown fieldsを検査が削除しないことと、全既存作成・変換経路がunknown fieldsを保存することは別の保証である。
- EditorとFamily ApplyのUndo/Redoは既存snapshot/atomic transaction。productionHistory、aiWorkspace.history、MIDI import/export historyは異なる履歴。binary寿命・削除・GCとUndo保持期間は未契約。
- audio pipeline/外部音声取り込みは処理結果・一時参照を使う。参照文字列・assetId・derivedFromAssetIdはchecksum、byte存在、所有権、権限、可搬性の証明ではない。blob/data参照は移行先の解決契約がない。
- 既存dependency inspectionはメタデータのmissing/duplicate/unknown/temporary/reselection/derived identityを報告する。外部ファイルを開かない。Standalone inventoryはscript/style、Helper、native MIDI、host navigationを分離するがMac/iPad互換性を証明しない。

## 将来必要になる契約（永続schemaへ追加しない）

| 関係 | 必要な確認／失敗境界 |
|---|---|
| Asset identityとcontent identity | 論理IDとbyte digestを分離。同じIDの異なるcontent、同じcontentの複数IDを区別。digest方式は未決定。 |
| Project→asset | revision/明示参照/対象Track、欠損・曖昧IDで無断relinkしない。外部URLからmanaged所有権を推定しない。 |
| Take→Project/asset | 元録音、編集、Comp、immutable元音声、Undo、キャンセル時の孤立byteの扱い。最終schema未決定。 |
| Audio Version→Project/asset | 元版と非破壊recipe、render結果、Model/DSP provenance、互換version、欠損元音声。Project revisionとは別。 |
| Checkpoint→snapshot/dependency closure | 参照だけかbyteをpinするか、復元可能範囲、未知版、履歴/Undo境界。名前付き復元の仕様判断が必要。 |
| Complete Backup→closure | Project・音声・Take・Version・Checkpoint・必要Model/Plugin依存のmanifest、含めない依存と不足を明示。digest/容量/原子的復元/途中失敗。 |
| Standalone→external dependency | Helper/native MIDI/host navigation/Model/Plugin/権限を区別。依存を含めるだけでLicenseや実行互換PASSにしない。 |

## 保存案の比較（全案F、採用しない）

| 比較軸 | A：Project内binary | B：分離managed binary store＋manifest | C：外部file参照＋任意portable package |
|---|---|---|---|
| 既存Project | 拡張formatと旧loader拒否/保持の調査 | 旧metadataを保持し明示mappingが必要 | 現参照に近いが権限/再選択契約を拡張 |
| 既存Backup | 現JSONがbyteを運べると推定不可 | 別packageと既存JSONを明確に区別 | metadata-onlyとportable packageを区別 |
| Standalone | loader/容量/復旧処理が必要 | manifest resolverが必要 | file権限と再選択、package resolver必要 |
| Mac/iPad | quota・Blob/serialization・memory実機調査 | browser store/FS API可用性・quota実機調査 | Files/permission lifetimeの実機調査 |
| binary容量 | snapshot重複/serialization peakの可能性、未計測 | dedup/pin/GC設計、未計測 | 外部容量とpackage複製、未計測 |
| 移行安全 | atomic更新と旧schema preservation必要 | metadata/byte整合transaction必要 | 既存参照を無断書換せず明示選択 |
| missing | 元byte不足を報告、復元しない | manifest missing/digest mismatch拒否 | offline/permission/movedを区別 |
| external | managed copy同意/権利が必要 | managed/external ownershipを明示 | 元externalを保持、URLは存在証明でない |
| Cloud Sync | 大きなProject transferの調査 | content identity/sync順序/conflict調査 | portable packageと外部権限の調査 |
| Undo/Redo | snapshot byte保持/容量を調査 | pinされた履歴の寿命を調査 | 参照復元だけでは音声復元不可 |
| Version | 複製かrecipeか未決定 | 元byte/recipe/render dependency closure | 外部元音声の変更検知が必要 |
| Checkpoint | byte含有/保持範囲を未決定 | pinされたclosureの寿命を未決定 | 不足依存時の復元限界を明示 |
| 完全Backup | package/hash/atomic restore未決定 | manifest＋byte回収の検証が必要 | externalを含む/除外する同意と不足報告 |

容量の数値比較は確認できません。実音声長・channel・encoding・複製回数・端末quotaの証拠がないため推定値を置かない。

## 今回の機械検査の境界

`music-studio-storage-contract-inspection.js`は明示呼出し専用CommonJSモジュール。production loaderへ追加しない。既存inventoryを再利用し、content identity/ownership/portabilityをunassessed/unverifiedとして報告。temporaryだけをnon-portableと報告する。external metadataをmanagedと認定しない。

Backup version 1のmetadata-only inspectionを行う。unknown/unsupported version、malformed projects、binary inclusionの未検証宣言を報告する。参照不足とbinary未確認を区別し、空ProjectでもcompleteBackup/Standalone portabilityをPASSにしない。返すvalidはenvelope検査結果でありProjectの完全妥当性や復元成功ではない。

sessionは全JSON snapshotでstale拒否、Cancel。呼出しにrepository/IO handleを渡さない。binary取得、checksum実計算、repair/migration/import/relink/delete/保存をしない。機械reportをProjectへ保存しない。

## 保留と次工程

binary形式/IndexedDB直接保存/Take・Version・Checkpoint schema/完全Backup形式/Cloud同期先・architecture・暗号化・conflict/Provider・料金/Local・本人声Model/Logic直接編集はF。#22/#23/#25/#27判定変更なし、A 0/30。次は第2段階の契約reviewと必要な技術調査。writeの前に保持範囲、依存closure、容量・権限、復旧失敗境界を仕様化する。実機はBatch A/B/Cのまま集約。
