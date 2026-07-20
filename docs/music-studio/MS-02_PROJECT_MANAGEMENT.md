# MS-02 Music Studioプロジェクト管理

状態：🔵 ティア確認待ち

実装日：2026-07-20

## 実装範囲

Music Studioホームから、新規作成、更新順一覧、最近使ったプロジェクト、検索、基本情報編集、未保存表示、複製、確認付き個別削除、1プロジェクト単位のJSON入出力へ移動できる。ホスト内ルートと単体入口 `music-studio.html` は同じ実装を使用し、Music StudioルートではNova Studio共通ナビを表示しない。

## 保存領域

| 種類 | 名前 | 用途 |
| --- | --- | --- |
| IndexedDB | `music-studio-projects` | Music Studio専用データベース |
| object store | `projects` | `projectId` をkeyPathとするプロジェクト正本 |
| localStorage | `musicStudio_lastProjectId_v1` | 最近開いたプロジェクトIDだけ |

`novaStudio_v01`、`novaStudio_dreamArchitectLink_v1/v2`、`novaStudio_dreamArchitectResults_v1`、`aiMusicHelperProject` は読み書き・削除しない。Nova Studioの既存JSON入出力とバックアップ処理も変更しない。

## Version 1実装

ルート識別は `format: "music-studio-project"`、`schemaVersion: "1.0"`、`appVersion: "1.0.0"`。`projectId`、`revision`、UTC ISO 8601の作成・更新日時、プロジェクト名、曲名、制作目的、制作状態、BPM、拍子、キー、制作メモを保存する。

MS-00Bの将来領域としてsections、コード進行、メロディ、楽器、MIDI・音声参照、歌詞、音節割付、音色、プラグイン、ミックス、マスタリング、制作履歴、連携、legacy拡張を空構造で保持する。`fileReferences`、`midiAssets`、`audioAssets` は参照メタデータ用で、JSON書き出し時にバイナリ本体を埋め込まず `requiresReselection: true` とする。

## JSON入出力

- 書き出しは1プロジェクト単位。ファイル名は正規化したプロジェクト名と `YYYY-MM-DD` を含む。
- 読み込みはJSON解析後にformat、schemaVersion、projectId、revision、プロジェクト名、BPM、拍子、日時を検証する。
- 壊れたJSON、別形式、Version 1以外、必須値不足は保存前に拒否し、画面に結果を表示する。
- 同じprojectIdが存在する場合は新しいUUID、作成日時、更新日時を発行し、「（読み込み）」を名前へ付けて追加する。
- 読み込みは常に追加で、既存プロジェクトの置換・一括削除を行わない。

## MS-03への接続

MS-03はMusic Studio専用設定、自動保存、設定JSON、全体バックアップを追加した。MS-02の `music-studio-project` Version 1と `projects` storeは維持し、設定した初期値は新規作成時だけに適用する。既存プロジェクトを設定値で上書きしない。
