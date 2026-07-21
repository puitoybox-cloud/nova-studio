# Nova Studio Changelog

## MS-05（Standard MIDI File Type 1書き出し・検証基盤）

- 外部依存なしの`music-studio-midi.js`でMThd、tempo／拍子track、複数note track、UTF-8 track名、channel、velocity、Program Change、VLQ、End of Trackを持つSMF Type 1を生成
- BPM、拍子、PPQ、channel、pitch、velocity、tick、duration、note数を事前検証し、演奏dataなしや範囲外値ではdownloadしない安全境界を実装
- 独立parserでheader、chunk長、Type、track数、PPQ、VLQ、event範囲、End of Track、file末尾、Note On／Off数を生成直後と再選択時に検査
- Logic Pro連携画面へ書き出し前summary、test project、安全filename、二重実行防止、`audio/midi` Blob download、Object URL解放、端末別案内を追加
- IndexedDB Version 4へmetadata専用`midiExportHistory` storeを非破壊追加。MIDI本体はproject、history、JSON、backupへ保存しない
- `midiData`は存在するprojectだけ保持し既存Version 1を強制移行しない。Nova Studio、Dream Architect Studio、ai-music-helperの保存領域は変更なし
- 自前test MIDIでType 1、3 track、PPQ 480、120／132 BPM、主要拍子、日本語名、10 notesを検査し、全118自動test成功
- 外部library、fixture、追加packageなし。Logic Pro実機での読込・再生確認はティア確認待ち

## MS-04（Logic Pro X連携方式の調査・設計）

- Logic Proへの最初の連携をStandard MIDI File Type 1の手動往復とし、Type 0、WAV、AIFF、CAF、MusicXML、JSON／text、tempo・拍子・marker等の維持範囲を公式資料基準で整理
- `music-studio/logic-pro` に専用画面を追加し、MS-03設定の一元表示、初心者向け手順、対応／未対応形式、端末別制限、空履歴を表示
- MIDI Composer未実装時はdownloadを開始せず、説明だけを表示する安全境界を追加
- Logic ProからのMIDI選択に16 MB上限、拡張子、`MThd` headerの事前検証を追加し、元file・既存projectを変更しない将来parser境界を定義
- WAV／AIFF／CAFは名前・MIME・sizeだけを一時確認し、本体・絶対path・File objectをIndexedDBやbackupへ保存しない参照骨組みを追加
- `music-studio-project` Version 1、Nova Studio、Dream Architect Studio、`ai-music-helper` の保存形式・領域は変更なし。Logic Pro自動起動、直接操作、`.logicx`編集、MIDI生成・高度解析は未実装
- 正式roadmapをMS-04ティア確認待ちへ更新し、次の正式作業をMS-05 Standard MIDI File生成・検証基盤と定義

## MS-03N（Music Studio夜間追加実装）

- Music Studio起動時だけ期限を確認する端末内自動バックアップ、内容重複防止、4MB上限、自動記録だけの保持件数整理、一覧・明示復元を追加
- バックアップの個別破損を全体拒否せず、安全なプロジェクトだけ追加して成功・スキップ・失敗を分けて報告
- 自動保存へフォームスナップショットと編集世代を追加し、保存中の再入力、古い完了結果、画面移動、削除済み対象、保存失敗を安全に処理
- `{time}` を含む6トークンのファイル名生成、プレビュー、危険文字・連続区切り整理、長さ制限、代替名、未知トークン拒否を共通API化
- MIDI・Logic Pro X設定の防御的取得APIを追加し、自動起動・直接操作・外部送信等は読み込み値にかかわらず無効固定
- Nova Studioホーム画像の存在しない先行パスを既存ルート素材へ変更し、404通信と欠損時の壊れた画像表示を抑止
- 回帰・設定・保存競合・部分復元・自動バックアップ・ファイル名の自動テストを追加

## MS-03（Music Studio設定・保存設定・バックアップ基盤）

