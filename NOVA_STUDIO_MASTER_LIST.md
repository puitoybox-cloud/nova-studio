# Nova Studio 全機能マスターリスト

この文書は、最新mainに存在するNova Studioの機能、画面、保存領域、外部連携、未実装入口を一覧化した基準資料である。状態はコード上の利用可否を示し、ティアの受入状態は `NOVA_STUDIO_ROADMAP.md` で管理する。

状態：✅ 利用可能 / 🟡 一部対応・入口あり / ⬜ 未実装

## 1. ホームと共通操作

| 機能 | 状態 | 主な画面・処理 | 備考 |
| --- | --- | --- | --- |
| アトリエホーム | ✅ | `home` | 制作再開、主要制作アプリ、最近の作品、タスク、保存・バックアップ状況 |
| Nova Studio全機能一覧 | ✅ | ホーム内セクション | 4グループ、16機能カード、実装状態表示 |
| 作品・話数コンテキスト | ✅ | ヘッダー、`selectContext()` | `state.activeContext` に現在選択を保持 |
| 制作フローナビ | ✅ | 管理画面上部 | ホームからScene、Archive、Dashboard、Prompt、完成工程への導線 |
| 全体検索 | ✅ | `search` | 作品・話数・Scene・設定・制作メモを横断検索 |
| 最近開いた項目 | ✅ | ホーム、履歴 | 外部アプリ起動履歴を最大50件保持 |
| 今日やること | ✅ | `tasks` | タスクの追加、編集、状態管理 |
| ノヴァに相談 | ✅ | `consult` | 選択コンテキストを相談用テキスト／JSONへ整理 |

## 2. 物語・設定管理

| 機能 | 状態 | 主な画面 | 主な内容 |
| --- | --- | --- | --- |
| 作品 | ✅ | `projects` | 作品情報、状態、並び順、タグ、お気に入り |
| 話数 | ✅ | `episodes` | 話数情報、制作状態、進捗、作品との紐付け |
| Scene | ✅ | `scenes` | Scene詳細、台本、画像・動画・音声、制作メモ |
| Characters | ✅ | `characters` | 登場人物、プロフィール、重要設定 |
| World | ✅ | `worlds` | 世界観、ルール、背景設定 |
| Terminology | ✅ | `terms` | 用語と定義 |
| Timeline | ✅ | `timelines` | 出来事と時系列 |
| Ideas | ✅ | `ideas` | アイデアの登録・整理 |
| Locations専用画面 | 🟡 | `locations` | Story Archiveへ誘導する入口のみ |
| Items専用画面 | 🟡 | `items` | Story Archiveへ誘導する入口のみ |
| Scripts専用画面 | 🟡 | `scripts` | Sceneへ誘導する入口のみ |
| Images専用一覧 | 🟡 | `images` | 素材カードへ誘導する入口のみ |
| Universe | ✅ | `universe` | 作品・話数・設定カードの関連表示 |
| 矛盾検出 | 🟡 | `ns-conflicts` | データを変更せず確認候補を表示する入口 |

## 3. Story Archive

| 機能 | 状態 | 内容 |
| --- | --- | --- |
| カード管理 | ✅ | 作成、一覧、詳細、編集、削除、検索、カテゴリ・状態管理 |
| 専用カテゴリフォーム | ✅ | キャラクター、世界観、場所、アイテム、用語、ストーリー |
| 関連カード | ✅ | 複数選択、双方向リンク、削除時の参照整理 |
| 変更履歴・確定状態 | ✅ | 編集差分、確定／未確定情報 |
| 時系列・フォルダ | ✅ | 時系列ラベル、並び順、親子フォルダ |
| 画像資料 | ✅ | 画像情報、低容量サムネイル、代表画像、正式採用、Vidu参照 |
| 画像セット | ✅ | セット、基準画像、並び順、正式採用 |
| 画像ギャラリー | ✅ | フィルター、拡大、前後移動、編集、削除 |
| 画像自動処理 | ⬜ | 画像生成、画像編集、OCR、AI自動分類、クラウドアップロード |

## 4. 取り込み・同期・AI連携

| 機能 | 状態 | 主な画面・ファイル | 内容 |
| --- | --- | --- | --- |
| Import Center | ✅ | `importCenter` | PDF、Word、TXT、Markdown、JSON、長文貼り付けの確認と履歴 |
| Nova整理 | ✅ | `importCenter` | 本文分割、カテゴリ候補作成、選択項目の追記登録 |
| ChatGPT連携 | ✅ | `chatgpt-bridge.js` | 相談用コピー、更新JSONのプレビュー、確認後反映、自動バックアップ |
| ChatGPT一括取込 | ✅ | Story Archive | JSONの追加・更新候補確認、既存カードを削除しない取込 |
| Memory Sync | ✅ | `memorySync` | 差分確認、選択反映、自動バックアップ |
| Gemini入口 | 🟡 | `gemini` | 連携用の入口・関連スクリプトあり。正式な利用範囲は未確定 |
| 外部AI自動同期 | ⬜ | ― | 現在はコピー＆貼り付け、JSON入出力を採用 |

## 5. 制作アプリとDream Architect Studio

