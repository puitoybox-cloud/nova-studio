# Music Studio プロジェクトデータ契約 Version 1

作業番号：MS-00B

状態：🔵 ティア確認待ち

契約ID：`music-studio-project`

schemaVersion：`1.0`

## 1. ルート構造

```json
{
  "format": "music-studio-project",
  "schemaVersion": "1.0",
  "appVersion": "1.0.0",
  "projectId": "018f...",
  "revision": 1,
  "projectName": "新しい音楽プロジェクト",
  "songTitle": "",
  "status": "draft",
  "musicalSettings": {
    "bpm": 120,
    "timeSignature": { "numerator": 4, "denominator": 4 },
    "key": { "tonic": "C", "mode": "major" },
    "bars": null
  },
  "sections": [],
  "chordProgressions": [],
  "melodies": [],
  "instruments": [],
  "midiAssets": [],
  "audioAssets": [],
  "lyrics": { "versions": [], "activeVersionId": null },
  "syllableAssignments": [],
  "soundSelections": [],
  "plugins": [],
  "mixNotes": [],
  "masteringNotes": [],
  "productionHistory": [],
  "integrations": { "dreamArchitect": [], "novaStudio": [], "logicPro": [] },
  "legacy": { "sourceFormat": null, "sourceVersion": null, "extensions": {} },
  "createdAt": "2026-07-20T12:00:00.000Z",
  "updatedAt": "2026-07-20T12:00:00.000Z"
}
```

## 2. 必須項目

| 項目 | 型 | 条件 |
| --- | --- | --- |
| `format` | string | 常に `music-studio-project` |
| `schemaVersion` | string | 契約版。SemVerのmajor.minor |
| `appVersion` | string | 書き出したアプリ版 |
| `projectId` | UUID string | 永続かつアプリ間で一意 |
| `revision` | integer | 保存確定ごとに増加、1以上 |
| `projectName` | string | 空文字不可 |
| `musicalSettings` | object | BPM、拍子、キーを保持 |
| `createdAt`, `updatedAt` | ISO 8601 string | UTCで保存 |

`songTitle` は制作初期には空でもよい。BPMは20〜400、拍子の分母は1、2、4、8、16、32のいずれかを基本とし、範囲外データは自動修正せず検証警告を出す。

## 3. MIDIと音声

`midiAssets` と `audioAssets` は共通して次を持つ。

```json
{
  "assetId": "uuid",
  "role": "source",
  "fileName": "vocal.mid",
  "mediaType": "audio/midi",
  "byteLength": 12345,
  "checksum": { "algorithm": "sha-256", "value": "..." },
  "storage": {
    "kind": "external-file",
    "reference": "Music/Project/vocal.mid",
    "requiresReselection": false
  },
  "derivedFromAssetId": null,
  "createdAt": "2026-07-20T12:00:00.000Z",
  "updatedAt": "2026-07-20T12:00:00.000Z"
}
```

`storage.reference` はユーザー環境外で有効とは限らない。`blob:`、一時URL、権限トークンを永続JSONへ保存しない。書き出し時にファイルを同梱しない場合は `requiresReselection: true` とする。

## 4. 歌詞と音節割付

歌詞は上書きせずversionとして追加する。各versionはセクション、本文、読み、言語、作成元、作成・更新日時を持つ。音節割付は `lyricsVersionId`、`midiAssetId`、`trackId` を参照し、各割付にnote ID、開始tick、長さ、文字列、読み、種類、ブレス、手動修正フラグを保存する。

Undo / Redo履歴はセッション内操作履歴であり、標準バックアップへ無制限に保存しない。意味のある確定変更は `productionHistory` へ追記する。

## 5. プラグイン・音色

プラグインは名称だけで同一判定せず、可能ならmanufacturer、plugin ID、format、versionを持つ。プリセットや商用ライセンス文書そのものは埋め込まず、名称、ユーザーの所有・インストール状態、利用条件メモ、参照先だけを保存する。

## 6. 読み込み安全基準

- JSONを解析してからformatとschemaVersionを確認する。
- 読み込み中は現在のプロジェクトを変更しない。
- 同じprojectIdは「複製」「現在を維持」「更新候補として比較」から明示選択する。
- replaceの前には既存データのバックアップを書き出す。
- checksum不一致、必須項目不足、未知major版は確定保存しない。
- 不明な追加フィールドは可能な限り保持し、書き戻しで消失させない。

## 7. `ai-music-helper` Version 4対応表

| 旧項目 | 新しい保存先 |
| --- | --- |
| `fields.title` | `songTitle` |
| `fields.bpm`, `fields.timeSignature`, `fields.key` | `musicalSettings` |
| Aメロ・Bメロ・サビ等の`fields` | `lyrics.versions[].sections` |
| `checklist` | `productionHistory` または移行メモ |
| `voisona` | 歌詞versionの読み・整形設定 |
| `midi.parsed` | `midiAssets` に紐づく解析スナップショット |
| MIDI歌詞編集表 | `syllableAssignments` |
| 未知の旧項目 | `legacy.extensions` |

変換後には `legacy.sourceFormat: "ai-music-helper"`、`legacy.sourceVersion: 4` を記録する。元データは変更しない。
