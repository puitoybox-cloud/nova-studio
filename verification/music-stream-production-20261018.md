# MIDI audio, PCM capture and mastering production continuation

2026-10-18 JST. Parent #453 b55fd71d3c8dca3845448c82ce6f288e886e4a30, 11/11 exact-head checks succeeded at start. main 552d56eafddfd192970c09f7d6278696cf8775c3 unchanged. All 200 open /198 draft PRs: HEAD/base/mergeability, all filename pages, latest commit metadata and all exact-head checks retrieved. No newer initial checkpoint. Snapshot files accompany this report.

## Production changes

- Saved MIDI now uses a streaming renderer capped at 480 seconds /20,000 notes. Thirty-second windows reconstruct crossing notes from their original attack, including tempo changes and one-shot/sample release tails. Global sample grid and 128-frame render-quantum alignment preserve waveform phase; seeded drum noise avoids random boundary replacement. Microsecond tempo events normalized for both rendering APIs. Meter changes retain tick-defined playback time.
- Each context is bounded to 150 seconds plus 128 frames (about 57.6 MB stereo Float32 output). This is not total application-memory measurement: sample banks, browser engine/node overhead, encoded WAV pieces and the final Blob still consume memory. An individual note including its audible tail cannot exceed120 seconds, and tail after the song cannot exceed10 seconds. Oversize sustains fail before rendering. Silence windows are emitted without audio contexts. Old renderMidi compatibility API remains120 seconds; production calls renderMidiStream.
- PCM goes directly into the existing chunk encoder/atomic durable storage. No full-song Float32 buffer. Progress per completed window, event-loop yields, cancel/stale checks before/after windows and during hashing; quota estimate before rendering, transactional quota/conflict rejection during save. Cancellation suppresses publication; the currently running OfflineAudioContext finishes before the guard can interrupt.
- Native Worklet PCM is inspected in bounded chunks and retained byte-for-byte at Stop. Whole-take decodeAudioData and re-encoding are removed from this path. Gapless takes slice canonical PCM on exact frame boundaries and regenerate only headers. Last partial take, waveform bins, manual latency metadata, original audio, save/reopen and complete archive are preserved. MediaRecorder fallback still uses the existing decode path. Vocal recording remains120 seconds; no claim of long recording completion.
- Final Mix/Master/Instrumental/Stem package now reports real processing stages: source preparation, mix measurement, mix render, master render/validation, stem render and packaging. Existing cancel/source-conflict/atomic saves remain.

## Verified locally

- Node 2399/2399, failure/skip0 at the verified code iteration; final head results are reported in PR. Python509 run /504pass /5 existing skips. Generation constraints6, transport3, startup4 pass. Tracked JS syntax and Python compile, git diff --check run. Swift/Xcode/ONNX/Sinsy assets absent locally; exact final-head CI is required, never substituted with parent success.
- Real packaged Chromium: eight production screens at1440/1180/820/390, console error/warn/pageerror0, external network0. At1180x820 all eight document heights820, no horizontal overflow. Other widths may scroll vertically; this is not every data/dialog state certification.
- Actual Web Audio comparison: ~79 seconds, changing tempo/meter, overlapping melody/bass/drums/project sample and notes across30s/60s boundaries; streamed PCM vs one full render maximum difference <=1.5e-8, boundary <=1.9e-9 in recorded run. Cancellation after a completed window exercised.
- Actual480-second sparse MIDI stream:23,078,400frames including0.8s tail,17 progress windows, contexts only for audible windows; fixture's maximum context1,440,000frames /11,520,000bytes. This sparse fixture does not measure worst-case polyphony/device memory.
- Actual130-second MIDI→25,113,648byte WAV→Mix/Master/Instrumental/MIDI package→fresh repository reopen→full archive restore; MIDI unchanged and WAV SHA-25691564432a9fd520e0a2e9c432860b4767c3dbcc8fc1a4f746103cda45111a7ac identical. The full480-second package was not tested.
- Real worklet with an explicitly generated220Hz MediaStream at all four widths: record, pause/resume, input meter, monitor toggle, Stop/save, reopen, trim/Undo/Redo, audition, selected Breath Gain, Mix publication and complete archive equality. Physical microphone=false. Packaged Chromium's OS fake-microphone path reports Not supported; generated MediaStream is an explicit test option, not a hidden fallback or physical acceptance. Normal CI continues to use Chrome's fake device.

