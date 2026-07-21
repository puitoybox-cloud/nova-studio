# MS-03N Music Studio設定・バックアップ基盤 夜間追加実装

状態：🔵 ティア確認待ち

実施日：2026-07-20〜2026-07-21

## 追加実装

- 自動保存の編集世代管理、フォームスナップショット、画面移動時タイマー解除、削除済み対象・保存失敗保護
- 個別破損をスキップできる部分復元と、追加・スキップ・失敗の件数報告
- Music Studio起動時だけ実行する期限型自動バックアップ、内容重複防止、容量上限、保持整理、一覧・明示復元
- `{projectName}`、`{songTitle}`、`{type}`、`{date}`、`{time}`、`{version}` のファイル名生成と画面プレビュー
- 将来作業用 `getSettings()`、`getMidiSettings()`、`getLogicProSettings()` API
- アプリ情報の開発段階、端末内保存、外部送信なし表示
- Nova Studioホーム画像の不要な404を抑える最小パス修正

## 安全性

IndexedDB `music-studio-projects` はVersion 3へ非破壊更新し、既存 `projects` / `settings` storeを維持して `autoBackups` storeだけを追加する。自動整理対象はこのstoreの古い自動記録だけで、手動JSON、設定、プロジェクト、Nova Studio、Dream Architect Studio、`aiMusicHelperProject`を削除・変更しない。

復元はreplaceや全初期化を持たず、projectId重複時は新IDで追加する。設定初期化は自動バックアップを削除しない。自動バックアップは初期無効で、Music Studioを開いている時の期限確認以外では動作しない。

## 既知の制限

- ブラウザを閉じている間は自動バックアップを作成しない。
- 自動バックアップ1件が4MBを超える場合は作成せず、手動JSON書き出しを案内する。
- MIDI生成、Logic Pro X起動・直接操作、外部同期は実装しない。
- Nova StudioのCSS背景には現行ディレクトリに存在しない `assets/images/home/` 参照が残るが、Music Studio画面では利用せず、他画面のデザイン変更を避けるためMS-03Nでは変更しない。
- 画面内の戻る操作、設定破棄、再読み込み・タブ離脱は未保存確認対象である。履歴APIの `popstate` / `hashchange` にも保護処理を追加したが、Codex内ブラウザの直接 `back()` 操作ではJavaScript確認ダイアログが観測できなかったため、Safari等の実機ブラウザ戻るはティア確認項目として残す。
- JSON書き出しボタンの成功通知と生成純粋関数は確認済み。Codex内ブラウザではプログラム生成downloadのイベント取得ができなかったため、ダウンロードフォルダに作成される実ファイル名は実機確認項目として残す。設定JSONの実ファイル読込、壊れたJSON・別形式拒否はブラウザで確認済み。

詳細仕様は `MS-03_SETTINGS_BACKUP.md` を正本とする。
