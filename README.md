# Nova Studio

Nova Studio は、作品・話数・Scene・制作アプリをひとつのホームから安全に開くための、創作制作環境の入口です。Version 0.2.1 では、外部素材を取り込むための入口として Import Center のホーム導線と画面を追加しました。

## Version 0.2.1で追加したこと

- ホーム画面に「📥 Import Center」カードを追加しました。
- Import Center画面を新規作成しました。
- 取り込み方法として PDF、Word、TXT、Markdown、JSON、長文貼り付けをカード表示しました。
- 「取り込み履歴」セクションを追加しました（現在は空表示）。
- 「ノヴァ整理」セクションを追加しました（現在は空表示）。
- 「読み込み開始」ボタンを追加しました（現在はダミー動作）。
- 「ホームへ戻る」ボタンを追加しました。

今回は実際のファイル解析やAI分類は実装していません。既存機能、既存データ、`localStorage` の保存キーや保存内容は変更しません。

## 主な機能

- 作品、話数、Scene、キャラクター、世界観、用語、年表、アイデアを管理できます。
- ホームから制作アプリ、Import Center、最近開いた項目、お気に入りへ移動できます。
- 全体検索から、作品・話数・Scene・設定・制作メモを直接開けます。
- 統一カードUIで、作品・話数・キャラクター・世界観・用語・アイデアを一覧できます。
- Scene詳細から、イラスト、Viduプロンプト、生成動画、動画編集、音声、YouTube用メモを管理できます。
- ノヴァ相談用テキストを作成し、状況整理や次の作業確認に使えます。
- JSONの完全バックアップ、共通JSON書き出し、JSON読み込み（add / merge / replace）に対応します。
- Mac、iPad、iPhoneの画面幅を想定したレスポンシブUIで利用できます。

## Import Center

Import Center は、将来の素材取り込み・整理機能の入口です。Version 0.2.1 では次の取り込み方法を表示します。

- PDF
- Word
- TXT
- Markdown
- JSON
- 長文貼り付け

「読み込み開始」や各取り込み方法の選択はダミー表示で、ファイル解析、AI分類、データ保存は行いません。

## 現在接続する制作アプリ

- ノヴァ物語制作室（Story Archive）
- AIアニメ制作ダッシュボード（Production Dashboard）
- Viduプロンプト構成ツール（Prompt Studio）
- 歌詞・MIDI制作補助（Music Studio）

Asset Library、Voice Studio、Planner は今後追加予定です。

## ファイル構成

- `index.html`：画面の入口。
- `style.css`：レスポンシブデザイン、配色、カード、ボタン、スクロール調整。
- `data.js`：初期アプリ、初期作品、初期エピソード、バージョン情報。
- `storage.js`：`localStorage` の読み書き、自動保存、旧データ補完。
- `navigation.js`：アプリURL作成、履歴、現在の作品・話数選択。
- `import-export.js`：JSON書き出し・読み込み、相談用文章。
- `app.js`：画面描画、フォーム操作、検索、お気に入り、Scene制作UI、Import Center画面。
- `README.md`：この説明書。
- `CHANGELOG.md`：変更履歴。

## 起動方法

ブラウザで `index.html` を開くだけで起動できます。npm、ビルド、外部API、ログインは不要です。ローカル確認は次の簡易サーバーでも可能です。

```bash
python3 -m http.server 8000
```

## localStorageについて

保存キーは `novaStudio_v01` です。既存制作アプリの保存キーは使用せず、既存アプリのデータを読み書きしません。保存済みデータがある場合、初期データで上書きしません。

## 注意事項

- Version 0.2.1 の Import Center は画面とダミー導線のみです。
- 既存制作アプリのリポジトリやデータは変更しません。
- JSON読み込み時に自動上書きしません。
- 重要な置き換え前にはバックアップを保存してください。
