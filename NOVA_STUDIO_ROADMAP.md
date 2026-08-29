# Nova Studio 正式ロードマップ

この文書をNova Studio開発の正式な進行基準とする。機能の全体像は `NOVA_STUDIO_MASTER_LIST.md`、LINK-01の事前調査は `LINK_01_INVESTIGATION.md` を参照する。

## 運用基準

- 状態：⬜ 未着手 / 🟡 作業中 / 🔵 ティア確認待ち / 🟣 修正中 / ✅ 完成
- 「実装済み」だけでは完成にしない。実装、静的確認、対象端末での受入確認、既存データ互換性の確認が揃った時点で完成とする。
- 既存機能、既存画面、`novaStudio_v01` のキー名と既存JSONフィールドを削除・破壊的変更しない。
- 新機能は既存のハッシュルーティング、選択コンテキスト、外部アプリ起動処理を優先して再利用する。
- ロードマップの状態変更時は、根拠となるPR、確認内容、残課題を同時に更新する。

## 正式ロードマップ

| ID | 状態 | 作業内容 | main照合結果・完了条件 |
| --- | --- | --- | --- |
| NS-01 | ✅ 完成 | Nova Studioセクション基盤 | `nova-studio-sections.js/css` と `index.html` の読込を確認。PR #116由来の実装がmainへマージ済み。 |
| NS-02 | ✅ 完成 | 既存ホームへのセクション統合 | 既存 `homeView()` を保持した追加方式と、全機能入口の挿入を確認。既存ホーム・保存処理の削除なし。 |
| NS-03 | ✅ 完成 | 機能グループとカード構成 | 「物語と世界」「制作素材」「制作アシスト」「Studio管理」の4グループと16機能カードを確認。 |
| NS-04 | ✅ 完成 | 実装状態表示と仮ルート | 完成済み・作業中・未実装の表示、Locations／Items／Images／Scripts／Geminiの仮画面を確認。 |
| NS-05 | ✅ 完成 | Mac・iPad向けレスポンシブ基盤 | 専用CSSのグリッド、ブレークポイント、タッチ操作向け定義を確認。基盤として完成とし、各機能の端末受入は個別項目で扱う。 |
| NS-06 | 🔵 ティア確認待ち | Dream Architect Studioホーム | 13の制作アプリ入口、4カテゴリ、共有情報表示、未実装アプリの共通準備中画面を実装。ブラウザ確認後もティアの実機受入までは確認待ち。 |
| NS-07 | 🔵 ティア確認待ち | Nova Studioとの相互移動 | 既存ハッシュルートを使う往復導線はmainに実装済み。選択コンテキストとブラウザ履歴を含む受入確認で完成。 |
| NS-08 | 🔵 ティア確認待ち | 全体動作確認 | 静的な実装照合は完了。Mac・iPad実機、外部URL設定あり／なし、既存保存データでの回帰確認を完了後に完成。 |
| LINK-01 | ✅ 調査完了 | 選択中の作品・話数を制作アプリへ安全に共有 | `LINK_01_INVESTIGATION.md` に調査結果を記録。 |
| LINK-02 | 🔵 ティア確認待ち | Dream Architect Studioへの入口 | PR #119でmainに追加された入口を依存基点として継承。Mac・iPad表示と導線をティア確認後に完成。 |
| LINK-03 | 🔵 ティア確認待ち | 作品・話数コンテキスト共有 | PR #119の作品名・作品ID・話数ID共有を継承し、旧v1形式を読める互換処理を維持。 |
| LINK-04 | 🔵 ティア確認待ち | キャラクター設定・正式画像共有 | 複数選択、欠損値、Story Archive由来のキャラクターと画像に対応。 |
| LINK-05 | 🔵 ティア確認待ち | 背景・画像等の素材共有 | メタデータ共有と永続参照可否を分離し、実ファイルは送信しない。 |
| LINK-06 | 🔵 ティア確認待ち | 制作結果の受け取り候補 | 検証、一覧、登録・保留・却下、重複・更新候補を専用領域で管理。 |

## NS-06〜NS-08 設計・受入基準

### NS-06 Dream Architect Studioホーム