- `music-studio-settings` Version 1の12分類設定画面、検証、保存・再読み込み、初期値復元、設定JSON入出力を追加
- IndexedDB `music-studio-projects` をVersion 2へ非破壊更新し、既存 `projects` storeを維持して専用 `settings` storeを追加
- BPM、拍子、キー、制作状態、目的、メモを新規プロジェクトだけへ反映し、既存Version 1プロジェクトは変更しない互換連携を追加
- 有効・無効、定期・入力停止後保存、手動保存、4状態表示、失敗通知、離脱警告、多重タイマー防止を備えた自動保存基盤を追加
- `music-studio-backup` Version 1の全体JSON、内容プレビュー、設定・プロジェクト選択、復元前安全コピー、ID重複時の追加統合、部分失敗報告を追加
- バックアップに外部ファイル本体を埋め込まず、参照メタ情報と再選択フラグだけを保存
- 設定とバックアップをホームで使用可能へ更新し、単体ルート、レスポンシブ、aria-live、キーボードフォーカスを整備
- `novaStudio_v01`、Dream Architect連携キー、`aiMusicHelperProject`、既存プロジェクト形式は変更なし

## MS-02（Music Studioプロジェクト管理）

- `music-studio-project` Version 1の新規作成、更新順一覧、検索、最近使ったプロジェクト、編集と未保存表示を実装
- 新しいIDと日時での複製、対象名を示す確認付き個別削除、キャンセル導線を追加
- 1プロジェクト単位のJSON書き出しと、形式・版・必須値を検証する安全な読み込みを追加
- JSON読込時のID重複は新しいIDで複製し、壊れたJSON・別形式・未知のmajor版は既存データを変更せず拒否
- 正本を専用IndexedDB `music-studio-projects` / `projects` に分離し、最近開いたIDだけを `musicStudio_lastProjectId_v1` に保存
- `novaStudio_v01`、Dream Architect連携キー、`aiMusicHelperProject`、既存バックアップJSON形式は変更なし
- Mac・iPad・iPhone相当幅に対応するフォーム、一覧、危険操作の視覚区別、ラベル関連付けを追加
- MS-03の対象を制作セクションとMIDI Composerへの最小参照境界に限定し、MIDI本体編集は未実装として維持

## MS-01F（Music Studio独立表示修正）

- Music Studioルート専用のbodyクラスを追加し、ホームと全仮ページでNova Studio共通ヘッダー、サイドナビ、制作フロー、下部ナビを非表示に変更
- Music Studioルートを離れる時は専用クラスを即時解除し、Nova Studio本体の共通ナビ表示を維持
- ホスト内のMusic Studioを全幅・専用背景で表示し、単体起動時と不自然な差が出ない構成へ修正
- Nova Studio共通ナビのHTML、通常ルートのCSS、既存保存データ形式は変更なし
- ホスト内ルート、単体ルート、Music Studio子ルート、Nova Studioへの復帰を対象に回帰テストを追加

## MS-01（Music Studioホーム）

- Logic Pro X中心の音楽制作支援アプリであることを示すMusic Studio専用ホームを追加
- 新規プロジェクト、最近使ったプロジェクト、Logic Pro X連携、MIDI Composer、歌詞・音符割付、AI作曲データ取り込み、楽器別MIDI、音色・プラグイン管理、ミックス、マスタリング、ファイル、バックアップ、設定、Dream Architect Studio、Nova Studioの15入口を追加
- `使用可能`、`作業中`、`未実装`の状態表示と、未実装機能が白画面にならない共通準備中画面を追加
- Nova Studio内の `#music-studio` と子ルート、および単体起動用 `music-studio.html#music-studio` を追加
- Music StudioのJS/CSS/HTMLを専用ファイルへ分離し、既存 `novaStudio_v01`、Dream Architect連携キー、`aiMusicHelperProject` を読み書きしない構成を維持
- Mac、iPad、iPhone相当幅のレスポンシブ構成、キーボードフォーカス、見出し・ランドマークを追加
- MS-02の範囲を新規プロジェクト作成、Version 1 validator、保存アダプターinterfaceとして記録

## MS-00A〜MS-00C（Music Studio基礎設計）

