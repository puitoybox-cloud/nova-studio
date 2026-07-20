# MS-01 Music Studioホーム実装記録

作業番号：MS-01

状態：🔵 ティア確認待ち

実装日：2026-07-20

## 調査結果

- Nova Studioは静的HTMLとJavaScriptで動き、ハッシュ値を `managementViewForRoute` で画面へ割り当てる。
- Nova Studioの保存正本は `novaStudio_v01`。Dream Architect連携は `novaStudio_dreamArchitectLink_v2` と `novaStudio_dreamArchitectResults_v1` を使う。
- Dream Architect StudioにはMusic Studio、MIDI Composer、歌詞・音符割付の既存入口があるが、Music Studio URL未登録時は汎用の設定画面に接続されていた。
- 既存 `ai-music-helper` は別リポジトリで、`aiMusicHelperProject` Version 4を保存する。ライセンス未確認のためコードをコピーせず、MS-11の互換インポーターまで直接接続しない。
- 共通UIは追加スクリプトが既存route rendererを包む方式で、レスポンシブはCSS media queryを使う。

## 実装した構成

| ファイル | 役割 |
| --- | --- |
| `music-studio.js` | 15入口、状態定義、ホーム、仮ページ、ホスト用route adapter、単体起動mount |
| `music-studio.css` | Music Studio専用UI、Mac・iPad・iPhone相当幅、focus表示 |
| `music-studio.html` | Nova Studioホストがなくても開ける単体起動入口 |
| `app.js` | 専用CSS/JSを読み込む小さなホストadapter |
| `tests/music-studio-home.test.js` | 入口、状態、仮ページ、単体表示、既存route保持の回帰確認 |

## ルート

- Nova Studio / Dream Architect Studio内：`index.html#music-studio`
- 単体起動：`music-studio.html#music-studio`
- 安全な仮ページ：`#music-studio/{feature-id}`
- Dream Architect Studioへ戻る：`#dream-architect`
- Nova Studioへ送る：`#music-studio/send-nova`（Music StudioからNova Studioへの受け渡しは未実装のため安全な仮ページ）

ページ再読み込み時も同じハッシュから描画する。未知のMusic Studio子ルートはホームへ安全に戻す。

## 保存と互換性

MS-01はホームの骨組みに限定し、新しい保存処理を持たない。`novaStudio_v01`、Dream Architect連携キー、`aiMusicHelperProject`、既存JSON形式を変更・削除しない。最近使ったプロジェクトは空状態を表示し、架空データを保存しない。

## 未実装

- プロジェクト作成・編集・最近使ったプロジェクトの永続化
- Logic Pro Xファイル受け渡し
- MIDI Composer、歌詞・音符割付、AI作曲データ取り込み
- 楽器別MIDI、音色・プラグイン、ミックス、マスタリング
- Music Studio専用ファイル管理、バックアップ、設定の実処理
- Nova Studio handoffのMusic Studio側受信・送信処理
- `ai-music-helper` Version 4互換インポーター

## MS-02

新しい音楽プロジェクトの最小作成フォーム、MS-00B Version 1契約validator、保存アダプターinterfaceを実装する。保存方式を確定するまではNova StudioのlocalStorageへMusic Studioプロジェクトを混在させない。
