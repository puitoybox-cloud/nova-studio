# Music Studio 30大機能：実物棚卸しと一本化計画

確認日：2026-10-04 JST。マスター：『Music Studio 最終機能仕様書 v1』確定日2026-09-30、5ページ。仕様書の「既存」「新規」は完成証明ではない。

コード確認基準：#289 HEAD `418dc57429f91ffcef6b578a7edfda36012576fd`。main `552d56eafddfd192970c09f7d6278696cf8775c3` はこれらDraftの統合版ではない。main・Open PRを再取得した記録は [開始時点JSON](../../verification/music-completion-start-20261004.json)。Open 36件／Draft 34件。34 Draftのmergeableは全件true。各HEADで取得できたActionsはsuccess。#10/#35はDraftではなく、HEAD Actionsは0件。mergeableは検証済みや承認済みという意味ではない。

## 判定基準と完成度

A＝全要件と保存・失敗・再開・対象実機を含めて完成。B＝一部完成。C＝進行中。D＝今回調べたコードで実装を確認できない。E＝物理実機確認待ち。F＝仕様または技術調査待ち。

「実装・自動検証済み」は個別の下位要件の状態であり、大機能Aを意味しない。スキーマの配列、plannedカード、説明文、synthetic候補は実用生成機能の証明にしない。Dは全履歴に絶対にコードが存在しないという主張ではない。

**全要件を満たすと確認できた大機能は0/30。** これは実装量0%という意味ではない。要件ごとの重み・実機証拠が不足しているため、実装全体の完成率は算出できない。ここに推測のパーセントを置かない。全大機能に残要件がある。実装済みMIDI基盤、保存基盤、AI安全基盤を継承する。

## 30大機能：下位要件、証拠、残作業