- 音楽制作、MIDI Composer、歌詞・音符割付、ボイス制作、画像制作、漫画制作、LINEスタンプ制作、AIアニメ制作、Viduプロンプト作成、動画制作、ホームページ制作、プロンプト管理、今後追加する制作アプリの13入口を表示する。
- 音楽制作、MIDI Composer、歌詞・音符割付を優先領域としてまとめ、次の正式作業はLogic Pro周辺の要件整理とする。
- 利用可能なアプリは既存処理で開き、未実装アプリは保存データを変更しない準備中画面へ遷移する。
- MacとiPadの縦・横表示で、カードの欠け、横スクロール、操作不能がないことを確認する。

### NS-07 相互移動

- Nova StudioからDream Architect Studioへ移動でき、双方からNova Studioホームへ戻れる。
- 戻る操作で履歴を不必要に二重追加せず、既存クエリとハッシュを壊さない。
- 移動前後で `state.activeContext` の作品ID・話数IDを変更しない。
- 外部制作アプリは既存の `openApp()` / `buildAppUrl()` を利用し、URL未設定時も既存の案内または内部画面へ安全にフォールバックする。

### NS-08 全体動作確認

- Mac Safari/Chrome、iPad Safariの縦・横でホーム、機能一覧、Dream Architect Studio、準備中画面、戻る導線を確認する。
- 外部URL設定あり／なしの両方を確認する。
- 既存の作品、話数、Story Archive、Memory Sync、Import Center、バックアップが従来どおり開き、保存できることを確認する。
- 既存の `novaStudio_v01` を読み込み、キー名・既存フィールド・登録データが変化しないことを確認する。
- 問題があればNS-06またはNS-07を🟣修正中へ戻し、再確認後にNS-08を完成とする。

## 現在地と次の順序

- 現在のフェーズ：LINK-04〜LINK-06 ティア確認待ち
- 次の作業：ティアがMac・iPad実機でDream Architect Studio入口、送信前確認、候補登録、既存機能回帰を確認する。
- 続く作業：確認結果を修正し、LINK-04〜LINK-06を完成判定する。
- その後：LINK-07（外部アプリ接続方式の正式設計）へ進む。
- 最終更新日：2026-07-20

## Music Studio正式ロードマップ

### 現在のVersion管理軸

Music Studioには用途の異なる複数の管理軸がある。これらは同じVersion体系ではなく、相互に自動換算しない。

- `APP_VERSION`：アプリが設定・project metadataへ記録する実装版。現在は `1.4.0`。
- `music-studio-project` schema：保存projectの互換境界。現在は Version 1（`schemaVersion: 1.0`）。
- `MS-xx`：基礎設計、保存、Logic Pro連携等の作業単位。
- Music Studio `0.1`〜`0.4`：Git branch／PRで使用した開発系列名。`0.4`はPR #185〜#202の完了記録に対応する。

`APP_VERSION`、project schema、`MS-xx`、開発系列名を統合する正式規則はrepository内で定義されていない。

| ID | 状態 | 作業内容 | 完了条件・次作業 |
| --- | --- | --- | --- |
| MS-00〜MS-00C | ✅ 完成 | 分離基盤、Version 1契約、ライセンス台帳 | 単体配布可能な保存・route境界を維持。 |
| MS-01 / MS-01F | ✅ 完成 | 専用home、独立表示 | 共通navigationをMusic Studio routeだけで非表示。 |
| MS-02 | ✅ 完成 | Version 1 project管理 | 非破壊JSON入出力と専用IndexedDB。 |
| MS-03 / MS-03N | ✅ 完成 | 設定、backup、自動保存・夜間安全策 | 設定APIをMS-04以降の正本にする。 |
| MS-04 | 🔵 ティア確認待ち | Logic Pro X連携方式の調査・設計 | SMF Type 1手動往復を採用。専用案内、事前検証、音声一時参照を実装。実機受入後に完成判定。 |
| MS-05 | 🟨 ティア確認待ち | Standard MIDI File生成・検証基盤 | 依存なしType 1 writer、tempo・拍子・UTF-8 track名、複数track、内部再解析、履歴、無data無出力、118テスト。Logic Pro実機確認待ち。 |
| MS-06 | 🟨 ティア確認待ち | Logic Pro MIDI読み込み・解析・安全な再編集基盤 | 独立Type 0/1 parser、Running Status、Meta／channel event、tempo／拍子map、note組立、Program／CC保持、preview、新規／複製、履歴、MS-05往復。 |
| MS-07 | 🟡 実装済み・継続改善 | MIDI Composerホーム・共通Editor | MS-06解析基盤を再利用した編集入口、Melody／Drums／Bass共通Editor、保存・再生・録音・部分編集基盤がmainに存在する。独立したMS-07受入完了記録は確認できない。 |

