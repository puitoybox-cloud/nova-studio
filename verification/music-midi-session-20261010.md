# MIDI recording session cancellation and 30-feature review — 2026-10-10 JST

Source: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, current Library text re-read all 5 pages/166 lines on 2026-10-10. No.2 lists exactly MIDI鍵盤録音、Count-in、Metronome、録音・再生・保存; no additional detailed subclauses exist in the PDF. Standalone application and work protection requirements also apply.

Checkpoint: #368 Draft/Open/mergeable HEAD 1587ed74025970282810f43f50295931dd7e0f79; exact-head run38026204939 success re-read. main552d56eafddfd192970c09f7d6278696cf8775c3. All115 open PRs (113 Draft) HEAD/base re-read;all115 detail responses retrieved (one transient failure retried successfully); historical#35/#10 conflicts. Clone freshly fetched all branches/commit trees. Exhaustive historical per-head jobs/logs and API commit/file pagination UNVERIFIED; no historical CI pass inferred.

## Production fixes
- Cancel pending audio/MIDI permission waits via monotonic recording request token; check exact Editor session and selected input after each await.
- Stop/direct Stop/route navigation/project switch/unload/disconnect invalidate pending starts. Old finally cannot clear a later start.
- Input callbacks capture binding generation and exact input identity; old callback delivery does not monitor or record into a new session.
- Animation callbacks capture recorder, start token and Editor session. Count-in cancellation also invalidates its pending start continuation.
- Concurrent MIDI access scans reject superseded responses; saved callbacks from replaced access cannot refresh the current input.
- Catch start errors with a recoverable transport result. Existing dirty save retry preserves recorded notes on quota failure.
- Both standalone/host cache keys bump to1.4.130; schema/app version preserved.

## No.2 complete source subrequirement checklist
|PDF subrequirement|Repository evidence|Remaining|
|---|---|---|
|MIDI鍵盤録音|music-studio-midi-input.js recorder; exact Track routing and duplicate gate; added stale callback/reconnect tests|real-browser delivery/native standalone route evidence; hardware|
|Count-in|existing beat scheduling/countInToken, #368 disconnect cancellation; new startToken invalidation|real browser/native transport; audibility|
|Metronome|existing playback timing service/tempo map/metronome closure tests retained|real browser/native whole-path proof; audible timing|
|録音|new deferred audio/permission Stop/route/session regressions, pending disconnect, access supersession, stale RAF/input tests|real-browser lifecycle and native route proof|
|再生|existing recorded melody reload/correction, playback and timing tests retained|browser record/reopen/play/edit end-to-end; hardware audibility|
|保存|production Stop -> saveMidiEditor -> repository; added quota-on-disconnect dirty retry/reOpen with exact Track/pitch/duration and stored original protection|actual IndexedDB browser quota/error and native restart durability|

Tempo, meter, count-in, position/held-note length, velocity/channel, Track identity, locked existing notes are covered by existing Logic/recording/tempo-map/dynamic-track tests, not newly certified on hardware. No synthetic suite replaces audibility or native MIDI acceptance.

## C residuals classified
- Implementation: no unresolved defect identified in the touched browser recording path; comprehensive native standalone binding completion cannot be confirmed. No claim that unknown requirements are implemented.
- Verification: three real-browser widths, console errors/warnings/external-request evidence, complete standalone browser/native record -> Stop -> save -> reopen -> playback/edit and fault matrix are UNVERIFIED.
- External dependencies: browser executable, Swift/Xcode unavailable locally; no AI model required for browser MIDI. Native CI uses existing macOS tooling. No download/install/signing/notarization performed.
- Physical: Mac Chrome/Keystation permission/audio unlock, Count-in/metronome audibility, tempo/meter timing, disconnect/reconnect, Stop/save/reopen/edit, native permissions/restart.

## All30 classifications
A=physical acceptance complete; B=production/backend/policy/automated verification complete and hardware only pending; C=non-hardware residual. All unchanged features retain latest source matrix evidence; no new exhaustive verification claimed.