| No. / 機能 | 状態 | 確認できた下位要件と証拠 | 残る下位要件／完了条件 |
|---|---|---|---|
| 1 MIDI・Track編集 | B/E | `music-studio-editor.js`、dynamic-track-selection、scoped-midi-repair。`tests/music-studio-editor.test.js`、external-track各test、scoped-midi-repair test：Piano Roll、音符・Velocity・Quantize・音長・Mute/Solo・複数Track・Partial Edit・Correction・Cleanup・Undo/Redo | Mac/iPadの物理操作、全対象Trackの一貫性確認。全曲Key変更はcore Bassを除外する現行testがあり、Key/Chord metadataとの全曲整合を完成扱いしない。 |
| 2 MIDI録音 | B/E | midi-input、dynamic-track-recording、playback。midi-input／recording-tempo-map／coordinated-timing test：鍵盤入力、Count-in、Metronome、Stop保存、テンポ地図 | Keystation接続・切断・権限・音と入力遅延、途中Tempo/拍子の実演奏、保存再開を物理確認。Safariとnative MIDI bridgeを区別。 |
| 3 曲構造・音楽情報 | B/C/E/F | structure-info、meter-map、measure-locks、midi-parser。structure-info／meter-map／midi-metadata-roundtrip test：Tempo/Key/拍子map、marker候補、正確な小節境界、部分保護 | 音源に基づくBPM/Key/Scale/拍子解析、セクション解析の品質、全曲Transpose整合。marker由来候補を音楽解析と同一視しない。 |
| 4 AI新曲スタート | B/C/F | ai-workflow `newSongPlan`、assistant-ui。composition／assistant integration test：明示入力→Preview→新規空Track Project、synthetic A/B/C | 文章/歌詞を理解してBPM/Key/コード/メロディ/構成/編成を提案する実用Model、品質評価、楽器内容。現状は会話理解モデルではない。 |
| 5 AI制作アシスタント | B/C/F | assistant-panel/ui、ai-workflow。assistant-ui／integration test：入力UI、操作経路、候補・履歴・エラー表示 | 普通の会話の理解、機能呼出し、複数依頼の計画、次工程・完成までの支援。現行固定UIを中核AI完成と扱わない。 |
| 6 AI安全編集・変更管理 | B/C/E/F | #270–281、ai-candidate-preview、ai-family-preview/apply、editor lock guard。workflow／family-apply／partial-family-history test：Preview、A/B/C、部分採用/却下、preflight、atomic transaction、履歴、保護、Undo/Redo | 特定変更Undoの競合処理を含む全制作領域への拡張。音声/歌詞の完成形への変更管理、物理確認。既存安全基盤を再実装しない。 |
| 7 AI作曲・曲展開 | B/C/F | #274–284、ai-composition／continuation-source test：synthetic Continuation候補、選択範囲・Source read-only inspection、Family参照 | 実用の続き/2番/ラスサビ/Intro/Interlude/Outro/時間指定/部分再生成、構成と範囲mapping policy、共通再生成execution。 |
| 8 AIアレンジ支援 | B/C/F | #283/#287–289、arrangement-entry/reference/track test：Section/Chord/Role/Track identity、明示Destination選択・stale拒否・Cancel、JSON/Backupから一時情報除外 | Destination binding、書込互換、保存policy、楽器/音符生成、Applyは未確定。単一/複数Track再生成・固定範囲・メロディ固定を実用化。 |
| 9 AIコード支援 | B/C/F | ai-composition synthetic chord/bass候補、Family Preview/Apply tests、Project chordProgressions保持 | 実音楽コード解析、自動コード、追従補正、Voicing、コード別案の品質。metadata候補と実解析を区別。 |
| 10 AI歌詞・メロディ制作 | B/C/F | #282/#285–286、lyrics-exact／lyrics-melody-reference／explicit-selection tests：歌詞構造候補、明示参照、音符identityと範囲確認 | 本文生成/修正、文字数・読み・アクセント・音節割付、固定歌詞/固定メロディの実再生成、重複歌詞occurrence・persisted rebinding・競合/履歴・保存policy。 |
| 11 AI仮歌・対話修正 | D/F | lyrics/音節schemaは存在するが、実仮歌レンダラー・対話修正の実装証拠なし | メロディ＋歌詞→仮歌、聴きながら部分修正。Model/License/Local互換と音声資産非破壊契約を先に確定。 |
| 12 ボーカル録音 | D/E/F | MIDI録音は別機能。ボーカルPCM WAV録音・Take/Compの実装証拠なし | WAV入力確認/monitor/Latency/Punch/Cycle/Take/Comp/歌詞スクロール、Mac/iPad permissionsと音声保存。リアルタイム波形は対象外。 |
| 13 ボーカル編集 | D/F | audioAssets配列・一時参照は編集エンジンではない | 波形＋歌詞＋音符同期、Pitch/Timing/長さ/Crossfade/Breath/Vibrato、非破壊編集とUndo。 |
| 14 ボーカル生成・Harmony | D/F | 実Harmony/Double/Chorus/本人声生成の実装証拠なし | Local/Online Model・License・本人同意・品質・保存契約。本人声は技術/権利確認後。 |
| 15 ボーカル完成チェック | D/F | 実仮歌/Take比較・音程/Timing/音域診断の実装証拠なし | 11–14の音声/Take契約後に比較と判断支援。歌詞間違い自動判定を追加しない。 |
| 16 Stem Separation | B/E/F | audio-pipeline、Python server `process_audio`、Demucs 6 stems。audio-pipeline/e2e／server-boundary tests、#262 package CI | 6音声stemの品質・回収・制作資産としての保持/再開、Intel package署名/配布・物理動作、Model/License。6 named MIDI tracksの生成だけで音声stem制作フロー完成とは言わない。 |
| 17 Audio-to-MIDI | B/C/E/F | Python server refinement、synthetic WAVと失敗MID、test_audio_accuracy.py、scoped repair UIとSave/Undo。今回byte acceptance追加 | 最優先：Intel MacでC4/E4/G4/C5/G4/C4の6音再検証。比較修正/誤候補/信頼度/楽器・精度・単音和音設定/自動整理の全要件。CIやmockを物理PASSにしない。 |
| 18 AIミックス支援 | D/F | mixNotes保持、Track playback gainはmix分析ではない | Volume/EQ/Compression/空間/衝突/可聴性/複数Mix比較、音声DSP/Model選定、非破壊Mix version。 |
| 19 AIマスタリング | D/F | masteringNotes保持のみ。Masterレンダー/計測の証拠なし | 複数Master、LUFS/Peak/Clipping/最終音量、正しい音声計測・renderと品質評価。 |
| 20 Logic Pro往復連携 | B/E/F | midi writer/parser、music-studio Logic route、logic-pro／midi-metadata-roundtrip tests：Type1 export、MIDIコピーimport、履歴、音声一時参照 | 完成WAV/Stem再取込、差分・対応管理、受渡し前検査の統合。Mac Logicの実往復。直接操作/.logicxは公式方式調査まで保留。 |
| 21 最終書出し・配信 | B/E/F | MIDI exportとsingle/combined Trackの検証。MS-05とmidi tests | Master WAV/Instrumental/音声Stem/MIDI一括export、manifest、配信前音量/権利/漏れ検査。WAV出力仕様は音声資産契約後。 |
| 22 保存・曲バージョン | B/E/F | music-studio repository/autosave、projects/storage/coordinated-persistence tests：IndexedDB、JSON、複製、revision、AI候補保管 | 名前付きCheckpoint、候補版/A-B比較、複数Version部分合成、競合と保存互換。schemaにないpolicyを作らない。 |
| 23 Backup・復旧・移行 | B/E/F | backupObject/validateBackup/restoreBackup、autoBackups、settings/storage tests：複数Project、追加復元、壊れた/将来版拒否、外部参照再選択 | 音声binary含む完全Backupと依存検査、別Mac移行、更新前保護、復旧の範囲。採用済Cloud Syncは同期先/暗号化/conflict/offline architecture未確定。 |
| 24 診断・安全修復 | B/C/F | scoped repair、Project/MIDI/Backup validation、audio helper health、lock/preflight tests | 全体性能原因診断、安全軽量化、修復可能範囲/同意/transaction。現行限定MIDI修復を全体診断完成にしない。 |
| 25 AI実行環境・作品保護 | B/E/F | localAdapter拒否、固定loopback audio bridge、settings localOnly、audio bridge guard。workflow/settings/server-boundary tests：外部通信禁止の現状 | 完全Local/Project単位外部禁止の実行境界、送信内容提示、Intel/Apple Siliconの処理別capacityとModel選定。関数adapterのメタデータ検査はsandbox証明ではない。 |
| 26 AI料金管理 | D/F | 有料execution/料金ledgerの実装証拠なし | 料金事前表示、月額上限、Provider別使用量、予約/失敗/Cancel計上。採用Providerと価格根拠が未確定。 |
| 27 AIモデル管理・互換性 | B/F | ai-workflowのlocal/synthetic adapter/provenance、保存候補保持、未知workspace版拒否 | 真のProvider交換、軽量Model、速度/品質、旧版、更新前fixture test、Model license/versionの互換契約。関数wrapperを完成Model管理と扱わない。 |
| 28 スマートUI | B/E/F | standalone UI、settings accessibility/display、responsive tests、assistant panel画面切替 | 不要機能OFF、作業別UI、お気に入り、自然言語から画面表示、physical touch/Japanese glyph/a11y確認。 |
| 29 素材・テンプレート | D/F | Project複製は素材ライブラリではない。専用保存/文章検索の実装証拠なし | 曲/部分素材保存、曲に合わせるKey/BPM調整、文章検索。追加素材系は仕様通り禁止。 |
| 30 完成版・制作履歴 | B/F | Project status/song情報/search、productionHistoryとaiWorkspace.history、projects/family history tests | 完成版固定、完成曲検索、Session/日次/時系列をつなぐ履歴。status値があるだけで完成版immutableと判定しない。 |

