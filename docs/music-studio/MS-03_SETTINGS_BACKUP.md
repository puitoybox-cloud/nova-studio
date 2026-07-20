# MS-03 Music Studio設定・保存設定・バックアップ基盤

状態：🔵 ティア確認待ち

実装日：2026-07-20

## 調査結果と境界

Music Studioはホスト内 `#music-studio` と単体 `music-studio.html#music-studio` で同じ `music-studio.js` / `music-studio.css` を使用する。MS-02の正本はIndexedDB `music-studio-projects` の `projects` store、最近開いたIDだけは `musicStudio_lastProjectId_v1` に保存される。Nova Studioの `novaStudio_v01`、Dream Architect連携キー、`aiMusicHelperProject` と既存バックアップ処理は変更しない。

MS-03は同じ専用DBをVersion 1からVersion 2へ非破壊更新し、`projects` storeを維持したまま `settings` store（keyPath `id`、正本ID `current`）だけを追加する。IndexedDBが利用できない場合はセッション内memory repositoryへ退避し、日本語エラーを表示する。

## 設定形式 Version 1

- `format`: `music-studio-settings`
- `version`: `1`
- `createdAt` / `updatedAt`: UTC ISO 8601
- `appVersion`: 一元管理したMusic Studio版
- 分類: `general`, `projectDefaults`, `autosave`, `midi`, `logicPro`, `fileNaming`, `backup`, `display`, `accessibility`, `privacy`, `experimental`

主な初期値は日本語・日本向け日付、確認と通知有効、BPM 120、4/4、キー未設定、アイデア、自動保存有効、60秒間隔、入力停止3秒、MIDI Type 1、PPQ 480、1/16、velocity 100、Logic Pro Xはファイル書き出し、ファイル名 `{projectName}_{type}_{date}`、自動バックアップ無効、保持10件、外部送信・解析・クラウド同期・実験機能は無効である。

BPM 20〜400、拍子形式、統一キー候補、自動保存15〜3600秒、遅延1〜30秒、PPQ 24〜9600、channel 1〜16、velocity 1〜127、バックアップ保持1〜100、ファイル名長20〜200を正規化する。未知項目は取り込まず、不足項目は初期値で補う。未知Version、別format、壊れたJSONは現在設定を維持して拒否する。

## プロジェクト初期値と自動保存

設定したBPM、拍子、キー、制作状態、制作目的、制作メモは、変更後に作る新規プロジェクトだけへ適用する。既存 `music-studio-project` Version 1は読み込み・表示時に設定値で上書きしない。

編集画面は手動保存を常時提供し、自動保存有効時に入力停止後と設定間隔で保存する。タイマーは再入力時に置換し、保存順序番号により古い完了結果を最新入力として扱わない。状態は「未保存の変更があります」「保存中」「保存しました」「保存に失敗しました」を文字とaria-liveで示す。自動保存無効時は未保存状態と離脱確認を維持する。

## バックアップ形式 Version 1

- `format`: `music-studio-backup`
- `version`: `1`
- `metadata`: 作成日時、アプリ版、件数、バイナリ非同梱
- `settings`: 設定Version 1
- `projects`: 各プロジェクトVersion 1
- `references`: 参照ファイルのメタ情報

MIDI、音声、画像本体は埋め込まず、再選択が必要な外部参照として書き出す。読み込みは概要を先に表示し、設定とプロジェクトを個別選択できる。復元前に現在状態を安全コピーとして書き出し、既存データは削除・置換しない。同じprojectIdは新IDと「（復元）」名で追加する。一部失敗は成功件数と失敗件数を分けて報告する。

## 単体配布と未実装範囲

設定・バックアップはNova Studioの設定モジュール、外部SDK、アカウント、課金、広告、クラウドに依存しない。Logic Pro Xの自動起動・直接操作、MIDI生成、AI連携、音声解析、プラグインスキャン、クラウド同期、自動バックアップ実行本体は未実装である。設定項目だけを将来の分離可能な契約として保持する。

## 完了条件

専用設定とバックアップの独立ルート、ホーム導線、保存・再読込、設定JSON、追加統合復元、新規プロジェクト初期値、自動保存状態、主要幅の操作性、既存ルートと保存領域の回帰確認が完了し、全テストが成功すること。

次の正式作業はロードマップ記載のLogic Pro X連携調査であり、ファイル受け渡し、起動方式、保存責務を設計する。直接操作は対象外とする。
