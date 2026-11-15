# Backup候補とRestore依存closureの比較証拠

確認日：2026-10-04 JST。基準：Draft #293 `d22ad93e738c96bdded6064013f79fd48129bc3c`。第2段階、A 0/30のまま。

`music-studio-package-restore-review.js` は #293 の読み取り専用closureを再利用し、元のreviewとBackup候補reviewを比較する。production loaderに接続しない。入力は呼出し側の申告であり、保存manifest/schemaではない。I/O・権限要求・実Backup/Restore・binary読み出し・hash計算は行わない。

|比較対象|新しい判定|確認できないこと|
|---|---|---|
|到達可能node/root/edge|必要node、root、edgeの欠落。kind/logical asset/file identity/申告sizeの変更|申告されていない実依存、実binary存在|
|共有binary|byte nodeが残っていてもTake/Checkpointからの一つのedge欠落を検出|削除安全性、pin/GC/retention。deletionSafe=falseを固定|
|coverage|必要nodeがincluded以外なら申告比較を拒否|included申告のbyte実在、完全Backup|
|外部参照・一時URL・権限|external recovery未検証、temporary、permission unavailable/reselectionを別報告|ファイル移動/削除/offline原因、実再選択成功|
|URL/content claim|不一致を値を出力せずに報告|内容一致の実検証、hash方式の採用|
|容量|source/package申告binary合計、未申告size|端末quota、staging peak、空き容量、書込み成功|
|Backup全体|Project index別の比較、review件数不一致|Projectをまたぐ同IDのcontent同一性、全体atomic restore|

`declaredClosurePreserved=true` は申告されたgraph間の比較だけ。必ず `exhaustive=unverified`, `binaryExistence=unverified`, `completeBackup=not-established`, `restoreReady=false`, `portablePackage=not-established`を返す。空graphや未知版・重複・欠損を完成扱いしない。追加nodeを明示し、そのsizeも含める。A/B/C、schema、Cloud/provider/model、GC/retentionは未決定のまま。

Project/source/packageのstaleを拒否、Cancel後は再検査しない。合成Save/Reopen/JSON/Backup/legacyを検査してrepository write 0、unknown field保持を確認する。実曲や実Backupを使わない。

次工程：この比較contractに実byte観測を接続する受入設計。観測元/時刻/対象identity/byte lengthと内容照合/失効を区別し、容量不足・中断・permission失効のfault injectionと全体atomicity条件を設計する。方式選択や永続schemaはその証拠と承認後。Intel Mac Audio-to-MIDI、Mac/iPad権限・容量・Japanese/touch、移行/復旧はphysical verification pending。
