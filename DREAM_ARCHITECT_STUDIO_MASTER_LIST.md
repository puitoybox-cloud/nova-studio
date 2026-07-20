# Dream Architect Studio 制作アプリ一覧

ホームの制作アプリ定義は `nova-studio-sections.js` の `DREAM_APPS` に集約する。状態、説明、カテゴリ、連携表示、起動処理、準備中画面の予定機能を同じ定義から生成する。

| カテゴリ | アプリ | 状態 | Nova Studio連携 | 接続先 |
| --- | --- | --- | --- | --- |
| 映像・アニメ | AIアニメ制作 | 利用可能 | あり | Production Dashboard（内部または設定URL） |
| 映像・アニメ | Production Dashboard | 利用可能 | あり | Production Dashboard（内部または設定URL） |
| 映像・アニメ | Prompt Studio | 利用可能 | あり | Prompt Studio（内部または設定URL） |
| 映像・アニメ | 動画制作 | 準備中 | 準備中 | URL未設定 |
| 音楽・音声 | Music Studio | 優先制作 | あり | Music Studio（内部または設定URL） |
| 音楽・音声 | MIDI Composer | 優先制作 | あり | Music Studio（内部または設定URL） |
| 音楽・音声 | 歌詞・音符割付 | 利用可能 | あり | Music Studio（内部または設定URL） |
| 音楽・音声 | 音楽制作支援 | 優先制作 | あり | Music Studio（内部または設定URL） |
| 音楽・音声 | Voice Studio | 未実装 | 予定 | URL未設定 |
| イラスト・漫画 | 画像制作 | 準備中 | 準備中 | URL未設定 |
| イラスト・漫画 | 漫画制作 | 未実装 | 予定 | URL未設定 |
| イラスト・漫画 | LINEスタンプ制作 | 未実装 | 予定 | URL未設定 |
| 公開・Web | ホームページ制作 | 未実装 | 予定 | URL未設定 |
| AI・プロンプト | プロンプト管理 | 準備中 | 準備中 | URL未設定 |
| AI・プロンプト | 今後追加予定 | 確認待ち | 接続仕様確認待ち | URL未設定 |

## 起動の安全基準

- 既存アプリは `openProductionDashboard()` または `openApp()` を再利用する。
- 外部URLがない場合は内部画面へ移動し、推測URLを開かない。
- 未実装・準備中・確認待ちは共通準備中画面へ移動する。
- 準備中画面は保存を行わず、戻る、Dream Architect Studioホーム、Nova Studioへの明示導線を持つ。

最終更新日：2026-07-20