| 制作アプリ | 状態 | 起動方法・遷移先 | 選択情報 |
| --- | --- | --- | --- |
| AIアニメ制作 | ✅ | Production Dashboard（内部画面または設定URL） | 作品ID・話数IDを引き継ぐ |
| Viduプロンプト作成 | ✅ | Prompt Studio（内部画面または設定URL） | 外部URL時はURLパラメータを付与 |
| MIDI作曲 | ✅ | Music Studio（内部画面または設定URL） | 外部URL時はURLパラメータを付与 |
| 音楽制作支援 | ✅ | Music Studio（内部画面または設定URL） | MIDI作曲と同じ既存入口を利用 |
| 歌詞・音符割付 | ✅ | Music Studio（内部画面または設定URL） | 歌詞変換・音符割付の既存機能を利用 |
| 画像制作 | 🟡 | `dream-image` 準備中画面 | 連携準備中、保存処理なし |
| 漫画制作 | ⬜ | `dream-comic` 準備中画面 | 保存処理なし |
| LINEスタンプ作成 | ⬜ | `dream-line-stickers` 準備中画面 | 保存処理なし |
| ホームページ作成 | ⬜ | `dream-website` 準備中画面 | 保存処理なし |
| 動画制作 | 🟡 | `dream-video` 準備中画面 | 連携準備中、保存処理なし |
| プロンプト管理 | 🟡 | `dream-prompt-management` 準備中画面 | 連携準備中、保存処理なし |
| 音声制作 | ⬜ | `dream-voice` 準備中画面 | Voice Studioは未実装 |
| 今後追加する制作アプリ | 🟡 | `dream-future-apps` 準備中画面 | 接続仕様確認待ち |
| Dream Architect Studioホーム | 🟡 | `dream-architect` | 上記13入口、4カテゴリ、共有情報とNova Studioへの戻り導線。ティア確認待ち |
| Dream Architect連携確認 | 🟡 | `dream-architect-link` | LINK-04/05の複数選択・送信前確認。外部送信なし、ティア確認待ち |
| Dream Architect結果候補 | 🟡 | `dream-architect-link` | LINK-06の検証・登録・保留・却下。既存素材へ自動登録しない |

## 6. 保存・バックアップ・設定

| 機能 | 状態 | 保存先・内容 |
| --- | --- | --- |
| Studio状態保存 | ✅ | `localStorage: novaStudio_v01` |
| 旧データ補完 | ✅ | 読込時に既定値をマージし既存データを維持 |
| JSON完全バックアップ | ✅ | Studio状態の書き出し |
| JSON読込 | ✅ | add / merge / replace、実行前確認 |
| 共通JSON入出力 | ✅ | 共通フィールドを使った交換形式 |
| 自動保存 | ✅ | 設定に従い遅延保存、即時保存にも対応 |
| 設定 | ✅ | 外部アプリURL、起動確認、新規タブ、自動保存など |
| ホーム背景 | ✅ | `novaStudioHomeBackground` |
| Story Archive背景 | ✅ | `novaStudioStoryArchiveBackground` |
| Dream Architect共有 | 🟡 | `novaStudio_dreamArchitectLink_v2`（旧v1を読込可能） |
| Dream Architect結果候補 | 🟡 | `novaStudio_dreamArchitectResults_v1` |
| Dream Architect簡易履歴 | 🟡 | `novaStudio_dreamArchitectHistory_v1`（最大100件） |
| ChatGPT取込前バックアップ | ✅ | `novaStudio_v01_chatgpt_backup_<id>` |
| Memory Syncバックアップ | ✅ | `novaStudio_v01_memory_sync_backup_<id>` |

## 7. 画面・ルート一覧

- ホーム／共通：`home`, `search`, `consult`, `settings`, `backup`, `history`, `progress`, `tasks`
- 制作管理：`projects`, `episodes`, `scenes`, `characters`, `worlds`, `terms`, `timelines`, `ideas`, `cards`, `universe`
- 制作支援：`storyArchive`, `projectDashboard`, `productionDashboard`, `promptStudio`, `musicStudio`, `importCenter`, `memorySync`
- Nova Studio拡張：`locations`, `items`, `images`, `scripts`, `gemini`, `ns-conflicts`
- Dream Architect Studio：`dream-architect`, `dream-architect-link`, `dream-image`, `dream-comic`, `dream-line-stickers`, `dream-video`, `dream-website`, `dream-prompt-management`, `dream-voice`, `dream-future-apps`

## 8. 互換性と変更禁止範囲

- `novaStudio_v01` のキー名と既存JSONフィールドを変更・削除しない。
- 保存済みの作品、話数、Scene、Story Archiveカード、画像資料、関連情報を自動削除しない。
- Story Archive、Memory Sync、Import Center、ChatGPT取込のバックアップ処理を混在させない。
- 外部アプリへ渡す作品・話数は保存済みIDを使用し、表示名からIDを推測しない。
- 新規の永続データが必要な場合は、既存データを補完できる追加フィールドとして設計し、ロードマップ上で承認してから実装する。

## 9. 今後の優先順

1. LINK-04〜LINK-06のMac・iPad実機受入と既存データ回帰を完了する。
2. LINK-07でDream Architect Studio実体のURL、通信、認証、ファイル転送範囲を正式決定する。
3. LINK-09の完全な履歴画面と未実装制作アプリは、個別要件・保存設計・受入基準を追加してから着手する。

最終更新日：2026-07-20
