# LINK-01 実装前調査

LINK-01時点の調査記録。LINK-02〜LINK-06の実装仕様は `DREAM_ARCHITECT_LINK_SPEC.md` に分離した。

## 現在の選択作品と保存場所

- 実行時の選択作品は `state.activeContext.projectId`、選択話数は `state.activeContext.episodeId`。
- `currentProject()` と `currentEpisode()` がこの値を参照する。
- `state.lastLocation` に直近の作品・話数・画面も保存される。

## localStorageキー

- Studio全体の状態：`novaStudio_v01`（`storage.js` の `STORAGE_KEY`）。
- 旧コードのフォールバックに `novaStudioState` が残るが、通常保存は既存の `saveState()` を使う。
- ホーム背景：`novaStudioHomeBackground`。
- Story Archive背景：`novaStudioStoryArchiveBackground`。
- ChatGPT取込前バックアップ：`novaStudio_v01_chatgpt_backup_<id>`。
- Dream Architect共有（現行）：`novaStudio_dreamArchitectLink_v2`。
- Dream Architect共有（旧LINK-03・読込専用）：`novaStudio_dreamArchitectLink_v1`。
- Dream Architect制作結果候補：`novaStudio_dreamArchitectResults_v1`。
- Dream Architect簡易履歴：`novaStudio_dreamArchitectHistory_v1`。

## 既存の相互起動処理

- 内部画面は `setView()` によるハッシュルーティング。
- 外部制作アプリは `openApp()` と `buildAppUrl()` を利用し、`project`、`episode`、`source=nova-studio`、`returnUrl` を付与する。
- AIアニメ制作は `openProductionDashboard()`、Story Archiveは `openStoryArchive()` を利用する。

## 安全な共有方法

第一候補は、同一ページ内のDream Architect Studioでは既存の `state.activeContext` をそのまま参照すること。別サイトへ渡す場合は既存の `buildAppUrl()` と同じURLパラメータを利用し、保存側のキーやJSONスキーマを変更しない。受け手が選択を返す必要がある場合は、明示的な確認後に既存IDのみを反映する設計が安全。

## 変更候補ファイル

- `navigation.js`：外部起動URLと戻り先の組み立て。
- `nova-studio-sections.js`：Dream Architect Studio側の選択作品表示と導線。
- `app.js`：既存の `setView()`、`openApp()`、`activeContext` 周辺（必要最小限に限定）。
- `storage.js`：原則変更しない。共有データを永続化する要件が確定した場合のみ互換的な追加を検討。

## 互換性上の注意

- `novaStudio_v01` のキー名と既存JSONフィールドは変更しない。
- URLへ渡す値は保存済みの作品ID・話数IDに限定し、タイトルからIDを推測しない。
- 外部アプリから未知のIDが戻った場合は現在選択を維持する。
- `returnUrl` にハッシュと既存クエリを保ち、戻る操作で履歴を二重追加しない。
- Story Archive、Memory Sync、バックアップの既存保存処理へ共有処理を混ぜない。

## LINK-04〜LINK-06で確定した方針

- `novaStudio_v01` と既存バックアップJSONは変更せず、連携専用キーへ隔離する。
- キャラクターと素材は配列として複数選択可能にし、欠損した任意値は空欄で扱う。
- Story Archiveカード内の画像と画像管理メタデータを読み取るが、元データへ書き戻さない。
- blob URL、filesystem URL、data URLは共有用の永続参照にしない。
- 制作結果は専用候補領域へ保存し、確認なしの上書き・正式採用・既存素材登録をしない。
- 外部アプリの実体とURLが未確定のため、送信はlocalStorage準備までとし、外部接続はLINK-07へ送る。