|No.|正式大機能|区分|C理由の分類|根拠と実機以外の残件|次の作業|
|---:|---|---|---|---|---|
|1|MIDI・Track編集|C|実装不足／自動テスト不足／実機確認待ち|editor/selected Track/partial edit/cleanup実装、全仕様完了は未確認。単独起動の機能別証明は未完。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|2|MIDI録音|C|検証不足／実機確認待ち|今回の開始要求token・入力token・recorder/session捕捉で遅延開始、古いイベント/RAF、Count-in取消、access supersessionを防止。容量不足後の保持・再保存・再Openをproduction API回帰で確認。|実ブラウザ3幅、Console/外部通信、native単独録音経路の全下位要件証明|
|3|曲構造・音楽情報|C|実装不足／backend不足／自動テスト不足／実機確認待ち|meter-map/structure-info/transpose実装、解析全要件未確認。単独起動の機能別証明は未完。|全解析とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|4|AI新曲スタート|C|backend不足／依存資産不足／実機確認待ち|AI workflow/composition候補、文章・歌詞生成backend全要件未確認。単独起動の機能別証明は未完。|backend/model/P/Q/D未完の解消、共通production/policy不足解消後に実機|
|5|Music Studio AI制作アシスタント|C|backend不足／画面未接続／実機確認待ち|local panel/workflow、安全adapterあり、自然会話・複数作業完成支援未確認。単独起動の機能別証明は未完。|対話backendとP/Q/D未完の解消、共通production/policy不足解消後に実機|
|6|AI安全編集・変更管理|C|実装不足／自動テスト不足／実機確認待ち|candidate/family apply/locks/Undo実装、特定変更Undo全要件未確認。単独起動の機能別証明は未完。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|7|AI作曲・曲展開|C|backend不足／依存資産不足／実機確認待ち|continuation/section候補参照、実生成全要件未確認。単独起動の機能別証明は未完。|生成backendとP/Q/D未完の解消、共通production/policy不足解消後に実機|
|8|AIアレンジ支援|C|実装不足／画面未接続／backend不足／実機確認待ち|arrangement destinationはidentity参照、生成・Apply未達（verification note）。単独起動の機能別証明は未完。|参照から実生成への接続未完の解消、共通production/policy不足解消後に実機|
|9|AIコード支援|C|実装不足／backend不足／実機確認待ち|chord候補あり、音声解析/Voicing/追従補正全要件未確認。単独起動の機能別証明は未完。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|10|AI歌詞・メロディ制作|C|backend不足／依存資産不足／自動テスト不足／実機確認待ち|lyricsAssignmentPreview/adoptLyricsAssignment・tests/music-studio-lyrics-note-assignment.test.js：音符割当あり。言語/生成backend・アクセント・固定再生成全要件証明未完。単独起動の機能別証明は未完。|参照以外の全フロー未確認の解消、共通production/policy不足解消後に実機|
|11|AI仮歌・対話修正|C|実装不足／backend不足／依存資産不足／実機確認待ち|音声仮歌生成・再生中対話修正の完成実装は確認できません。単独起動の機能別証明は未完。|software/backend/assets未確認の解消、共通production/policy不足解消後に実機|
|12|ボーカル録音|C|実装不足／backend不足／画面未接続／実機確認待ち|WAV/Punch/Cycle/Take/Comp/Latency統合完成は確認できません。単独起動の機能別証明は未完。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|13|ボーカル編集|C|実装不足／backend不足／画面未接続／実機確認待ち|非破壊波形/歌詞/音符同期・Pitch/Timing完成は確認できません。単独起動の機能別証明は未完。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|14|ボーカル生成・Harmony|C|実装不足／backend不足／依存資産不足／policy不足／実機確認待ち|生成・本人声・Harmony完成は確認できません。単独起動の機能別証明は未完。|software/model/policy未完の解消、共通production/policy不足解消後に実機|
|15|ボーカル完成チェック|C|実装不足／backend不足／実機確認待ち|Take/仮歌比較・補正判断支援完成は確認できません。単独起動の機能別証明は未完。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|16|Stem Separation|C|依存資産不足／policy不足／自動テスト不足／実機確認待ち|server/Demucs child pipelineあり、approved runtimeなし。単独起動の機能別証明は未完。|actual assets/policy/実model未完の解消、共通production/policy不足解消後に実機|
|17|Audio-to-MIDI|C|依存資産不足／policy不足／自動テスト不足／実機確認待ち|pipeline/repair/comparisonあり、今回realモデル精度未検証。単独起動の機能別証明は未完。|actual assets/Intel精度未完の解消、共通production/policy不足解消後に実機|
|18|AIミックス支援|C|実装不足／自動テスト不足／実機確認待ち|music-studio.js: 実PCM Gain/EQ/Compression/提案/A-B/保存あり。本PRで同期区間を候補へ接続し、短PCM空間処理・保存・履歴・再Open・WAV出力を追加。ボーカル可聴性の完成証明、複数伴奏分析・ブラウザ検証は未完。単独起動の機能別証明は未完。|複数伴奏/可聴性・空間全仕様・ブラウザ検証、共通production/policy不足解消後に実機|
|19|AIマスタリング|C|実装不足／backend不足／画面未接続／実機確認待ち|music-studio.js mastering status=planned、masteringNotesはLUFS処理ではない。単独起動の機能別証明は未完。|planned・処理backend未完の解消、共通production/policy不足解消後に実機|
|20|Logic Pro往復連携|C|実装不足／画面未接続／実機確認待ち|SMF import/exportあり、audio referenceはtab内確認のみ、.logicx直接未対応。単独起動の機能別証明は未完。|WAV/Stem往復・直接操作未達の解消、共通production/policy不足解消後に実機|
|21|最終書出し・配信パッケー|C|実装不足／backend不足／実機確認待ち|MIDI exportあり、Master/Instrumental/Stem一括完成は未確認。単独起動の機能別証明は未完。|一括audio export全要件未確認の解消、共通production/policy不足解消後に実機|
|22|保存・曲バージョン管理|C|実装不足／画面未接続／自動テスト不足／実機確認待ち|projects/storage/AI workspaceあり、全Version部分合成未確認。単独起動の機能別証明は未完。|全version仕様/binding未完の解消、共通production/policy不足解消後に実機|
|23|バックアップ・復旧・移行|C|実装不足／画面未接続／自動テスト不足／実機確認待ち|createLongWavArchive/restoreLongWavArchive・long-wav-storage tests：元WAVの完全archiveあり。外部参照binaryは拒否、自動binary backup未接続、production binding未完。単独起動の機能別証明は未完。|外部参照のbyte検証とadd-only復元・自動binary backup、共通production/policy不足解消後に実機|
|24|Music Studio診断・安全修復|C|実装不足／画面未接続／実機確認待ち|dependency/storage/byte inspectionあり、性能診断・自動修復全要件未確認。単独起動の機能別証明は未完。|診断/修復全仕様未確認の解消、共通production/policy不足解消後に実機|
|25|AI実行環境・作品保護|C|backend不足／policy不足／自動テスト不足／実機確認待ち|strict runtime/lifecycle/fail-closed実装、native isolation production未承認。単独起動の機能別証明は未完。|production binding/policy/実機未完の解消、共通production/policy不足解消後に実機|
|26|AI料金管理|C|backend不足／policy不足／画面未接続／実機確認待ち|実料金見積/月上限/使用量backend完成は確認できません。単独起動の機能別証明は未完。|software/provider policy未完の解消、共通production/policy不足解消後に実機|
|27|AIモデル管理・互換性|C|実装不足／依存資産不足／policy不足／実機確認待ち|capabilities/identity/closureあり、軽量切替・旧Model・品質管理全要件未確認。単独起動の機能別証明は未完。|actual model/切替全仕様未完の解消、共通production/policy不足解消後に実機|
|28|スマートUI|C|実装不足／画面未接続／実機確認待ち|settings/assistant panelあり、全作業別/お気に入り/自然言語画面遷移未確認。単独起動の機能別証明は未完。|全スマートUI要件未確認の解消、共通production/policy不足解消後に実機|
|29|素材・テンプレートライブラリ|C|実装不足／画面未接続／backend不足／実機確認待ち|素材保存・Key/BPM適応・文章検索の統合完成は確認できません。単独起動の機能別証明は未完。|software/binding未確認の解消、共通production/policy不足解消後に実機|
|30|完成版・制作履歴管理|C|実装不足／画面未接続／実機確認待ち|productionHistory fieldあり、完成固定/検索/日次Session全フロー未確認。単独起動の機能別証明は未完。|field存在だけで全仕様を保証不可の解消、共通production/policy不足解消後に実機|