上記証拠は#289に含まれる現在のコード/testを確認したもの。仕様文書MS-00B等は契約の意図を補足するが、実装の代わりに使わない。Issue #255は既存安全・物理受入の追跡であり、30機能の完成宣言ではない。tests全体と過去verificationの境界も照合した。

## 一本化した実装順序

順番は依存関係のゲートで固定する。既存DraftをReady/Mergeすることは含まない。どの工程でもmainと既存PRを変えず、最新の検証済みcheckpointから独立branch/Draftを作る。

1. **証拠と最優先精度のゲート（今回）**：30機能の要件分解・実物snapshot・安全基盤の再利用を固定。#17の実変換byte検査、元WAV/MID/Helper digest、CIと物理証拠の分離。音程だけのPASSを除去。Intel最終検証は後述一括受入に残す。
2. **単独起動・資産・互換性の契約（#22/#23/#25/#27、全機能の前提）**：既存repositoryを再利用。read-only dependency inventoryから始め、欠損/重複/未知版/外部参照を検査。音声binary、音声版、Take、書出し依存の保存契約をレビュー可能にする。保存policy未確定部分はwriteしない。host menu/bridge依存の静的棚卸しとStandalone配布test。Cloud Sync方式を選ぶまで同期しない。
3. **音楽整合と共通安全再生成（#1/#3/#6–10）**：全曲TransposeのBass/Key/Chord整合を調査・read-only plan。既存Family preflight/atomic/locksを継承。Arrangement Destination書込policyとLyrics occurrence/rebindingを確定してから書込。Continuation・Arrangement・Lyricsを共通target/range契約に載せる。
4. **実用Local AIと中核アシスタント（#4/#5/#7–10/#25–27）**：Intel/Apple Silicon別、処理別のModel/License/品質/メモリを公式情報で調査。Provider独立adapter、更新fixture、Cancel/失敗、作品保護、必要なら料金gate。その後初めて文章理解と実音楽生成を既存候補・Preview・Applyへ接続。Online採用を推測しない。今回の外部API禁止は継続。
5. **ボーカル録音と非破壊制作（#11–15）**：音声資産契約の後、PCM録音→Take/Comp→同期編集→仮歌/比較→Harmonyの順。本人声Modelは同意・License・技術選定後。波形リアルタイムや生楽器録音を加えない。
6. **Stem/Audio-to-MIDIの実用統合（#16/#17）**：今回の精度gateを維持して、設定/比較/信頼度/修正を完成。音声stem資産・Save/Reopen・一回Undo・Logic往復へ接続。精度がFAILなら生成拡張より原因修正を優先。
7. **Mix/Master/Logic/配信（#18–21）**：音声DSPと計測→複数版比較→WAV/Instrumental/Stem/MIDI一括Export→Logicから完成版再取込→受渡し/配信前検査。`.logicx`直接編集は独立の調査gate。
8. **制作完了運用（#24/#28–30、#22/#23仕上げ）**：診断・安全修復、作業別UI、素材の最小ライブラリ、完成版固定、Session/日次履歴、Backup/別Mac移行。各下位要件の実用往復を検証しA判定に進める。
9. **まとめた物理受入と単独版完成**：下記のまとまりで受入。未解決F・未実装D・実機FAILを残したまま30/30と言わない。Merge承認は別。

