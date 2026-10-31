# Macなし開発・受入台帳 v1

確認日：2026-10-31 JST。基準：[PR #551](https://github.com/puitoybox-cloud/nova-studio/pull/551)、HEAD `e1ea5c4dcb1b39d5efcce93e13da8200557fc389`。

30機能の初版受入台帳。verifiedは記載した狭い自動受入だけ。openは未実装と証拠未照合を含む。全体実装量の割合ではない。追加要件発見時はIDを追記し分母変更を履歴化する。旧マスターのA完成等級とは別分類。

A：総数 **135**、証拠付き完了 **49**、残数 **86**、受入確認率 **36.30%**。B：30。C：18。

この数字は初版台帳の受入確認率であり、製品の実装量・30機能の最終完成率ではない。既存コードにあるが全受入を照合していない項目もopenに残す。C依存の実装作業はAから除外せずdependsOnで保持する。B/Cを完了に読み替えない。追加発見時は既存IDを変えず追記し、分母の変更理由を記録する。

優先順：①MS18-A04/MS23-A05〜A07の今回修正と回帰を維持、②MS15の仮歌/Take比較、MS13のVibrato、MS24の全体性能診断、③MS04/05/07/08/10/11のC依存契約と生成・日本語操作、④音声比較/計測/完成パッケージ、⑤全保存入口/移行。要件IDは下表の正本を参照。モデル選定が必要なAは、C解消までopenのまま。

更新手順：production入口と保存/失敗/取消/再開を確認→具体的受入testを実行→source hashと実行結果を証拠JSONに記録→要件ごとにverifiedへ変更→本CLIを実行。テスト数をそのまま機能数に換算しない。

| No. | A総数 | 完了 | 残数 | B | C |
|---|---:|---:|---:|---:|---:|
| 1 | 5 | 5 | 0 | 1 | 0 |
| 2 | 3 | 2 | 1 | 1 | 0 |
| 3 | 5 | 1 | 4 | 1 | 1 |
| 4 | 5 | 1 | 4 | 1 | 1 |
| 5 | 4 | 1 | 3 | 1 | 1 |
| 6 | 4 | 1 | 3 | 1 | 0 |
| 7 | 6 | 1 | 5 | 1 | 1 |
| 8 | 5 | 1 | 4 | 1 | 1 |
| 9 | 4 | 1 | 3 | 1 | 1 |
| 10 | 8 | 1 | 7 | 1 | 1 |
| 11 | 3 | 1 | 2 | 1 | 1 |
| 12 | 4 | 1 | 3 | 1 | 0 |
| 13 | 4 | 3 | 1 | 1 | 0 |
| 14 | 5 | 1 | 4 | 1 | 1 |
| 15 | 4 | 4 | 0 | 1 | 0 |
| 16 | 3 | 1 | 2 | 1 | 1 |
| 17 | 4 | 1 | 3 | 1 | 1 |
| 18 | 5 | 4 | 1 | 1 | 0 |
| 19 | 4 | 2 | 2 | 1 | 0 |
| 20 | 3 | 1 | 2 | 1 | 1 |
| 21 | 4 | 1 | 3 | 1 | 1 |
| 22 | 4 | 1 | 3 | 1 | 0 |
| 23 | 8 | 5 | 3 | 1 | 1 |
| 24 | 4 | 1 | 3 | 1 | 0 |
| 25 | 5 | 2 | 3 | 1 | 1 |
| 26 | 5 | 1 | 4 | 1 | 1 |
| 27 | 5 | 1 | 4 | 1 | 1 |
| 28 | 4 | 1 | 3 | 1 | 0 |
| 29 | 4 | 1 | 3 | 1 | 1 |
| 30 | 4 | 1 | 3 | 1 | 0 |

| ID | 分類 | 受入要件 | 状態 | 根拠/依存 |
|---|---|---|---|---|
| MS01-A01 | A | normalizes existing MIDI without dropping metadata or note extensions | verified | [tests/music-studio-editor.test.js](../../tests/music-studio-editor.test.js) — `normalizes existing MIDI without dropping metadata or note extensions` |
| MS01-A02 | A | 全旋律Trackとcore Bassを含む移調 | verified | [tests/music-studio-whole-song-transpose.test.js](../../tests/music-studio-whole-song-transpose.test.js) — `whole-song transpose changes all melodic tracks together and includes core bass and excludes drums`; [tests/music-studio-song-transpose-storage.test.js](../../tests/music-studio-song-transpose-storage.test.js) — `whole-song key chords bass save reopen backup and undo persist as one transaction` |
| MS01-A03 | A | 曲Key変更の同期 | verified | [tests/music-studio-whole-song-transpose.test.js](../../tests/music-studio-whole-song-transpose.test.js) — `whole-song transpose synchronizes project minor key, slash chords and MIDI modulation with exact undo`; [tests/music-studio-song-transpose-storage.test.js](../../tests/music-studio-song-transpose-storage.test.js) — `whole-song key chords bass save reopen backup and undo persist as one transaction` |
| MS01-A04 | A | コード進行移調の同期 | verified | [tests/music-studio-whole-song-transpose.test.js](../../tests/music-studio-whole-song-transpose.test.js) — `whole-song transpose synchronizes project minor key, slash chords and MIDI modulation with exact undo`; [tests/music-studio-song-transpose-storage.test.js](../../tests/music-studio-song-transpose-storage.test.js) — `whole-song save failure and concurrent harmony edits preserve source and pending transaction` |
| MS01-A05 | A | 移調時の範囲保護と一括Undo | verified | [tests/music-studio-whole-song-transpose.test.js](../../tests/music-studio-whole-song-transpose.test.js) — `whole-song transpose rejects fixed notes, core bass overflow, invalid chords and stale metadata without partial mutation`; [tests/music-studio-whole-song-transpose.test.js](../../tests/music-studio-whole-song-transpose.test.js) — `whole-song apply refuses modified candidate metadata and MIDI before creating history`; [tests/music-studio-song-transpose-storage.test.js](../../tests/music-studio-song-transpose-storage.test.js) — `whole-song coordinated measure locks reject transpose before metadata or notes change`; [tests/music-studio-song-transpose-storage.test.js](../../tests/music-studio-song-transpose-storage.test.js) — `whole-song key chords bass save reopen backup and undo persist as one transaction` |
| MS01-B01 | B | Piano Rollと全Trackの物理操作 | open | 未確認 |
| MS02-A01 | A | unsupported Web MIDI environment is reported without throwing | verified | [tests/music-studio-midi-input.test.js](../../tests/music-studio-midi-input.test.js) — `unsupported Web MIDI environment is reported without throwing` |
| MS02-A02 | A | 切断と再接続の自動状態遷移 | verified | [tests/music-studio-logic-pro.test.js](../../tests/music-studio-logic-pro.test.js) — `disconnect cancels pending audio unlock and reconnect permits recording`; [tests/music-studio-logic-pro.test.js](../../tests/music-studio-logic-pro.test.js) — `quota failure after disconnect retains exact Track notes for retry and reopen`; [tests/music-studio-logic-pro.test.js](../../tests/music-studio-logic-pro.test.js) — `superseded MIDI access and saved old state callback cannot replace current input` |
| MS02-A03 | A | テンポ拍子変化録音の再保存往復 | open | 未確認 |
| MS02-B01 | B | Keystation権限・再接続・入力遅延 | open | 未確認 |
| MS03-A01 | A | explicit key changes select key and scale family at their exact tick | verified | [tests/music-studio-structure-info.test.js](../../tests/music-studio-structure-info.test.js) — `explicit key changes select key and scale family at their exact tick` |
| MS03-A02 | A | 音声BPM解析 | open | MS03-C01 |
| MS03-A03 | A | 音声KeyとScale解析 | open | MS03-C01 |
| MS03-A04 | A | 音声拍子解析 | open | MS03-C01 |
| MS03-A05 | A | 音声セクション解析 | open | MS03-C01 |
| MS03-B01 | B | 解析結果の実曲受入 | open | 未確認 |
| MS03-C01 | C | 音声解析方式と品質閾値 | open | 未確認 |
| MS04-A01 | A | hosted editor never dispatches model requests; local host must be explicit | verified | [tests/music-studio-local-model.test.js](../../tests/music-studio-local-model.test.js) — `hosted editor never dispatches model requests; local host must be explicit` |
| MS04-A02 | A | 文章と歌詞からBPMとKeyを提案 | open | MS04-C01 |
| MS04-A03 | A | 文章と歌詞からコードとメロディを生成 | open | MS04-C01 |
| MS04-A04 | A | 構成と編成を生成 | open | MS04-C01 |
| MS04-A05 | A | 生成物をPreviewから新曲保存へ統合 | open | MS04-C01 |
| MS04-B01 | B | 新曲の音楽品質聴取 | open | 未確認 |
| MS04-C01 | C | 文章理解・作曲モデルとライセンス・品質基準 | open | 未確認 |
| MS05-A01 | A | workspace is optional serializable state and does not mutate the project | verified | [tests/music-studio-ai-workflow.test.js](../../tests/music-studio-ai-workflow.test.js) — `workspace is optional serializable state and does not mutate the project` |
| MS05-A02 | A | 複数依頼の計画と機能呼出し | open | MS05-C01 |
| MS05-A03 | A | 会話文脈を維持した次工程案内 | open | MS05-C01 |
| MS05-A04 | A | 完成経路までの日本語オーケストレーション | open | MS05-C01 |
| MS05-B01 | B | 実制作会話フローの利用受入 | open | 未確認 |
| MS05-C01 | C | 会話理解モデルと実行権限契約 | open | 未確認 |
| MS06-A01 | A | Lyrics Family metadata Plan narrows anchors and shares one adoption Undo without changing source lines | verified | [tests/music-studio-ai-family-apply.test.js](../../tests/music-studio-ai-family-apply.test.js) — `Lyrics Family metadata Plan narrows anchors and shares one adoption Undo without changing source lines` |
| MS06-A02 | A | 音声の特定変更Undoと競合拒否 | open | 未確認 |
| MS06-A03 | A | 歌詞の特定変更Undoと競合拒否 | open | 未確認 |
| MS06-A04 | A | 領域横断変更の永続再開 | open | 未確認 |
| MS06-B01 | B | Preview・採用・Undoの実操作 | open | 未確認 |
| MS07-A01 | A | full-song preview/listen/partial instrument adoption preserves source and other bars; single undo/redo exact | verified | [tests/music-studio-whole-song.test.js](../../tests/music-studio-whole-song.test.js) — `full-song preview/listen/partial instrument adoption preserves source and other bars; single undo/redo exact` |
| MS07-A02 | A | 続きと2番の実生成 | open | MS07-C01 |
| MS07-A03 | A | ラスサビとIntroの実生成 | open | MS07-C01 |
| MS07-A04 | A | InterludeとOutroの実生成 | open | MS07-C01 |
| MS07-A05 | A | 時間指定生成 | open | MS07-C01 |
| MS07-A06 | A | 部分再生成と固定範囲保護 | open | MS07-C01 |
| MS07-B01 | B | 各Sectionの音楽品質聴取 | open | 未確認 |
| MS07-C01 | C | 生成モデルとSection配置方針 | open | 未確認 |
| MS08-A01 | A | Arrangement exact changing-meter entry is an anchor and leaves source MIDI and workspace unchanged | verified | [tests/music-studio-ai-arrangement-entry.test.js](../../tests/music-studio-ai-arrangement-entry.test.js) — `Arrangement exact changing-meter entry is an anchor and leaves source MIDI and workspace unchanged` |
| MS08-A02 | A | 複数Sectionアレンジの実生成 | open | MS08-C01 |
| MS08-A03 | A | 単一Track再生成 | open | MS08-C01 |
| MS08-A04 | A | 複数Track再生成 | open | MS08-C01 |
| MS08-A05 | A | メロディ固定と範囲固定の保存往復 | open | MS08-C01 |
| MS08-B01 | B | 音色と演奏表現の聴取 | open | 未確認 |
| MS08-C01 | C | Destinationと音源生成モデルの契約 | open | 未確認 |
| MS09-A01 | A | MIDI harmonic analysis weights sounding durations, excludes drums, preserves source and exposes silence | verified | [tests/music-studio-ai-composition.test.js](../../tests/music-studio-ai-composition.test.js) — `MIDI harmonic analysis weights sounding durations, excludes drums, preserves source and exposes silence` |
| MS09-A02 | A | 実音声のコード解析 | open | MS09-C01 |
| MS09-A03 | A | コード追従補正 | open | MS09-C01 |
| MS09-A04 | A | 別Voicing候補生成と採用保存 | open | MS09-C01 |
| MS09-B01 | B | 解析と別案の音楽的妥当性聴取 | open | 未確認 |
| MS09-C01 | C | 実音声コード解析モデルと品質基準 | open | 未確認 |
| MS10-A01 | A | Explicit reading assigns exact chronological note IDs, melisma and real timing without MIDI mutation | verified | [tests/music-studio-lyrics-note-assignment.test.js](../../tests/music-studio-lyrics-note-assignment.test.js) — `Explicit reading assigns exact chronological note IDs, melisma and real timing without MIDI mutation` |
| MS10-A02 | A | 歌詞本文生成 | open | MS10-C01 |
| MS10-A03 | A | 歌詞本文修正 | open | MS10-C01 |
| MS10-A04 | A | 読みとアクセント整合 | open | MS10-C01 |
| MS10-A05 | A | 文字数と音節割付 | open | MS10-C01 |
| MS10-A06 | A | 固定歌詞再生成 | open | MS10-C01 |
| MS10-A07 | A | 固定メロディ再生成 | open | MS10-C01 |
| MS10-A08 | A | 重複歌詞の再結合と競合履歴 | open | MS10-C01 |
| MS10-B01 | B | 日本語歌詞と旋律の歌唱受入 | open | 未確認 |
| MS10-C01 | C | 歌詞生成モデル・読みアクセント方式 | open | 未確認 |
| MS11-A01 | A | WAV preflight reports measured duration and silence without writing audio or project | verified | [tests/music-studio-score-vocal-return.test.js](../../tests/music-studio-score-vocal-return.test.js) — `WAV preflight reports measured duration and silence without writing audio or project` |
| MS11-A02 | A | 試聴中の日本語部分修正 | open | MS11-C01 |
| MS11-A03 | A | メロディ歌詞変更後の仮歌再生成と非破壊保存 | open | MS11-C01 |
| MS11-B01 | B | 日本語仮歌の聴感品質 | open | 未確認 |
| MS11-C01 | C | 歌唱モデルの配布ライセンスと品質基準 | open | 未確認 |
| MS12-A01 | A | selected take saves, reopens, edits, exports and full archive remaps identity without changing source bytes | verified | [tests/music-studio-vocal-recording.test.js](../../tests/music-studio-vocal-recording.test.js) — `selected take saves, reopens, edits, exports and full archive remaps identity without changing source bytes` |
| MS12-A02 | A | 長時間録音中断からの全保存経路の復旧検証 | open | 未確認 |
| MS12-A03 | A | PunchとCycleの保存再開 | open | 未確認 |
| MS12-A04 | A | 歌詞スクロール同期 | open | 未確認 |
| MS12-B01 | B | マイク権限・monitor・latency・長時間録音 | open | 未確認 |
| MS13-A01 | A | peak normalization previews measured PCM, adopts only on request and survives history/archive | verified | [tests/music-studio-vocal-correction-comp.test.js](../../tests/music-studio-vocal-correction-comp.test.js) — `peak normalization previews measured PCM, adopts only on request and survives history/archive` |
| MS13-A02 | A | Vibrato補正とUndo | verified | [tests/music-studio-vocal-recording.test.js](../../tests/music-studio-vocal-recording.test.js) — `Vibrato preview applies local pitch attenuation with exact Undo, reopen and full archive recovery` |
| MS13-A03 | A | Crossfade補正とUndo | verified | [tests/music-studio-vocal-correction-comp.test.js](../../tests/music-studio-vocal-correction-comp.test.js) — `Comp blends real opposite-polarity samples, persists recipe Undo/Redo, saves editable WAV and fully restores`; [tests/music-studio-vocal-correction-comp.test.js](../../tests/music-studio-vocal-correction-comp.test.js) — `stereo Comp linear crossfade limits seam steps and retains both channels`; [tests/music-studio-vocal-correction-comp.test.js](../../tests/music-studio-vocal-correction-comp.test.js) — `Comp quota failures and concurrent metadata reject without modifying old audio` |
| MS13-A04 | A | 波形歌詞音符同期の保存再開 | open | 未確認 |
| MS13-B01 | B | 各音声補正の聴感品質 | open | 未確認 |
| MS14-A01 | A | harmony produces actual diatonic pitches only in selected note range | verified | [tests/music-studio-harmony-mastering.test.js](../../tests/music-studio-harmony-mastering.test.js) — `harmony produces actual diatonic pitches only in selected note range` |
| MS14-A02 | A | 歌声Harmonyレンダーと保存 | open | MS14-C01 |
| MS14-A03 | A | Doubleレンダーと保存 | open | MS14-C01 |
| MS14-A04 | A | Chorusレンダーと保存 | open | MS14-C01 |
| MS14-A05 | A | 本人声生成の非破壊統合 | open | MS14-C01 |
| MS14-B01 | B | Harmony・Double・Chorusの聴感品質 | open | 未確認 |
| MS14-C01 | C | 本人声モデルと同意・ライセンス | open | 未確認 |
| MS15-A01 | A | actual PCM pitch analysis detects A4 and rejects silence and nonfinite audio | verified | [tests/music-studio-vocal-correction-comp.test.js](../../tests/music-studio-vocal-correction-comp.test.js) — `actual PCM pitch analysis detects A4 and rejects silence and nonfinite audio` |
| MS15-A02 | A | 仮歌とTakeの音程比較 | verified | [tests/music-studio-score-vocal-return.test.js](../../tests/music-studio-score-vocal-return.test.js) — `reference vocal and Take comparison measures actual pitch and voiced timing differences without changing sources` |
| MS15-A03 | A | 仮歌とTakeのTiming比較 | verified | [tests/music-studio-score-vocal-return.test.js](../../tests/music-studio-score-vocal-return.test.js) — `reference vocal and Take comparison measures actual pitch and voiced timing differences without changing sources` |
| MS15-A04 | A | 比較から録り直しと補正への操作接続 | verified | [tests/music-studio-score-vocal-return.test.js](../../tests/music-studio-score-vocal-return.test.js) — `comparison actions create MIDI correction previews and record a separate Take while preserving both originals` |
| MS15-B01 | B | 診断結果と録り直し判断の実制作受入 | open | 未確認 |
| MS16-A01 | A | audio pipeline bridge recognizes supported local audio and keeps MIDI separate | verified | [tests/music-studio-audio-pipeline.test.js](../../tests/music-studio-audio-pipeline.test.js) — `audio pipeline bridge recognizes supported local audio and keeps MIDI separate` |
| MS16-A02 | A | 6音声Stemの保存再開と移行の統合 | open | MS16-C01 |
| MS16-A03 | A | 実モデル分離の失敗取消と原音保持 | open | MS16-C01 |
| MS16-B01 | B | 実曲分離品質と配布版実行 | open | 未確認 |
| MS16-C01 | C | 分離モデルweightと再配布許諾 | open | 未確認 |
| MS17-A01 | A | repair only the selected track and measures; preserve input and locked notes | verified | [tests/music-studio-scoped-midi-repair.test.js](../../tests/music-studio-scoped-midi-repair.test.js) — `repair only the selected track and measures; preserve input and locked notes` |
| MS17-A02 | A | 単音和音設定の実モデル接続 | open | MS17-C01 |
| MS17-A03 | A | 信頼度と比較修正UIの統合 | open | MS17-C01 |
| MS17-A04 | A | 変換後の自動整理と保存再開 | open | MS17-C01 |
| MS17-B01 | B | Intel実Helperで6音精度と一般作品精度 | open | 未確認 |
| MS17-C01 | C | 変換モデルの対象楽器と精度基準 | open | 未確認 |
| MS18-A01 | A | actual stereo PCM Gain, peak and clipping matches independent expected samples and protects input | verified | [tests/music-studio-pcm-mix.test.js](../../tests/music-studio-pcm-mix.test.js) — `actual stereo PCM Gain, peak and clipping matches independent expected samples and protects input` |
| MS18-A02 | A | 全素材形式の曲全体Mix統合 | open | 未確認 |
| MS18-A03 | A | 複数Mix版の保存比較と再開 | verified | [tests/music-studio-long-wav-storage.test.js](../../tests/music-studio-long-wav-storage.test.js) — `two named Mix versions survive reopen and independently rerender exact audio`; [tests/music-studio-long-wav-storage.test.js](../../tests/music-studio-long-wav-storage.test.js) — `named Long Mix version rerenders exact saved settings after other edits and fresh reopen` |
| MS18-B01 | B | 実曲Mixの音質と全曲聴取 | open | 未確認 |
| MS19-A01 | A | 997 Hz reference loudness follows ITU expected -3.01 LKFS at full scale and -23.01 at 0.1 | verified | [tests/music-studio-harmony-mastering.test.js](../../tests/music-studio-harmony-mastering.test.js) — `997 Hz reference loudness follows ITU expected -3.01 LKFS at full scale and -23.01 at 0.1` |
| MS19-A02 | A | LUFS計測の規格参照fixture拡張 | open | 未確認 |
| MS19-A03 | A | true peakとclipping検査 | open | 未確認 |
| MS19-A04 | A | 複数Master版の保存再開 | verified | [tests/music-studio-long-wav-storage.test.js](../../tests/music-studio-long-wav-storage.test.js) — `two named Master versions survive reopen and independently rerender exact audio`; [tests/music-studio-long-wav-storage.test.js](../../tests/music-studio-long-wav-storage.test.js) — `named Long Master settings and original bytes survive complete Archive into fresh app then re-edit`; [tests/music-studio-long-wav-storage.test.js](../../tests/music-studio-long-wav-storage.test.js) — `long master compares distinct measured targets; explicit gain-only selection preserves EQ and saves chosen provenance` |
| MS19-B01 | B | 実曲Masterの音質と最終音量 | open | 未確認 |
| MS20-A01 | A | selected MIDI disconnect during count-in cancels scheduled recording without switching into a replacement input | verified | [tests/music-studio-logic-pro.test.js](../../tests/music-studio-logic-pro.test.js) — `selected MIDI disconnect during count-in cancels scheduled recording without switching into a replacement input` |
| MS20-A02 | A | 返送WAVとStemの対応差分管理 | open | MS20-C01 |
| MS20-A03 | A | 受渡し前検査の統合 | open | MS20-C01 |
| MS20-B01 | B | Logic Proの実往復 | open | 未確認 |
| MS20-C01 | C | Logic直接操作とlogicxの公式方式 | open | 未確認 |
| MS21-A01 | A | final routing renders offset stereo mix, aligned instrumental/vocal/individual stems and measured master | verified | [tests/music-studio-final-export.test.js](../../tests/music-studio-final-export.test.js) — `final routing renders offset stereo mix, aligned instrumental/vocal/individual stems and measured master` |
| MS21-A02 | A | MasterとInstrumentalとStemとMIDI一括出力の全経路 | open | MS21-C01 |
| MS21-A03 | A | 配信前の欠落と音量検査 | open | MS21-C01 |
| MS21-A04 | A | 配信前の権利申告漏れ検査 | open | MS21-C01 |
| MS21-B01 | B | 完成パッケージの実再生 | open | 未確認 |
| MS21-C01 | C | 音源と依存物の再配布条件 | open | 未確認 |
| MS22-A01 | A | explicit checkpoint → comparison → partial notes adoption → durable undo/redo; no source mutation | verified | [tests/music-song-checkpoints.test.js](../../tests/music-song-checkpoints.test.js) — `explicit checkpoint → comparison → partial notes adoption → durable undo/redo; no source mutation` |
| MS22-A02 | A | Checkpoint可聴A/Bの統合 | open | 未確認 |
| MS22-A03 | A | 依存範囲合成の全条件受入 | open | 未確認 |
| MS22-A04 | A | 全保存入口の強制終了再開検証 | open | 未確認 |
| MS22-B01 | B | 完全終了・再起動・再編集 | open | 未確認 |
| MS23-A01 | A | real import route stores >2M samples as Blob and a fresh repository reload verifies every byte | verified | [tests/music-studio-long-wav-storage.test.js](../../tests/music-studio-long-wav-storage.test.js) — `real import route stores >2M samples as Blob and a fresh repository reload verifies every byte` |
| MS23-A02 | A | 旧依存識別不能時の原本保持 | open | MS23-C01 |
| MS23-A03 | A | 更新前復元と移行のソフトウェア受入 | open | MS23-C01 |
| MS23-A04 | A | Cloud Syncの競合とoffline復旧実装 | open | MS23-C01 |
| MS23-B01 | B | 別Mac移行と電源断復旧 | open | 未確認 |
| MS23-C01 | C | Cloud Sync同期先・暗号化・競合・offline方針 | open | 未確認 |
| MS24-A01 | A | diagnosis exposes unavailable byte verification without claiming repair or writing project state | verified | [tests/music-production-tools.test.js](../../tests/music-production-tools.test.js) — `diagnosis exposes unavailable byte verification without claiming repair or writing project state` |
| MS24-A02 | A | 全体性能原因の診断 | open | 未確認 |
| MS24-A03 | A | 診断結果から安全軽量化 | open | 未確認 |
| MS24-A04 | A | 修復同意とtransaction再開 | open | 未確認 |
| MS24-B01 | B | 実機負荷と軽量化効果 | open | 未確認 |
| MS25-A01 | A | missing local runtime reports failure and retains notes/candidate workspace | verified | [tests/music-studio-local-model.test.js](../../tests/music-studio-local-model.test.js) — `missing local runtime reports failure and retains notes/candidate workspace` |
| MS25-A02 | A | Project単位の外部送信禁止境界 | open | MS25-C01 |
| MS25-A03 | A | 送信内容の明示と取消 | open | MS25-C01 |
| MS25-A04 | A | 全処理の配布依存閉包検証 | open | MS25-C01 |
| MS25-B01 | B | IntelとApple Siliconの署名配布と容量 | open | 未確認 |
| MS25-C01 | C | 対象モデルの容量・配布許諾・署名公証方式 | open | 未確認 |
| MS26-A01 | A | local cost tracking records failed retry, successful preview and cancellation separately without paid charges | verified | [tests/music-studio-ai-workflow.test.js](../../tests/music-studio-ai-workflow.test.js) — `local cost tracking records failed retry, successful preview and cancellation separately without paid charges` |
| MS26-A02 | A | 事前料金表示 | open | MS26-C01 |
| MS26-A03 | A | 月額上限と予約 | open | MS26-C01 |
| MS26-A04 | A | Provider別使用量 | open | MS26-C01 |
| MS26-A05 | A | 失敗とCancelの料金精算 | open | MS26-C01 |
| MS26-B01 | B | 採用Provider明細との精算一致 | open | 未確認 |
| MS26-C01 | C | 有料Provider・価格根拠・課金取消契約 | open | 未確認 |
| MS27-A01 | A | complete portable package to separate durable origin reload preserves logical state/settings/bytes | verified | [tests/music-studio-generation-package.test.js](../../tests/music-studio-generation-package.test.js) — `complete portable package to separate durable origin reload preserves logical state/settings/bytes` |
| MS27-A02 | A | Provider交換と互換拒否 | open | MS27-C01 |
| MS27-A03 | A | 旧モデル保持と切替 | open | MS27-C01 |
| MS27-A04 | A | 更新前fixture品質互換ゲート | open | MS27-C01 |
| MS27-A05 | A | モデルの速度容量報告 | open | MS27-C01 |
| MS27-B01 | B | 実モデル速度品質と互換受入 | open | 未確認 |
| MS27-C01 | C | Provider交換と旧モデルの互換方針 | open | 未確認 |
| MS28-A01 | A | mode and favorites save, reopen and full JSON restore without changing songs | verified | [tests/music-studio-workspace.test.js](../../tests/music-studio-workspace.test.js) — `mode and favorites save, reopen and full JSON restore without changing songs` |
| MS28-A02 | A | 全編集状態での作業別UI遷移 | open | 未確認 |
| MS28-A03 | A | 自然言語画面案内の統合 | open | 未確認 |
| MS28-A04 | A | キーボード操作とa11y自動検証 | open | 未確認 |
| MS28-B01 | B | 日本語glyph・touch・Pencil・a11y | open | 未確認 |
| MS29-A01 | A | MIDI material range survives backup migration, adjusts tempo/pitch in separate project and preserves source and drums | verified | [tests/music-production-tools.test.js](../../tests/music-production-tools.test.js) — `MIDI material range survives backup migration, adjusts tempo/pitch in separate project and preserves source and drums` |
| MS29-A02 | A | 曲と部分素材の全形式保存 | open | MS29-C01 |
| MS29-A03 | A | 素材KeyとBPM追従 | open | MS29-C01 |
| MS29-A04 | A | 意味を用いた文章検索 | open | MS29-C01 |
| MS29-B01 | B | 実素材を用いた作曲受入 | open | 未確認 |
| MS29-C01 | C | 文章意味検索モデルとライセンス | open | 未確認 |
| MS30-A01 | A | finished lifecycle: freeze MIDI/AI/export metadata, search, fork without overwriting, retain sessions through backup | verified | [tests/music-song-checkpoints.test.js](../../tests/music-song-checkpoints.test.js) — `finished lifecycle: freeze MIDI/AI/export metadata, search, fork without overwriting, retain sessions through backup` |
| MS30-A02 | A | 特殊保存入口の制作履歴網羅 | open | 未確認 |
| MS30-A03 | A | 完成版の全変更入口での固定 | open | 未確認 |
| MS30-A04 | A | Session日次時系列の移行受入 | open | 未確認 |
| MS30-B01 | B | 配布版の完成曲固定と移行受入 | open | 未確認 |
| MS18-A04 | A | 開始と再開の前に保存Stemのhash・長さ・identityを再照合 | verified | [tools/nova-au/tests/test_auto_finish_server.py](../../tools/nova-au/tests/test_auto_finish_server.py) — `test_changed_same_size_stem_refuses_start_and_resume_without_spawn` |
| MS23-A05 | A | 転送中断時に既存Stemとmanifestを保持しpartialを除去 | verified | [tools/nova-au/tests/test_auto_finish_server.py](../../tools/nova-au/tests/test_auto_finish_server.py) — `test_failed_reupload_keeps_previous_valid_bytes_and_manifest` |
| MS23-A06 | A | metadata原子置換失敗で以前のsessionを保持 | verified | [tools/nova-au/tests/test_auto_finish_server.py](../../tools/nova-au/tests/test_auto_finish_server.py) — `test_failed_metadata_replace_preserves_committed_session` |
| MS23-A07 | A | 不正形状のsessionを隔離し他の保存sessionを再発見 | verified | [tools/nova-au/tests/test_auto_finish_server.py](../../tools/nova-au/tests/test_auto_finish_server.py) — `test_discovery_isolates_nonobject_and_wrong_shape_records` |
| MS25-A05 | A | 空Project・版identityを永続作成前に拒否 | verified | [tools/nova-au/tests/test_auto_finish_server.py](../../tools/nova-au/tests/test_auto_finish_server.py) — `test_empty_project_identity_is_rejected_before_writing` |
| MS18-A05 | A | 旧実行の完了通知で新しい実行状態を上書きしない | verified | [tools/nova-au/tests/test_auto_finish_server.py](../../tools/nova-au/tests/test_auto_finish_server.py) — `test_old_waiter_cannot_complete_a_new_execution` |
| MS23-A08 | A | 開始状態の保存失敗時に起動済み子processを終了回収 | verified | [tools/nova-au/tests/test_auto_finish_server.py](../../tools/nova-au/tests/test_auto_finish_server.py) — `test_metadata_failure_after_launch_reaps_process_and_closes_log` |

## 未完了項目の分類（PR #550開始時点98件）

| 分類 | 開始時点 | 現在の未完了 |
|---|---:|---:|
| 実装が必要 | 11 | 3 |
| 実装済み・検証不足 | 24 | 20 |
| 仕様判断待ち | 63 | 63 |

仕様判断待ちはC依存の全受入を指す。共通の非破壊保存・中断処理は改善可能。関連実装の存在を要件全体の受入成功とは扱わない。

| ID | 分類 | 現在の状態 |
|---|---|---|
| MS01-A02 | 実装が必要 | verified |
| MS01-A03 | 実装が必要 | verified |
| MS01-A04 | 実装が必要 | verified |
| MS01-A05 | 実装が必要 | verified |
| MS02-A02 | 実装済み・検証不足 | verified |
| MS02-A03 | 実装済み・検証不足 | open |
| MS03-A02 | 仕様判断待ち | open |
| MS03-A03 | 仕様判断待ち | open |
| MS03-A04 | 仕様判断待ち | open |
| MS03-A05 | 仕様判断待ち | open |
| MS04-A02 | 仕様判断待ち | open |
| MS04-A03 | 仕様判断待ち | open |
| MS04-A04 | 仕様判断待ち | open |
| MS04-A05 | 仕様判断待ち | open |
| MS05-A02 | 仕様判断待ち | open |
| MS05-A03 | 仕様判断待ち | open |
| MS05-A04 | 仕様判断待ち | open |
| MS06-A02 | 実装済み・検証不足 | open |
| MS06-A03 | 実装済み・検証不足 | open |
| MS06-A04 | 実装済み・検証不足 | open |
| MS07-A02 | 仕様判断待ち | open |
| MS07-A03 | 仕様判断待ち | open |
| MS07-A04 | 仕様判断待ち | open |
| MS07-A05 | 仕様判断待ち | open |
| MS07-A06 | 仕様判断待ち | open |
| MS08-A02 | 仕様判断待ち | open |
| MS08-A03 | 仕様判断待ち | open |
| MS08-A04 | 仕様判断待ち | open |
| MS08-A05 | 仕様判断待ち | open |
| MS09-A02 | 仕様判断待ち | open |
| MS09-A03 | 仕様判断待ち | open |
| MS09-A04 | 仕様判断待ち | open |
| MS10-A02 | 仕様判断待ち | open |
| MS10-A03 | 仕様判断待ち | open |
| MS10-A04 | 仕様判断待ち | open |
| MS10-A05 | 仕様判断待ち | open |
| MS10-A06 | 仕様判断待ち | open |
| MS10-A07 | 仕様判断待ち | open |
| MS10-A08 | 仕様判断待ち | open |
| MS11-A02 | 仕様判断待ち | open |
| MS11-A03 | 仕様判断待ち | open |
| MS12-A02 | 実装済み・検証不足 | open |
| MS12-A03 | 実装済み・検証不足 | open |
| MS12-A04 | 実装済み・検証不足 | open |
| MS13-A02 | 実装が必要 | verified |
| MS13-A03 | 実装済み・検証不足 | verified |
| MS13-A04 | 実装済み・検証不足 | open |
| MS14-A02 | 仕様判断待ち | open |
| MS14-A03 | 仕様判断待ち | open |
| MS14-A04 | 仕様判断待ち | open |
| MS14-A05 | 仕様判断待ち | open |
| MS15-A02 | 実装が必要 | verified |
| MS15-A03 | 実装が必要 | verified |
| MS15-A04 | 実装が必要 | verified |
| MS16-A02 | 仕様判断待ち | open |
| MS16-A03 | 仕様判断待ち | open |
| MS17-A02 | 仕様判断待ち | open |
| MS17-A03 | 仕様判断待ち | open |
| MS17-A04 | 仕様判断待ち | open |
| MS18-A02 | 実装済み・検証不足 | open |
| MS18-A03 | 実装済み・検証不足 | verified |
| MS19-A02 | 実装済み・検証不足 | open |
| MS19-A03 | 実装済み・検証不足 | open |
| MS19-A04 | 実装済み・検証不足 | verified |
| MS20-A02 | 仕様判断待ち | open |
| MS20-A03 | 仕様判断待ち | open |
| MS21-A02 | 仕様判断待ち | open |
| MS21-A03 | 仕様判断待ち | open |
| MS21-A04 | 仕様判断待ち | open |
| MS22-A02 | 実装済み・検証不足 | open |
| MS22-A03 | 実装済み・検証不足 | open |
| MS22-A04 | 実装済み・検証不足 | open |
| MS23-A02 | 仕様判断待ち | open |
| MS23-A03 | 仕様判断待ち | open |
| MS23-A04 | 仕様判断待ち | open |
| MS24-A02 | 実装が必要 | open |
| MS24-A03 | 実装が必要 | open |
| MS24-A04 | 実装済み・検証不足 | open |
| MS25-A02 | 仕様判断待ち | open |
| MS25-A03 | 仕様判断待ち | open |
| MS25-A04 | 仕様判断待ち | open |
| MS26-A02 | 仕様判断待ち | open |
| MS26-A03 | 仕様判断待ち | open |
| MS26-A04 | 仕様判断待ち | open |
| MS26-A05 | 仕様判断待ち | open |
| MS27-A02 | 仕様判断待ち | open |
| MS27-A03 | 仕様判断待ち | open |
| MS27-A04 | 仕様判断待ち | open |
| MS27-A05 | 仕様判断待ち | open |
| MS28-A02 | 実装済み・検証不足 | open |
| MS28-A03 | 実装が必要 | open |
| MS28-A04 | 実装済み・検証不足 | open |
| MS29-A02 | 仕様判断待ち | open |
| MS29-A03 | 仕様判断待ち | open |
| MS29-A04 | 仕様判断待ち | open |
| MS30-A02 | 実装済み・検証不足 | open |
| MS30-A03 | 実装済み・検証不足 | open |
| MS30-A04 | 実装済み・検証不足 | open |