A0/B0/C30. Previous A0/B0/C30; delta0/0/0. No estimated percentage. Next B candidate No.2 (close browser/native whole-path evidence); No.1 and No.6 retained C pending all-edit persistence/selective Undo and family apply evidence. No external implementation blocker to MIDI code required switching to unrelated features in this change.

## Verification
Final local Node2012/2012 PASS;182 JS node --check PASS;53 Python compile PASS;git diff --check PASS. Remote exact-head native results are reported in the PR description. Python509 tests:504 PASS, five preexisting skips. Local Swift/macOS/iPad builds UNVERIFIED; exact-head Actions scheduled via added create-event workflow. Browser launch attempted using already-installed Playwright: missing Chromium executable; widths1440/820/390, Console errors/warnings/external browser traffic UNVERIFIED. No install requested or performed.

## Physical checks last
Intel Mac Chrome + Keystation: permission/audio wait Stop; route/change project; Count-in Stop/disconnect; reconnect; rapid Record/Stop and repeated keys; tempo/meter changes; held-note Stop; save/reopen/play/edit; existing locked/unlocked/other Tracks unchanged. Native Mac/iPad permissions, input availability, restart durability. Other30-feature hardware obligations remain recorded in the source matrix.

Draft only. No Ready/Merge/Auto Merge/force push, main/existing PR/song/backup changes, Live Provider requests, model downloads, installations, signatures, notarization or sale.

Follow-up: inherited dependency CI on both #368/#369 failed when static URL scanning encountered malformed IPv6 syntax. Scanner now retains INVALID_URL_REFERENCE/UNVERIFIED evidence and continues scanning valid hosts, without suppressing the unresolved boundary. Added Python regression; no runtime network or installation. All115 historical head workflow listings retrieved; job/log exhaustive coverage remains UNVERIFIED.

Second inherited browser-fixture defect surfaced after URL scanning resumed: transaction harness requested IndexedDB version5 although production is version6. Open the already initialized fixture DB without imposing a downgrade version; production schema/database and saved songs unchanged. Local JS syntax/whitespace PASS; real-browser proof remains pending final CI.