- Dream Architect Studio / Nova Studioと既存 `ai-music-helper` の構造、保存キー、JSON入出力、連携境界を調査
- Music Studioを独立リポジトリで管理し、Nova Studioには入口と連携アダプターだけを置く分離方針を決定
- `aiMusicHelperProject` Version 4を壊さないコピー変換、Version 1プロジェクト契約、確認型handoffを設計
- アプリ名・版・エディションを差し替えられる製品設定と、販売ビルド用ライセンス台帳を設計
- MS-00A〜MS-00Cをティア確認待ち、MS-01を次の実装作業として記録

## Version 0.2.9（画像中心Story Archive仕上げ）

- Version表示を `0.2.9` へ更新
- 後続のStory Archive拡張後も、カード詳細の画像中心レイアウトが最後に適用されるように調整
- カード詳細をタイトル、代表画像、画像ギャラリー、基本設定・本文、関連カード、折りたたみ管理情報の順に統一
- カード一覧を代表画像、タイトル、カテゴリ、状態、画像枚数、関連カード数、更新日時が目立つ画像ファースト表示に統一
- Memory Sync履歴と既存連携を残し、既存カード・画像資料・画像セット・localStorageキーを変更しない方針を維持

## 2026-07-16

- ChatGPT連携画面を追加し、現在の作品・話数・Scene・関連Story Archiveカード・制作状況・使用画像/動画/音声を文章またはJSONでコピーできるようにしました。
- ChatGPTが返した更新用JSONを貼り付け、追加・更新・削除のプレビュー確認後に反映できる安全な読み込み導線を追加しました。
- ChatGPT連携の送信コピー・JSON読込履歴と、JSON反映前の自動バックアップを保存するようにしました。

## Version 1.0.0

- Story ArchiveをVersion 1.0へ更新
- カードカテゴリ「キャラクター」「世界観」「場所」「アイテム」「用語」「ストーリー」ごとの専用入力テンプレートを追加
- カードに確定／未確定フラグを追加し、状態「確定」と連動
- カード単位の変更履歴を保存し、詳細画面で確認できるように変更
- 関連カードの複数選択を双方向リンクとして保存・解除できるように維持
- Story Archive内に時系列表示を追加
- Story Archiveフォルダを追加し、親フォルダつきの階層管理に対応
- 既存Story Archiveカードは同じlocalStorageキー内で自動正規化し、既存画像資料・画像セットを保持
- JSON書き出し・読み込みにStory Archiveフォルダを追加
- Version表示を1.0.0へ更新

## Version 0.2.9

- Story Archiveカード詳細を画像中心の表示順へ変更
- 管理情報（ID、作成日時、更新日時、その他情報）を初期状態で閉じた折りたたみ表示へ変更
- 代表画像を正式採用画像、Vidu参照画像、画像セット基準画像、先頭画像の優先順で表示
- 画像ギャラリーを大きなグリッドへ変更し、画像名、種類、角度、状態、正式採用、Vidu参照を文字表示
- サムネイル上に角度、状態、正式採用、Vidu参照ラベルを表示
- 画像拡大表示に前後切替、左右スワイプ、拡大、縮小、閉じる、画像情報、編集、削除を追加
- カード一覧に大きな代表画像、タイトル、カテゴリ、状態、画像枚数、関連カード数、更新日時を表示
- iPad縦向きで画像追加・画像セット管理へすぐ触れる配置、横向きで2カラム表示に対応
- Version表示を0.2.9へ更新

## Version 0.2.8

- Story Archiveカードに関連カードの複数選択、相互表示、詳細遷移、解除、削除時クリーンアップを追加
- Story Archive検索に関連カード名を追加
- キャラクター、世界観、場所、背景、アイテム、小物、組織・種族、エピソード、その他向けの複数画像資料管理を追加
- 画像資料の種類、角度・視点、状態、保存場所、ファイル名、説明、タグ、注意事項、正式採用、Vidu参照、将来連携用項目などの登録・編集・削除に対応
- 画像セットの作成、編集、削除、基準画像と含有画像の管理に対応
- 画像ギャラリーに、すべて、正式採用、Vidu参照、種類別、角度別、状態別、画像セット別、旧案、没案の切り替えを追加
- 元画像本体ではなく小さなプレビュー、ファイル名、保存場所、登録情報だけを既存localStorageキーに保存する方針を実装
- Version表示を0.2.8へ更新