## 仕様判断・技術調査の保留リスト

- Arrangement Destination binding/write compatibility/音色・音符生成/保存policy。
- Continuationの配置/構成mapping、Section重なりの置換、Lyrics occurrence/rebinding/音節とaccent/版保存。
- 本当の全曲Transposeでcore Bass・Chord・Key metadataをどう扱うか。
- 音声binary/Take/音声Version/Checkpoint/素材/完成版の保存・依存契約。任意全巻戻しは対象外。
- Cloud Sync同期先/暗号化/conflict/offline。Online Provider/API/料金/作品利用条件。Local Model/License/処理別capacity。本人声Model/同意。
- Logic直接操作/.logicx公式方式。必要な公式調査はその工程で現在の日付付きで行う。今回未確認の互換性を推測しない。

## 物理実機受入をまとめる

- **Batch A：MIDI/精度/安全/保存**。Intel Mac Chrome＋Keystation：接続/再接続、Count-in/Metronome、変化Tempo/拍子録音、Piano Roll、保護範囲、Family Preview/Apply/Undo/Save/Reopen/JSON/Backup。合成WAVの実Helper→6 stems→6 named MIDI Track→Vocals 6音 `60,64,67,72,67,60`、開始0/.75/1.5/2.25/3/3.75秒。今回検査で元fixture/hashを照合。署名/配布は実機で別証拠。失敗の場合は元曲を触らず結果MIDと検査reportを比較。
- **Batch B：M1 iPad Safari**。日本語表示、幅・touch/Pencil/scroll、Cancel/Save/Reopen、Backup往復。Safari Web MIDIとnative bridgeを混同せず利用可能経路を確認。iPadだけでIntel pipelineを証明しない。
- **Batch C：音声制作完成後**。Mac/iPadでmicrophone permission、WAV/monitor/latency/Take/Comp、非破壊編集、仮歌/Harmony、Mix/Master、一括書出し、Logic Pro実往復、別Mac移行。

