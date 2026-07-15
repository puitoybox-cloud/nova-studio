# Nova Studio

Nova Studio は、作品・話数・Scene・制作アプリをひとつのホームから安全に開くための、創作制作環境の入口です。Version 0.2.4 では、Import Centerで読み込んだ資料をプレビューし、「Nova整理」で登録候補として分類してから、チェックした項目だけNova Studioへ登録できるようにしました。

## Version 0.2.4で追加したこと

- Import CenterでPDF、TXT、Markdown、JSON、長文貼り付けの内容をプレビューします。
- 「Nova整理」ボタンで、読み込んだ内容を候補カテゴリへ分類します。
- 分類結果は自動登録せず、「登録候補」として表示します。
- 登録候補はタイトル、カテゴリ、本文を確認・編集できます。
- チェックした項目だけNova Studioへ登録します。
- 既存の `localStorage` 保存キーと保存済みデータは変更しません。

## 主な機能

- 作品、話数、Scene、キャラクター、世界観、用語、年表、アイデアを管理できます。
- ホームから「続きから」「作品ダッシュボード」「資料取り込み（Import Center）」「Universe」へ移動できます。
- 全体検索から、作品・話数・Scene・設定・制作メモを直接開けます。
- 統一カードUIで、作品・話数・キャラクター・世界観・用語・アイデアを一覧できます。
- Scene詳細から、イラスト、Viduプロンプト、生成動画、動画編集、音声、YouTube用メモを管理できます。
- ノヴァ相談用テキストを作成し、状況整理や次の作業確認に使えます。
- JSONの完全バックアップ、共通JSON書き出し、JSON読み込み（add / merge / replace）に対応します。
- Mac、iPad、iPhoneの画面幅を想定したレスポンシブUIで利用できます。

## Import Center

Import Center は、資料をプレビューし、Nova Studioへ安全に取り込むための入口です。Version 0.2.4 では次の資料を対象に、内容確認、Nova整理、登録候補の選別登録ができます。

- PDF
- TXT
- Markdown
- JSON
- 長文貼り付け

Import Center画面では読み込み後にプレビューを表示し、「Nova整理」ボタンで「概要」「世界観」「キャラクター」「時系列」「用語」「場所」「アイテム」「組織・種族」「エピソード」「台本」「アイデア」「伏線」「変更履歴」「作品設定」「ゴミ箱」の候補カテゴリへ分類します。分類結果は自動登録せず「登録候補」として表示し、チェックした項目だけ登録します。読み込み履歴と登録候補はNova Studioの既存localStorageキー内へ保存します。

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

- Version 0.2.4 のImport Center分類はブラウザ内の簡易ルール分類です。外部AI/API連携は未実装です。
- 既存制作アプリのリポジトリやデータは変更しません。
- JSON読み込み時に自動上書きしません。
- 重要な置き換え前にはバックアップを保存してください。
