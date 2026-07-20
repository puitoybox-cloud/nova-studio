# Dream Architect Studio 連携仕様（LINK-02〜LINK-06）

## 範囲と安全原則

Nova Studio内で連携データを作成・確認し、Dream Architect Studioの将来接続に備える。現段階では外部API、クラウド、実ファイルへ送信しない。既存の `novaStudio_v01`、Story Archive、バックアップJSONは変更せず、受け取った制作結果も既存素材へ自動登録・正式採用しない。

## localStorageキー

| キー | 用途 |
| --- | --- |
| `novaStudio_dreamArchitectLink_v2` | 最新の共有データ（LINK-04/05） |
| `novaStudio_dreamArchitectLink_v1` | LINK-02/03の旧形式読込専用。上書きしない |
| `novaStudio_dreamArchitectResults_v1` | 制作結果の受け取り候補（LINK-06） |
| `novaStudio_dreamArchitectHistory_v1` | 最大100件の簡易連携履歴 |

## 共有JSON

```json
{
  "schemaVersion": "2.0",
  "transferId": "transfer_...",
  "createdAt": "ISO日時",
  "updatedAt": "ISO日時",
  "sourceApp": "nova-studio",
  "destinationApp": "dream-architect-studio",
  "project": { "id": "必須", "name": "任意" },
  "episode": { "id": "任意", "name": "任意" },
  "characters": [],
  "assets": [],
  "options": { "automaticSync": false, "filesUploaded": false, "confirmationRequired": true }
}
```

キャラクターの必須項目は `characterId`、`characterName`、`projectId`。任意項目は作品名、役割、基本説明、性格、話し方、外見、正式画像、Vidu参照画像、更新日時。複数選択を配列で扱う。

素材は識別のため `assetId` と `projectId` を必要とし、名前、種類、用途、正式採用、Vidu参照、角度、セット名、保存参照、更新日時、利用可否を保持する。`blob:`、`filesystem:`、`data:` は永続共有参照にせず `metadata-only`／`requiresReselection: true` とする。

## 互換性とエラー

旧 `novaStudio_dreamArchitectLink_v1` の `{projectName, projectId, episodeId}` は読込時に2.0へ正規化する。配列・オブジェクトでない値は空として扱う。共有全体の必須値がない場合は送信を中止する。個別の不正キャラクター・素材・制作結果はその項目だけを除外し、ほかの項目を処理する。JSON.parse失敗時は既存データを変更せず画面へ案内する。

## 送信前確認

作品、作品ID、話数、選択キャラクター、選択素材、共有されない情報、作成日時を表示する。「Dream Architect Studioを開く」「選択内容を変更する」「共有データを作り直す」「キャンセル」を用意する。作品未選択時は保存せず選択を案内する。キャラクターと素材は0件でもよい。

## 制作結果と重複

結果形式は `resultId`、`transferId`、`projectId`、`sourceApp`、`resultType`、`title`、説明、作成・更新日時、状態、素材メタデータ、メモを扱う。`resultType` は image / video / audio / midi / document / prompt / other。同じ `resultId`・同内容は重複登録せず、内容が異なる場合は `updateCandidate` として保持し、明示確認後だけ上書きする。「登録」は専用候補領域の状態変更であり、正式採用ではない。保留・却下も削除せず状態として保持する。

Dream Architect Studio未接続時は連携キーを表示し、安全な案内画面に留まる。模擬データ生成APIはURLに `?dreamArchitectDebug=1` がある開発確認時だけ利用でき、通常画面へ自動表示しない。

## LINK-07以降

外部アプリとの明示的な通信方式、認証、実ファイル転送、双方向同期、更新競合UI、LINK-09の完全な履歴画面は今回の対象外。接続先・URL・権限が正式決定した後に別作業で実装する。