小PRごとの実機要求はしない。CIを先に積み上げ、上記依存がそろった時点で一回の統合手順にする。今回ティアの操作は要求しない。

## 今回の実装と次工程

最優先#17の **offline acceptance foundation** を追加。既存SMF parserを再利用し、fixture hash、音程/音数/開始秒、正の音長/終端/重なり、全6 stem identity、Type1/7 tracks、壊れたnote/EOT/tempo ambiguityを検査する。byte非変更。一般作品へ6音正解を押し付けず、指定公開synthetic WAV以外は拒否する。音楽policy、変換algorithm、曲保存を変更しない。`verify_real_conversion.py`の実モデル出力をこの検査へ接続。これ自体は精度改善の完了ではない。

次工程は第2段階の **read-only audio asset/dependency compatibility inventoryとStandalone依存調査**。既存スキーマを基に、外部参照/欠損/一時URL/未知版の報告から進める。音声録音・Mix・完成WAV・完全Backupを後付けで壊さないための共通前提。実機精度FAILの証拠が届いた場合は#17原因修正が優先。

## 第2段階：読み取り専用依存検査（2026-10-04 JST）

`music-studio-dependency-inspection.js` は現在のaudioAssets/midiAssets/fileReferencesのメタデータとderivedFromAssetIdだけを検査する。missing/duplicate/unknown/temporary/reselection/malformedと依存identityを報告。外部ファイルの実在・checksum・権限・互換性は確認しない。参照があるだけでresolvedにしない。保存・取得・自動実行・修復・migration経路は持たない。明示snapshot sessionはstaleを拒否しCancelで破棄する。画面やloadには接続していない。

Standalone CLIはHTMLの直接script/style配布依存と既存Python requirementsを静的検査する。Audio Helperのloopback、native MIDIのWKWebView/CoreMIDI、host navigationを分離。モデルweight、Python実install、推移依存、licenseと対象機器は未確認。CLIによるvalidは静的配布ファイルの検査であり単独版完成の証明ではない。

#22/#23/#25/#27の大機能判定は変更しない。Aは引き続き0/30。次工程：このinventoryに基づく音声binary/Take/Version/Checkpointと完全Backupの保存契約をレビュー可能な比較案へ整理。未確定policyのwrite実装は行わない。物理受入Batch A/B/C、Intel精度はpendingを維持。

## 第2段階：保存契約候補と読み取り専用report（2026-10-04 JST）

[保存契約候補](STORAGE_CONTRACT_ALTERNATIVES_V1.md)で現在のrepository/JSON/Backup/revision/履歴/Undo/audio pipelineの境界、将来の依存closure、3つの保存案、未決定policyを分離した。`music-studio-storage-contract-inspection.js`は既存inventoryを再利用する明示呼出し専用のreportで、完全Backup/Standalone portabilityを証明しない。production loader/schema/保存経路は変更しない。#22/#23/#25/#27状態変更なし、A 0/30。次は第2段階の契約review・容量/権限/復旧境界の調査。物理Batch A/B/Cは維持。
