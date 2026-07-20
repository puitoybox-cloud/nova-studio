# Music Studio 基礎設計（MS-00A〜MS-00C）

作業番号：MS-00A〜MS-00C

状態：🔵 ティア確認待ち

設計日：2026-07-20

## 1. この文書の決定範囲

この文書は、Music Studioの大きな画面実装を始める前に、単体アプリ化、保存データ、アプリ間連携、販売・ライセンス対応の境界を決める。既存画面、既存機能、既存保存データは変更しない。

## 2. 現状調査

### Dream Architect Studio / Nova Studio

- Dream Architect Studioは現時点では独立リポジトリではなく、`nova-studio` 内の制作アプリ入口として実装されている。
- 制作アプリ定義は `nova-studio-sections.js` の `DREAM_APPS` に集約され、Music Studio、MIDI Composer、歌詞・音符割付への入口がある。
- Nova Studio本体の保存キーは `novaStudio_v01`。Music Studioはこのキーを読み書きしない。
- Dream Architect Studio連携には `novaStudio_dreamArchitectLink_v2`、結果候補には `novaStudio_dreamArchitectResults_v1` がある。現行実装は同一オリジンのlocalStorageを使う準備段階で、外部アプリとの通信は未実装。
- 連携データは `schemaVersion`、送信元・送信先、作品、話数、素材、履歴を持ち、更新候補を自動上書きしない方針になっている。

### 既存音楽アプリ `ai-music-helper`

- `index.html`、`style.css`、`script.js` だけで動く独立した静的Webアプリで、ビルドやログインを必要としない。
- AI作曲プロンプト、曲情報、歌詞、VoiSona向け整形、MIDI解析・再生、歌詞割付、音符単位編集、Undo / Redo、JSON入出力を持つ。
- 保存キーは `aiMusicHelperProject`、保存オブジェクトは `appName: "AI Music Helper"`、`version: 4`、`fields`、`checklist`、`voisona`、`midi` を持つ。
- JSON読み込みには形式識別と事前バックアップがなく、読み込んだ内容を同じ保存キーへ保存する。そのため、Music Studioの新形式へ直接置換せず、旧形式インポーターを介して複製取り込みする必要がある。
- MIDIは解析結果をJSON化して保持する。元MIDIファイルそのものを永続保存する仕組みではない。
- リポジトリ内にLICENSE、NOTICE、依存関係マニフェストがない。コードや画像を販売版へ組み込む前に、権利者とライセンスを確認する必要がある。

## 3. MS-00A｜単体アプリ化を前提とした分離設計

### 3.1 採用する構造

Music Studioは新しい独立リポジトリを正本とする。Dream Architect Studio / Nova Studioには、入口、URL設定、連携アダプターだけを置く。既存 `ai-music-helper` は移動・削除せず、移行元として維持する。

```text
music-studio/
├─ app/                         # Music Studio固有UIと起動入口
│  ├─ home/
│  ├─ projects/
│  ├─ midi-composer/
│  ├─ lyrics-allocation/
│  ├─ logic-export/
│  └─ settings/
├─ core/                        # UIやホストに依存しないドメイン処理
│  ├─ projects/
│  ├─ midi/
│  ├─ lyrics/
│  ├─ instruments/
│  └─ history/
├─ adapters/                    # 外部境界。直接参照をここへ閉じ込める
│  ├─ storage-web/
│  ├─ file-system/
│  ├─ dream-architect/
│  ├─ nova-studio/
│  ├─ ai-music-helper-v4/
│  └─ logic-pro-files/
├─ contracts/                   # JSON Schema、連携契約、互換性fixture
├─ shared/                      # Music Studio内で再利用する汎用UI・utility
├─ public/                      # アイコン等。権利確認済み素材のみ
├─ tests/
├─ docs/
├─ licenses/
│  ├─ THIRD_PARTY_NOTICES.md
│  └─ asset-register.json
└─ product.config.json          # 名称、版、エディション、ポリシーURL
```

### 3.2 境界ルール

