# Music bundled MIDI production — 2026-10-10 JST

Source: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30; all5 pages/166 lines reread today. No.2: MIDI keyboard recording, Count-in, Metronome, recording/playback/save. Latest existing matrix reread at #369 exact HEAD.

Base #369 69114edbb37ce8af21c7d7ba14d01ea4f0a0b443, Draft/Open/mergeable. Main 552d56eafddfd192970c09f7d6278696cf8775c3; 114 Open Draft PR metadata re-fetched. Base exact-head workflow listing: 7 non-skipped SUCCESS.

## Implementation
Both Xcode app targets now stage current checkout HTML/JS/CSS/images at build time with SHA256/byte inventory. Default startup selects bundled MusicStudioWeb/music-studio.html; absent bundle fails closed, never starts stale public HTML. WKWebView uses loadFileURL/read-access directory. Bundled navigation cannot escape its resource root. Explicit strict anchored loopback startup is unchanged. Legacy public production configuration remains only for explicit compatibility callers, not default startup.

Swift package executable assets are not staged by this Xcode build phase; that path remains UNVERIFIED/incomplete. WKWebView file-origin IndexedDB durability and WebAudio/native MIDI whole path remain UNVERIFIED. This closes a concrete Xcode production asset binding defect, not all standalone acceptance.

## Automated evidence
Added real Chrome virtual-MIDI lifecycle on staged bundle via loopback test server: permission, Count-in, recording, real WebAudio scheduling, Stop, production IndexedDB save/reload, playback, one-note deletion/other Tracks protection; deferred audio Stop, deferred permission Stop/navigation, Count-in cancellation. This does not certify WKWebView file-origin behavior or physical permissions/audio/keyboard. CI uses existing disposable runner browser provisioning step; no local installation/download/signing/notarization.

Local base suite2012 PASS; added staging tests2 PASS. Local full Node2014 PASS; Python504 PASS/5 existing skip;184 JS checks and54 Python compile PASS. HEAD d0ad3da3eb1e430f4d5a4569c993ada81ce8e6a1 exact-head software/native CI PASS, Swift56 PASS and both unsigned builds succeeded; both packaged138 assets. New browser flow completed operations/fault recovery at1440, then caught4 console404s: nested home assets omitted. This production packaging defect is repaired by preserving tracked assets/ subdirectories (152 assets), with a regression assertion. New final exact-head CI pending. Local Chrome/Swift/Xcode absent: UNVERIFIED. Browser actual IndexedDB write-abort/retry/reload, disconnect/reconnect and repeated-start rejection are included. Previous failure reached final console assertion; complete all-width final proof remains pending. No B promotion based on unexecuted code.

## All30 classifications
|No.|正式大機能|区分|C理由の分類|根拠と実機以外の残件|次の作業|
|---:|---|---|---|---|---|
|1|MIDI・Track編集|C|実装不足／自動テスト不足／実機確認待ち|editor/selected Track/partial edit/cleanup実装、全仕様完了は未確認。単独起動の機能別証明は未完。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|2|MIDI録音|C|単独起動検証不足／実機確認待ち|今回の開始要求token・入力token・recorder/session捕捉で遅延開始、古いイベント/RAF、Count-in取消、access supersessionを防止。容量不足後の保持・再保存・再Openをproduction API回帰で確認。|最新資産のXcode同梱・起動接続を実装。仮想MIDI実Chrome検証を追加、exact-head実行待ち。WKWebView file-origin IndexedDB再起動／SPM資産接続と全fault matrixは未完|
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


A0/B0/C30; previous A0/B0/C30; delta0/0/0. Formal A0. No estimated percentage. Next B candidate No.2; No.1 all-editor persistence and No.6 selective Undo remain C.

## Physical checks last
Intel Mac Chrome/Keystation: actual MIDI permission, audio unlock, Count-in/metronome audibility/timing, Stop while waiting, route change, disconnect/reconnect, rapid Record/Stop/repeated keys, held-note lengths, save/restart/reopen/play/edit and other/locked Tracks unchanged. Native Mac/iPad: default bundled launch, native input, persistence across restart and update. Simulator evidence is not physical acceptance.

Draft only. No main/old PR/song/backup edits, Ready/Merge/Auto Merge/force push, Live Provider calls, local installation, signing/notarization or sales.