## Version 0.2.6

実装日：2026-07-15

追加：

- Version表記を `0.2.6` に更新
- Story Archiveの「＋カード作成」から実際のカードを登録できるように変更
- Story Archiveカードに関連作品・関連話数の入力、保存、一覧表示を追加
- Story Archiveカードを既存 `novaStudio_v01` localStorageキー内へ保存し、既存データを変更せず追記・編集・削除できるように維持
- Story Archive画面にタイトル、カテゴリ、本文、タグ、関連作品、関連話数を対象にした検索を追加
- Story ArchiveアプリURLが未登録でもNova Studio内のStory Archive画面を開けるように変更

変更：

- Story Archive画面のダミーデータ登録ボタンを削除し、実際のカード登録のみ使用する導線に変更

注意：

- 既存localStorageキーは変更しない
- 既存データは変更しない

## Version 0.2.5

実装日：2026-07-15

追加：

- Story Archive共通データ構造を追加
- 「1作品 → 話数 → カテゴリ → カード」の階層でStory Archiveカードを管理
- カテゴリ「概要」「世界観」「キャラクター」「時系列」「用語」「場所」「アイテム」「組織・種族」「エピソード」「台本」「アイデア」「伏線」「変更履歴」「作品設定」に対応
- カード項目としてID、タイトル、本文、カテゴリ、タグ、作品、話数、関連カード、作成日時、更新日時、状態を追加
- 状態「確定」「仮設定」「検討中」「保留」に対応
- Story Archive画面でカードの作成、編集、削除、取得（一覧表示）に対応
- Story Archive画面からダミーデータを1件登録して編集・削除できる動作確認導線を追加
- Story Archiveカードを既存 `novaStudio_v01` localStorageキー内に保存
- JSON書き出し・読み込みにStory Archiveカードを含めるよう更新
- 設定画面に「Story Archive URL」入力欄を追加
- 「Story Archiveを開く」ボタンが登録済みURLを開くように変更
- Story Archive URL未登録時に「Story ArchiveのURLが登録されていません」と表示

注意：

- 既存localStorageキーは変更しない
- 既存データは変更しない
- Import Center自動登録、AI自動分類、全文検索、自動要約は未実装

補足（同バージョン内の既存更新）：

- Import Centerの登録候補に「Story Archiveへ登録」ボタンを追加
- 登録候補ごとに登録先（概要、世界観、キャラクター、時系列、用語、場所、アイテム、組織・種族、エピソード、台本、アイデア、伏線、変更履歴、作品設定）を選択できるように変更
- 登録前に対象件数、登録先別件数、重複候補を確認する画面を追加
- 既存項目と同じタイトルがある場合は重複候補として表示し、「新規登録」「既存を維持」「手動で確認」を候補ごとに選択可能
- 登録後にStory Archiveの該当一覧を開く導線を追加
- 既存localStorageキーは変更せず、既存のImport Center履歴・候補保存を維持

## Version 0.2.4

実装日：2026-07-15

追加：

- Version表記を `0.2.4` に更新
- Import CenterでPDF、TXT、Markdown、JSON、長文貼り付けのプレビューからNova整理できる機能を追加
- 「Nova整理」ボタンを追加し、読み込み内容を候補カテゴリへ簡易分類
- 「概要」「世界観」「キャラクター」「時系列」「用語」「場所」「アイテム」「組織・種族」「エピソード」「台本」「アイデア」「伏線」「変更履歴」「作品設定」「ゴミ箱」の候補カテゴリに対応
- 自動登録せず、「登録候補」としてタイトル、カテゴリ、本文を確認・編集できるUIを追加
- チェックした項目だけNova Studioの既存コレクションへ登録する動作を追加

注意：

- localStorageキーは `novaStudio_v01` のまま変更しない
- 既存データはNova整理時には変更せず、チェック項目の登録操作時のみ追記する
- PDF本文はブラウザ内で抽出できる範囲の簡易プレビューに限定
- 外部AI/API連携は未実装

## Version 0.2.3

実装日：2026-07-15

追加：