| 領域 | 所有するもの | 所有しないもの |
| --- | --- | --- |
| Music Studio | 楽曲プロジェクト、MIDI、歌詞割付、音色・ミックスメモ、Music Studio設定 | Novaの作品正本、Dream Architectのアプリ一覧正本 |
| Dream Architect Studio | Music Studioへの入口、利用可否、接続URL、受渡し開始 | Music Studioの内部データ、MIDI編集ロジック |
| Nova Studio | 作品・話数・使用場面・進捗の正本、受取候補 | 楽曲の詳細編集、Music Studio保存領域 |
| `ai-music-helper` | 既存Version 4データと既存画面 | 新形式の正本、双方向同期 |

必須ルール：

- `core/` はブラウザDOM、Nova Studio、Dream Architect Studioをimportしない。
- 外部アプリのデータは `adapters/` と `contracts/` を通す。
- アプリ間の受渡しは、送信元でJSONを作成し、受信側で検証・プレビュー・明示承認してから複製登録する。
- URLクエリにはIDと一時的なhandoff IDだけを渡し、歌詞、個人情報、ファイル本体を載せない。
- Web版ではHTTPS URL、Mac / iPad / iPhone版では同じ契約を使うファイル共有またはOS共有機能へ差し替える。
- Music Studioは `index.html` またはアプリ固有入口から単体起動でき、ホスト不在時も全機能を停止しない。

### 3.3 段階的な分離

1. MS-01ではMusic Studio単体のホームと仮ページを新リポジトリへ作る。
2. `ai-music-helper` をiframeやソースコピーで埋め込まず、まず外部起動または同等機能へのアダプター境界を用意する。
3. MS-11で既存Version 4データを読み込み、新規Music Studioプロジェクトのコピーへ変換する。
4. 変換確認後も `aiMusicHelperProject` は削除・更新しない。
5. Dream Architect Studio側の入口はMusic Studio URLを設定して開く。未設定時は既存の準備中画面を保つ。

## 4. MS-00B｜保存データとアプリ間連携の設計

### 4.1 保存責務

- Web版のメタデータ正本：IndexedDB。localStorageは起動設定、最後に開いたプロジェクトID、旧形式検出だけに限定する。
- MIDI、音声、画像等の大きなバイナリ：File System Access APIが使える場合はユーザー選択ファイルへの参照、使えない場合はファイルの再選択情報とメタデータを保存する。
- JSON書き出し：可搬バックアップ。バイナリを標準では埋め込まず、manifestにファイル名、MIME、サイズ、checksum、所在、再選択要否を記録する。
- Mac / iPad / iPhone版：保存アダプターを差し替え、同じプロジェクト契約をファイルパッケージまたはアプリ領域へ保存する。
- 自動保存は変更単位で行い、手動バックアップ、移行前バックアップ、復元ポイントを別に保持する。

### 4.2 識別子と版管理

- アプリ版 `appVersion`、契約版 `schemaVersion`、各エンティティ版 `revision` を分離する。
- IDはアプリ外でも衝突しにくいUUIDを使う。
- 日時はUTCのISO 8601文字列で保存する。
- 読み込みは `検出 → 検証 → 移行計画表示 → バックアップ → コピー変換 → 再検証 → 確定` の順とする。
- 未知の将来schemaは上書きせず読み取り専用で開くか、対応外として元データを保持する。
- 移行関数は `v1 -> v2` のように1版ずつ適用し、再実行しても結果が増殖しない設計にする。

### 4.3 プロジェクト契約

正規形式は `music-studio-project` とし、詳細は [MS-00B_PROJECT_DATA_CONTRACT.md](./MS-00B_PROJECT_DATA_CONTRACT.md) に定義する。最低限、曲名、プロジェクト名、BPM、拍子、キー、コード進行、メロディ、楽器、MIDI、音声、歌詞、音節・音符割付、音色、プラグイン、ミックス・マスタリングメモ、履歴、作成・更新日時を保持する。

### 4.4 連携契約

連携は保存データ全体ではなく、用途別の封筒形式を使う。

```json
{
  "format": "music-studio-handoff",
  "schemaVersion": "1.0",
  "handoffId": "uuid",
  "sourceApp": "nova-studio",
  "destinationApp": "music-studio",
  "createdAt": "2026-07-20T12:00:00.000Z",
  "payloadType": "project-context",
  "payload": {},
  "attachments": [],
  "requiresConfirmation": true
}
```

Dream Architect Studioから受け取る情報：起動元、作品ID・作品名、話数ID、依頼種別、戻り先。