MS-04の調査・実装・未対応範囲は `docs/music-studio/MS-04_LOGIC_PRO_INTEGRATION.md` を正本とする。Logic Proの自動起動・直接操作・project file編集、外部送信は採用しない。

MS-06の解析仕様、保存境界、性能上限、既知の制限は `docs/music-studio/MS-06_MIDI_IMPORT.md` を正本とする。

### Music Studio 0.4開発系列：実装完了

PR #185〜#201で予定していた実装範囲をmainへ追加し、Music Studio 0.4は実装完了とする。

- Note LockとEdit Range
- Partial Editのrequest、result、preview、apply、session、UI基盤
- AI input、structured instruction、prompt context
- OpenAI／Gemini Provider Adapter、execution boundary、Transport、Config
- runtime credential／model注入とcredential非保持
- timeout、HTTP／provider errorの安全な分類とallowlist診断
- OpenAI Structured OutputsおよびGemini schema互換変換
- OpenAI／Gemini Minimal Live API Smoke CLI
- Partial Edit UIのinstruction、provider、model、runtime credential入力と既存provider workflowへの接続
- provider responseから既存validation境界を経由した非破壊Preview、stale response拒否、多重実行防止
- Local `Pitch +1 Preview`の維持
- OpenAI Live Preview成功
- Geminiのprovider errorおよびtimeoutの安全処理確認

0.4の実装完了判定は、予定した基盤とUI統合、offline回帰、OpenAI実接続、Gemini失敗時の安全性、credential非保持に基づく。外部providerやmodelのavailabilityは実装完了条件から分離する。

既知事項：Gemini Live success remains unconfirmed; safe provider-error and timeout handling are confirmed. Geminiの両Live確認でProject非変更とcredential非保持を確認した。結果からprovider側障害、実装不具合、利用不能のいずれも断定しない。

### 0.5の状態と次候補

Music Studio 0.4完了後、次に0.5のscopeを決定する段階である。0.5の正式な開始条件、scope、優先順位は未定義であり、今回の完了記録では開始を宣言しない。開始前に、次を決定する。

1. Track playback／Mute／Solo、GM Drum Map／input assignment、Logic Pro実機受入、home上のplanned機能等から正式scopeを選ぶ。
2. 優先順位とentry conditionを定義する。
3. 次のMS番号を定義するか判断する。

これらは検討候補であり、正式な0.5 entry conditionではない。次のMS番号も未定義のため、この文書では新設しない。

## LINK-01着手前にティアが決めること

1. 選択情報の共有範囲を同一ページ内だけにするか、外部サイトにも渡すか。
2. 外部アプリから返された作品ID・話数IDをNova Studioへ反映するか。
3. 共有情報を新たに永続保存する必要があるか。不要なら既存 `activeContext` とURLパラメータだけを利用する。

LINK-01では保存キーや既存JSONスキーマを変更せず、未知のIDを受け取った場合は現在の選択を維持する。

`LINK_01_INVESTIGATION.md` への事前調査の記録は完了済み。上記3点の仕様決定は引き続きティア確認待ちとする。

## LINK-02〜LINK-03 設計・確認状態

- LINK-02：🔵 ティア確認待ち。既存の `homeView()` を保持した追加方式でDream Architect Studioへの入口を表示し、専用ハッシュルートに接続準備中画面を表示する。
- LINK-03：🔵 ティア確認待ち。選択中の作品名・作品ID・話数IDの3項目のみを `novaStudio_dreamArchitectLink_v1` に保存し、未選択時は空文字として安全に案内表示する。
- LINK-02〜LINK-03は既存の `novaStudio_v01` やStory Archiveの保存データを変更しない。Mac・iPadの表示、作品・話数の選択あり／なし、既存データでの回帰確認後に完成とする。

## LINK-04〜LINK-06 設計・確認状態

- LINK-04〜LINK-06の詳細は `DREAM_ARCHITECT_LINK_SPEC.md` を参照する。
- PR #119のLINK-02〜LINK-03と旧v1データを保持し、共有形式は追加項目を持つv2として読み書きする。
- 既存素材へ自動登録せず、送信前確認と結果候補の登録・保留・却下を利用者が明示的に選択する。
