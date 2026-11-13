# Macなし開発・初版台帳とAuto-Finish再開保護

確認日：2026-10-31 JST。公式基準 PR #549 / `0b874b0b8270dbec1c47085503d011309ef56e49`、tree `249aa944c193192a44285d4798dda749afc8c1c6`。
ローカル基準 `ae4c7f5b364c5f55b7c4b6912929dafba7d9dd68` は公式基準とtreeが一致するがコミット履歴は異なる。既存checkoutは変更せず独立clone/branchで開発。公開commitの親は公式基準を指定する。main/PR #510/#537–549への更新、Ready/Merge/force pushなし。

## Production修正

1. 開始と再開前に全Stemのidentity/role/size/path/SHA-256を再確認。同じ長さの破損、欠落、切詰め、保存参照の不整合を拒否しCLIを起動しない。比較中は既存Runtime lockを保持する。音楽内容の解析やWAV形式検査は既存CLIへ委譲。外部processによる検査直後のファイル書換えを封じるOS sandboxを新設したという主張ではない。
2. session metadataと転送Stemをflush/fsync後に置換し、directoryをfsync。転送途中の失敗ではpartialを除去し、以前の有効ファイルとmanifestを保持する。metadata置換失敗で以前のsessionを保持。物理電源断の保証ではなく失敗注入のソフトウェア証拠。
3. 破損sessionのJSONが配列/null/不正requestでも、別の正常sessionの再発見を継続。破損sessionを削除しない。
4. 空/不正Project・audioVersionをファイル作成前に拒否する。
5. 古いprocessのwaiterが新しいprocessの状態を上書きしない。process起動後のsession保存失敗では子processを停止・回収しlogを閉じる。起動失敗では保存済みsessionを保って再試行可能にする。

元曲、録音、WAV、MIDI、履歴、バックアップのproduction schemaと既存資産を変更しない。有料API/モデルダウンロードなし。

## 下位受入台帳

正本：`docs/music-studio/MACLESS_REQUIREMENTS_V1.json`、読みやすい表：同名md。全30機能にA/Bの受入を割り当て、モデル/方式決定をCへ分離。C依存の実装作業自体はAから除外しない。

A総数135、verified37、open98、台帳受入確認率27.41%。B30、C18。
既存30件の狭い受入と今回7件を証拠付きでverifiedとした。既存testとproductionに部分実装があっても、残る広い要件を完了へ自動昇格しない。openには未実装と証拠照合待ちの両方を含む。この初版は製品全体の実装率ではなく、今後追加要件を発見した場合は分母の変更理由を記録する。全大機能の最終認定は依然0/30。

## 自動検証

- 全Node suite：2,754件成功、失敗/取消/skip 0、212.818秒。実行commandと証拠となった受入名・test/runtime hashを `music-macless-node-summary.json` に保存。
- Auto-Finish Runtime：22件成功、失敗0。既存11＋追加11。HTTP認証再接続、hash不一致時のzero-spawn、保存/転送故障、世代競合、子process回収を含む。`music-macless-helper-summary.json`。
- 基準runtimeへ今回の5つの受入methodを当てるとすべて失敗。subTestを含み計13 failure/error assertionsであり「13機能」と数えない。修正runtimeでは全22成功。
- native C++20 engineをビルドし、既存 `tools/nova-au/tests/auto-finish.py` の実CLI回帰成功（success=true / developmentFixture=true）。A/B/Cレンダー等は合成fixtureの証拠で、一般作品の品質保証ではない。
- 台帳CLIはID/重複/依存参照、完了根拠の受入名・実行結果・source/runtime hash、集計とMarkdownの一致を検査。新CIで全Nodeとhelperと台帳を同じHEADで再実行する。
- GitHub CIの開始/最終snapshotは新Draft PR本文に記録。実行中を成功に数えない。

## 残作業と次回

最優先：MS01-A02〜A05のcore Bass/Key/Chordを含む全曲移調整合。既存testではcore Bassを除外しているため、要求との差を閉じる。次にAI新曲・会話実行・Section再生成・歌詞/仮歌のopen受入。モデル選定に依存しない保存/取消/再開の部分を先行し、モデルや方式が未決定の部分はCと依存関係を保持する。未確認項目をBへ逃がしてAを100%にしない。

B：鍵盤/マイクの権限と遅延、完全終了/再起動、実曲聴感、Intel配布版のGUI→helper→CLI→採用→完成WAV→再編集→Archive、Logic往復、別Mac復元、対象端末の操作/表示。全30行の個別受入は台帳参照。
C：文章理解・歌詞・歌唱/本人声・解析/変換/分離モデルの選定と許諾、Cloud Sync方式、有料Providerと料金契約、直接Logic連携、配布条件/互換方針。全18行は台帳参照。
Mac実機操作は要求しない。A残98件を次Workへ継続し、A100%/残0の達成は今回宣言しない。