- Version表記を `0.2.3` に更新
- URLパラメータ `project`、`episode`、`source`、`returnUrl` の受け取りに対応
- 起動時に `project` と `episode` に一致する作品・話数を自動選択
- 画面上部に「Nova Studioへ戻る」ボタンを追加
- `returnUrl` がある場合はそのURLへ戻り、無い場合はトップへ戻る動作を追加

注意：

- localStorageキーは `novaStudio_v01` のまま変更しない
- 既存データを別キーへ移動せず、既存localStorageを壊さない
- 双方向同期、制作データの自動取り込み、外部API連携は未実装

## Version 0.2.2

実装日：2026-07-14

追加：

- Version表記を `0.2.2` に更新
- Import CenterでPDF、TXT、Markdown(.md)、JSON、Word(.docx)のファイル選択に対応
- 選択ファイルのファイル名、サイズ、種類、更新日時を表示
- TXT、Markdown、JSONの内容プレビューを追加
- PDFのページ数、ファイル名、サイズ表示を追加（本文解析は未実装）
- Wordのファイル名表示を追加
- 長文貼り付け用テキストエリアを追加
- 読み込み履歴（日時、ファイル名、種類）をlocalStorageへ保存
- ホーム画面の主要導線を「続きから」「作品ダッシュボード」「📥 資料取り込み（Import Center）」「Universe」の4カードに整理
- 資料取り込みカードからImport Center画面へ移動できる導線を追加
- Import Center画面にPDF、Word、TXT、Markdown、JSON、長文貼り付けの取り込み方法カードを表示
- Import Center画面に「ホームへ戻る」ボタンを表示
- iPad Safari向けにImport Centerの主要ボタンを大型化

注意：

- 解析やAI分類は未実装
- localStorageキーは `novaStudio_v01` のまま変更しない
- 既存データとlocalStorageキーは変更せず、ホーム導線とImport Center表示のみを更新

## Version 0.2.1

実装日：2026-07-14

追加：

- Version表記を `0.2.1` に更新
- ホーム画面に「📥 Import Center」カードを追加
- Import Center画面を新規作成
- PDF、Word、TXT、Markdown、JSON、長文貼り付けの取り込み方法カードを追加
- 「取り込み履歴」セクションを追加（空表示）
- 「ノヴァ整理」セクションを追加（空表示）
- 「読み込み開始」ボタンを追加（ダミー動作）
- 「ホームへ戻る」ボタンを追加

注意：

- 実際のファイル解析やAI分類は未実装
- 既存機能、既存データ、localStorageは変更しない

## Version 1.0

実装日：2026-07-14

追加・更新：

- Version表記を正式版の `1.0` に更新
- ホームに「Nova Studioへようこそ」ガイドを追加
- 作品 → 話数 → Scene → 制作へ進む導線をホームから確認しやすく整理
- READMEを現在の機能、JSONバックアップ、対応端末、Version 1.1予定に合わせて更新
- CHANGELOGへ正式リリース内容を追加

最終確認：

- Mac、iPad、iPhone向けのレスポンシブUIを確認
- JSON書き出し、JSON読み込み、旧JSON互換、空データ補完の実装を確認
- 大きな新機能は追加せず、完成度・安定性・使いやすさを優先

## Version 0.2 Step1

実装日：2026-07-14

追加：

- 作品、話数、キャラクター、世界観、用語、画像、動画、アイデアを扱うための共通データ項目を追加
- 既存の作品・話数・アプリ設定を共通項目へ自動補完する互換レイヤーを追加
- 共通JSONの書き出し・読み込み対象に将来用コレクションを追加

注意：

- 今回は内部データ構造のみの変更で、画面は変更しない


## Version 0.1

実装日：2026-07-14

追加：

- Nova Studioホーム
- 制作アプリ一覧
- アプリURL管理
- 作品管理
- エピソード管理
- 現在の作品・話数選択
- URLパラメータ付きアプリ移動
- 最近開いた項目
- お気に入り
- 共通JSON
- 完全バックアップJSON
- ノヴァ相談用データ書き出し
- iPad、iPhone、Mac対応

注意：

- 既存制作アプリのデータは変更しない
- 各制作アプリとの本格的なデータ連携はVersion 0.2以降