Nova Studioから受け取る情報：作品・話数・使用場面、制作状態、必要な楽曲概要、選択した素材のメタデータ。

Nova Studioへ返す情報：曲名、Music StudioプロジェクトID、使用作品・場面、制作状態、歌詞概要、BPM・拍子・キー、使用楽器・音色、完成ファイル参照、更新履歴、制作メモ。

受信側はformat、schemaVersion、sourceApp、destinationApp、handoffId、必須項目を検証し、同じhandoffIdを重複登録しない。受け取った内容は候補として表示し、自動上書き・自動正式採用しない。

### 4.5 旧データ互換

- `aiMusicHelperProject` Version 4を専用インポーターで検出する。
- 旧 `fields` を基本設定・歌詞・制作メモへ、`voisona` を歌詞整形データへ、`midi` を読み込み済みMIDI解析と歌詞割付へ写す。
- 変換先は新規プロジェクトまたは既存プロジェクトの複製に限定する。
- 元localStorage、元JSON、元MIDIを変更・削除しない。
- 不明フィールドは `legacy.extensions` に保持し、黙って破棄しない。

## 5. MS-00C｜販売・ライセンス対応の基礎設計

### 5.1 製品設定

アプリ名、bundle ID、表示版、ビルド番号、アイコン、配布チャネル、エディション、規約URL、プライバシーURLを `product.config.json` とビルド時設定から変更できるようにする。UIや保存形式へ商品名を直接埋め込まない。

無料版・有料版は機能コードを分岐コピーせず、安定したfeature IDとentitlement providerで表示・実行可否を判断する。課金処理はこの段階では実装しない。保存データには購入状態を正本として保存せず、上位版で作ったデータを無料版が破壊しないよう読み取りと書き出しを保証する。

### 5.2 ライセンス台帳

コード、ライブラリ、フォント、画像、音声、MIDI、サンプルプロジェクトごとに次を記録する。

- 名称、種類、出所、作者・権利者、版、URL
- ライセンス名、ライセンス本文または保存先、商用利用可否
- 改変・再配布・表示義務、取得日、確認者、証跡
- 同梱対象エディション、ファイルchecksum、備考

判定が `unknown`、`non-commercial`、`no-redistribution` の素材は販売ビルドへ含めない。アプリ本体のライセンス、プライバシーポリシー、利用規約、第三者通知は後から追加できる固定導線を設定画面に用意する。

### 5.3 現時点のライセンスリスク

- `ai-music-helper` と `nova-studio` にLICENSE / NOTICEが見当たらないため、別リポジトリ間でコードや画像を複製する権利条件が未確定。
- Nova Studioには複数のキャラクター画像・背景画像がある。Music Studioへはコピーせず、必要なら権利台帳へ登録して個別承認する。
- Web標準APIの利用には追加ライブラリの同梱は不要だが、今後MIDI・音声解析ライブラリを導入する際はライセンス、商用利用、NOTICE義務を導入前に確認する。

## 6. 採用しない案

- Nova Studioの `novaStudio_v01` 内へMusic Studio全データを追加する案：単体分離できず、保存障害の影響範囲が広がるため不採用。
- `ai-music-helper` の3ファイルをNova Studioへコピーする案：履歴とライセンスが曖昧になり、独立配布が難しくなるため不採用。
- localStorageキーをアプリ間で直接読み書きする方式を正式連携とする案：オリジン依存でMac / iOSアプリへ移行できず、所有境界も崩れるため不採用。
- 最初から全バイナリをJSONへbase64埋め込みする案：容量、速度、バックアップ破損リスクが高いため不採用。

## 7. 完了判定と次作業

設計文書の作成と現状調査は完了。次の3点をティアが確認した時点でMS-00A〜MS-00Cを✅完成へ変更する。

1. Music Studioの正本を独立リポジトリとして作る。
2. `ai-music-helper` は削除・直接埋め込みせず、Version 4互換インポーターで接続する。
3. 大容量ファイルはJSONへ標準埋め込みせず、manifestとユーザー管理ファイルを組み合わせる。

確認後の次作業はMS-01「Music Studioホーム」。画面実装と同時にプロジェクト契約の最小validator、保存アダプターのinterface、未実装機能の仮ページを用意する。