## Remaining

Not20–30 independent completed items; three related production groups changed. Thirty full major features are not completed. No B promotion without full UI/backend/runtime/storage/restore/policy closure. Long vocal recording/advanced corrections, conversational AI/full arrangement quality, complete HTTPS reconnect/edit continuity, distribution/runtime/license closure and physical Mac/iPad acceptance remain. Existing licensed assets only; no new model/sound licensing assertion. No Live Provider API, main change, force push, Ready or Merge.

## Thirty individual decisions and later physical procedures

All C; original specification read today. Procedures below are future acceptance work, and must not be read as currently working completion claims. Features with open software requirements must close them first.

| No. | Feature | Status | Unclosed requirement or evidence | Later physical procedure |
|---|---|---|---|---|
| 1 | MIDI・Track編集 | C | 全対象Track・Partial Edit・Correction/Cleanupの単独製品受入対応表が閉じていない。 | 複数Trackの音符/Velocity/Quantize/範囲編集を行い、Undo/Redo→保存→再Open。 |
| 2 | MIDI録音 | C | 単独起動→入力権限→Stop保存→再起動までの配布runtime受入が閉じていない。 | Keystation接続→Count-in録音→Stop→保存→終了→再起動→再Open→編集。 |
| 3 | 曲構造・音楽情報 | C | 実音声BPM/Key/Scale/セクション解析の全要件・品質が未認定。 | Tempo/Key/拍子変更を入れ、小節位置と保存/再Openの整合を確認。 |
| 4 | AI新曲スタート | C | 実ONNX経路は存在。文章/歌詞から構成・楽器編成まで含む実用候補の全要件適合が未認定。 | 文章/歌詞・曲調指定から候補を生成し、採用後の編成/音楽品質を確認。 |
| 5 | Music Studio AI制作アシスタント | C | 自然言語から複数作業を計画し、必要な機能を実行する中核AIの全要件が未完了。 | 制作相談と複数依頼を自然言語で行い、対象と実行結果を照合。 |
| 6 | AI安全編集・変更管理 | C | 領域横断の特定変更Undo・競合解決の全要件受入が閉じていない。 | 保護範囲を設定→候補比較→部分採用→特定変更Undo→保存/復元。 |
| 7 | AI作曲・曲展開 | C | 全セクション展開・指定時間版・選択再生成の品質と全要件適合が未認定。 | 続き/2番/Intro/Outro/指定時間を生成し、対象外音符保持を照合。 |
| 8 | AIアレンジ支援 | C | 単一/複数楽器再生成と固定範囲保持を含む実アレンジの全要件が未認定。 | メロディ固定で単一/複数楽器だけ再生成し、対象外Track保持を確認。 |
| 9 | AIコード支援 | C | 実音声コード解析とVoicing・追従補正の全要件品質が未認定。 | コード解析→別案/Voicing→採用→メロディ追従を確認。 |
| 10 | AI歌詞・メロディ制作 | C | 歌詞生成/アクセント・歌詞固定/メロディ固定再生成の全要件が未完了。 | 日本語歌詞/読みを割り付け、アクセントと歌詞固定再生成を確認。 |
| 11 | AI仮歌・対話修正 | C | 実Sinsy接続・小節別テイクは実装済み。聴きながら自然言語で部分修正する対話経路は未完了。 | 仮歌を生成/試聴→小節別再生成→比較採用→保存/復元。 |
| 12 | ボーカル録音 | C | PCM Worklet/Punch/Cycle/手動遅延補正は存在。今回PCM保存メモリを改善。120秒超録音と単独製品runtimeの受入は未完了。自動遅延実測を必須要件として勝手に追加しない。 | 許可→録音/Pause/Resume→Stop保存→Cycle複数テイク→遅延補正→再Open。 |
| 13 | ボーカル編集 | C | 非破壊編集・部分置換は存在。Vibrato等を含む全ボーカル補正の品質受入が未認定。 | 波形範囲のCut/Move/Join/Gain→Undo/Redo→Mix保存→再Open。 |
| 14 | ボーカル生成・Harmony | C | 実歌声Harmony/Double/Chorus・本人同意済み声のモデル/権利確認の全要件が未完了。 | 同意/権利確認済み声だけでHarmony/Double/Chorusを生成・比較。 |
| 15 | ボーカル完成チェック | C | 仮歌対比・録り直し/補正判断まで含む完成チェックの全要件受入が未完了。 | 仮歌/テイク比較・音程/Timing/音域を確認し、補正/録り直し判断。 |
| 16 | Stem Separation | C | 実分離モデル・依存runtime・配布接続と一般作品品質受入の全要件が未認定。 | 許諾済みテスト音声を分離し各Stemと再合成品質を試聴。 |
| 17 | Audio-to-MIDI | C | 実変換の配布runtime接続・信頼度/比較修正・一般作品精度受入の全要件が未認定。 | 許諾済み単音/和音音声を変換し、誤検出/信頼度/修正/保存を確認。 |
| 18 | AIミックス支援 | C | Gain/EQ/Compression/分析・候補は存在。曲全体の複数Mix版管理と品質の全要件受入が閉じていない。 | MIDI音声化とVocalをSourcesへ明示選択しGain/EQ/Comp→候補比較/部分採用。 |
| 19 | AIマスタリング | C | 実LUFS/Peak測定・複数候補・長時間処理は存在。測定の規格適合と全曲品質受入は未認定。 | 短/長MasterをBefore/After比較しLUFS/Peak/Clippingと保存を確認。 |
| 20 | Logic Pro往復連携 | C | Logic往復の対応/差分管理と単独アプリ受渡し全要件が未認定。 | WAV/Stem/MIDIをLogicへ渡し、仕上げを再取込して対応/差分を確認。 |
| 21 | 最終書出し・配信パッケージ | C | 簡易音源/指定サンプルによる8分MIDI音声化と実一括出力を追加。全音源/配信前チェック・配布権利の全要件は未認定。 | 130秒超・8分以内の曲を音声化→Master/Instrumental/MIDIを一括Export。 |
| 22 | 保存・曲バージョン管理 | C | 保存/複製/候補は存在。名前付きCheckpointと複数Version部分合成の全要件が未完了。 | 編集→保存→終了→再Open→再編集→再保存、候補版/部分合成を照合。 |
| 23 | バックアップ・復旧・移行 | C | 完全WAV Archiveは実装済み。全旧依存ファイル移行の受入と採用済みCloud Syncの暗号化/競合/Offline設計実装が未完了。 | Full WAV Archiveを別保存先へ復元しMIDI/音声hash・旧データを照合。 |
| 24 | Music Studio診断・安全修復 | C | 全製品の性能診断→安全修復の全要件が未完了。 | 重い/欠損/不正状態の診断→修復候補を確認し元曲保持を照合。 |
| 25 | AI実行環境・作品保護 | C | 固定実生成資産の許諾は存在。Intel/Apple Siliconの配布runtime閉包・署名公証等の全要件が未完了。 | 完全LocalとProject外部送信禁止で処理し、外部通信がないことを確認。 |
| 26 | AI料金管理 | C | 承認済み有料Provider条件を基にする料金予約/上限/使用量のproduction閉包が未完了。今回Live Provider APIを呼ばない。 | 承認済み料金条件で見積/上限/取消/使用量台帳を確認（現状実施不可）。 |
| 27 | AIモデル管理・互換性 | C | 固定ONNX/Sinsyは存在。モデル交換/旧モデル/更新前品質テストを含む全要件が未完了。 | モデル更新前後で旧成果を開き、交換/互換テスト結果を確認。 |
| 28 | スマートUI | C | 8制作画面と1180x820は検証。全編集状態・設定/ダイアログ・自然言語画面呼出しの全要件が未認定。 | iPad横1180x820で8画面、長い候補/履歴/ダイアログと未保存切替を確認。 |
| 29 | 素材・テンプレートライブラリ | C | 再利用素材保存・曲に合わせたKey/BPM調整・文章検索の全要件が未完了。 | 素材保存→文章検索→別曲でKey/BPM追従を確認。 |
| 30 | 完成版・制作履歴管理 | C | 書出し履歴は存在。完成版固定/検索・制作Session/日次時系列の全要件が未完了。 | 完成版固定→検索→Session/日次履歴→再Openを確認。 |
