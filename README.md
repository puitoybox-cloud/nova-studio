# Nova Studio

Nova Studio は、作品・話数・Scene・制作アプリをひとつのホームから安全に開くための、創作制作環境の入口です。Version 0.2.3 では、AIアニメ制作ダッシュボード側から渡されるURLパラメータを受け取り、作品・話数を自動選択してNova Studioへ戻る導線を表示できるようにしました。

## Version 0.2.3で追加したこと

- URLパラメータ `project`、`episode`、`source`、`returnUrl` を受け取ります。
- 起動時に `project` と `episode` に一致する作品・話数を自動選択します。
- 画面上部に「Nova Studioへ戻る」ボタンを表示します。
- `returnUrl` がある場合はそのURLへ戻り、無い場合はトップへ戻ります。
- 既存の `localStorage` 保存キーと保存済みデータは変更しません。

今回はNova Studioとの基本連携のみです。制作データの双方向同期や外部API連携は未実装です。

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

Import Center は、将来の素材取り込み・整理機能の入口です。Version 0.2.2 では次の資料を選択し、情報と一部プレビューを確認できます。

- PDF
- Word
- TXT
- Markdown
- JSON
- 長文貼り付け

Import Center画面にはPDF、Word、TXT、Markdown、JSON、長文貼り付けのカードを表示します。TXT、Markdown、JSONは内容を表示します。PDFはページ数、ファイル名、サイズのみ、Wordはファイル名のみ表示します。読み込み履歴はNova Studioの既存localStorageキー内へ保存します。「ホームへ戻る」ボタンからホーム画面へ戻れます。

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

- Version 0.2.3 のNova Studio連携はURLパラメータ連携と戻る導線までです。制作データの双方向同期は未実装です。
- 既存制作アプリのリポジトリやデータは変更しません。
- JSON読み込み時に自動上書きしません。
- 重要な置き換え前にはバックアップを保存してください。
