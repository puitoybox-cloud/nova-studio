# Nova Studio

Nova Studio は、既存の創作支援Webアプリを作り直さず、ひとつのホーム画面から安全に開くための「創作環境の入口」です。Version 0.1 は、各アプリの中身や localStorage へ直接アクセスせず、Nova Studio 専用データだけを `localStorage` に保存します。

## Version 0.1の目的

- 作品・話数を選び、登録したアプリURLへ `project` / `episode` パラメータを付けて開く。
- 最近開いた項目、お気に入り、バックアップ、ノヴァ相談用データを扱う。
- GitHub Pagesでそのまま公開できる静的Webアプリとして動作する。

## 現在接続するアプリ

- ノヴァ物語制作室（Story Archive）
- AIアニメ制作ダッシュボード（Production Dashboard）
- Viduプロンプト構成ツール（Prompt Studio）
- 歌詞・MIDI制作補助（Music Studio）
- Asset Library / Voice Studio / Planner は今後追加予定です。

## ファイル構成

- `index.html`：画面の入口。
- `style.css`：レスポンシブデザインと配色。
- `data.js`：初期アプリ、初期作品、初期エピソード、バージョン情報。
- `storage.js`：`localStorage` の読み書きと自動保存。
- `navigation.js`：アプリURL作成、履歴、現在の作品・話数選択。
- `import-export.js`：JSON書き出し・読み込み、相談用文章。
- `app.js`：画面描画、フォーム操作、検索、お気に入り。
- `README.md`：この説明書。
- `CHANGELOG.md`：変更履歴。

## 起動方法

ブラウザで `index.html` を開くだけで起動できます。npm、ビルド、外部API、ログインは不要です。ローカル確認は次のような簡易サーバーでも可能です。

```bash
python3 -m http.server 8000
```

## GitHub Pagesでの公開方法

1. リポジトリ `nova-studio` を GitHub に置きます。
2. Settings → Pages を開きます。
3. Source を `Deploy from a branch` にします。
4. Branch：`main`、Folder：`/root` を選びます。
5. 公開URL例：`https://puitoybox-cloud.github.io/nova-studio/`

相対パスで `style.css` と各JavaScriptを読み込むため、GitHub Pages上でもパスが壊れにくい構成です。

## アプリURLの登録方法

「アプリ」または「設定」画面でカードの「設定」を押し、URLを入力して保存します。未登録のまま「開く」を押すと、登録を促す案内を表示します。

## 作品と話数の登録方法

「作品」画面から作品を追加・編集・複製・並べ替え・アーカイブできます。「話数」画面では、現在選択中の作品に紐づくエピソードを追加・編集・複製・並べ替え・アーカイブできます。削除操作は安全のため完全削除ではなくアーカイブ扱いです。

## 現在の作品と話数の選び方

ヘッダーの「作品」または「話数」ボタンを押すと選択画面が開きます。作品を切り替えると、その作品に登録された話数だけを選べます。

## 各アプリを開く方法

アプリカード、現在の制作カード、履歴、お気に入りから開けます。URL登録済みの利用可能アプリだけが開けます。

## URLパラメータについて

アプリを開く時、登録URLへ次を追加します。

- `project`：現在の作品ID。
- `episode`：現在の話数ID。
- `source=nova-studio`：Nova Studioから開いたことを示す移動情報。
- `returnUrl`：Nova Studioへ戻るためのURL。長すぎる場合は省略可能な設計です。

URL本文へ台本や設定本文は入れません。既存クエリがあるURLにも `URLSearchParams` で安全に追加します。

## localStorageについて

保存キーは `novaStudio_v01` です。既存制作アプリの保存キーは使用せず、既存アプリのデータを読み書きしません。保存済みデータがある場合、初期データで上書きしません。

## JSONバックアップ方法

「バックアップ」または「設定」画面から、共通JSONまたは完全バックアップJSONを書き出せます。完全バックアップにはNova Studio内のアプリ設定、URL、作品、エピソード、履歴、お気に入り、表示設定などを含みます。既存制作アプリのデータは含みません。

## JSON読み込み方法

JSONファイルを選ぶと、形式、schemaVersion、書き出し日時、件数、重複候補数、エラー数を表示します。読み込み方法は `add`（追加）、`merge`（統合）、`replace`（置き換え）から選びます。置き換え前には確認を表示し、自動バックアップのダウンロードを試みます。不正JSONでは現在データを変更しません。

## ノヴァ相談用データの使い方

「ノヴァに相談」画面で相談種類と本文を入力し、相談用文章を作成します。クリップボードへコピー、テキスト保存、JSON保存ができます。Version 0.1では外部APIへ送信しません。

## データ初期化方法

「設定」画面の初期化ボタンを押します。二段階確認を通過した場合のみ、Nova Studio専用データを削除します。各制作アプリのデータには影響しません。

## 対応端末

Mac、iPad横向き、iPad縦向き、iPhone、Safari、Chrome、Edgeを想定しています。iPhoneでは下部ナビゲーションを表示し、横スクロールが出にくい1列レイアウトにします。

## Version 0.2以降の予定

Story Archive、Production Dashboard、Prompt Studio、Asset Library、Music Studio、Voice Studio、Planner、Nova Core、全体検索、ノヴァ相談室をより深く接続する予定です。ただし、既存アプリのlocalStorage直接共有、自動データ取得、外部API連携、ログイン、クラウド同期などはVersion 0.1では実装していません。

## 注意事項

- 既存制作アプリのリポジトリやデータは変更しません。
- JSON読み込み時に自動上書きしません。
- 重要な置き換え前にはバックアップを保存してください。
- 専門用語：`localStorage` はブラウザ内に保存する小さなデータ領域、`JSON` はデータ交換用のテキスト形式です。
