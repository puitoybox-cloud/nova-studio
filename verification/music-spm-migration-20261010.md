# Music SPM startup / explicit migration — 2026-10-10 JST

Primary source: Music_Studio_最終機能仕様書_v1.pdf (2026-09-30), all 5 pages /166 extracted lines reread 2026-10-10. Prior matrix: verification/music-bundled-midi-20261010.md at #370 f661d538b1c83b7e0005dd2e6af5b89e29e88ecf.

Current main via git ls-remote: 552d56eafddfd192970c09f7d6278696cf8775c3. GitHub REST open PR pages 1/2:117 open,115 Draft, newest #370. Every list record includes current HEAD/base; All115 Draft metadata/head/base/conflicts/change stats and paginated filenames re-fetched without errors; all115 mergeable, no HEAD change. All115 current base..head commit ranges retrieved from fetched Git objects. PR-triggered exact-head first-page run listings retrieved for all115; historical branch-create runs/full logs exhaustion remains UNVERIFIED. #370 metadata/patch reread: Draft/Open/mergeable,3 commits/10 files. Base native/browser Actions38035997288/38035997294 SUCCESS and decoded job logs fetched. This branch stacks on unchanged #370; no existing refs changed.

## Concrete implementation
- Swift Package executable declares MusicStudioWeb copy resources and passes Bundle.module.resourceURL on both platform paths. Supported standard launcher scripts/music-run-native-package.sh stages current tracked HTML/JS/CSS/images before swift run. CI stages resources before Swift build/test. A raw swift run without staging fails closed; README placeholder is not a working product bundle.
- Executable --verify-bundled-assets checks every manifest file byte count and SHA256 from its actual Bundle.module, including HTML entry, before reporting its build revision. It does not prove UI/audio startup.
- Added real WKWebView file-origin IndexedDB write / host destruction / host replacement / read test, isolated random fixture database. Default persistent store is asserted. Same process only: application termination, update and iPad physical persistence remain UNVERIFIED.
- Browser explicit JSON transfer from source into a separate empty context, duplicate project-ID import and invalid JSON rejection, reload and exact MIDI Tracks. Browser context isolation does not prove legacy-version compatibility or native import/download UI. No cross-origin automatic data access.
- Existing JSON import is add-only for a duplicate project ID; original MIDI Track IDs/notes retained. No existing production databases are touched. MIDI JSON does not include externally referenced audio bytes; full binary migration has separate unfinished requirements.

Initial HEAD70d6b12 real Chrome CI38037070196 SUCCESS: all3 widths recording/save/reopen/play/edit/fault recovery and explicit isolated JSON import/duplicate/corrupt rejection PASS; ordinary console error/warn/pageerror0 and external requests0. One deliberately injected IndexedDB AbortError per width is reported separately, not concealed. These results do not certify the later import-race fix before final CI.

## Additional No.1 original-song protection fix
A deterministic regression reproduced JSON import overwriting a different song inserted between has(projectId) and put(). The import now uses existing atomic compareAndPut with an absent baseline in the same storage transaction; a collision retries with a new project ID. Missing atomic adapters fail closed. Track IDs/notes are unchanged; operational storage failures are not treated as collisions. Added unit regression and real IndexedDB race fixture in Chrome migration flow. This also protects No.6/22/23 shared original data boundaries, without claiming their full completion.

## Evidence
Final local Node2018/2018 PASS (+3 meaningful import-safety regressions); Python504 PASS/5 skips (509 run);184 JS checks and54 Python compile PASS; git diff --check PASS. Local Swift/Xcode/Chrome absent: UNVERIFIED. Initial published HEAD70d6b122ed6c4f681ae96bb5a9b36cc2770fff4d software/native CI38037068040 SUCCESS: Node2015,Python504/5 skip,Swift57,file-origin fixture host replacement PASS,SPM152 exact bytes verified,both unsigned builds SUCCESS. Production whole recording/native restart remains unverified. Updated final exact-head CI pending at commit; final PR evidence supersedes this pending state. No estimated rate or time.

## All30 current classifications
|No.|正式大機能|区分|C理由の分類|根拠と実機以外の残件|次の作業|
|---:|---|---|---|---|---|
|1|MIDI・Track編集|C|実装不足／自動テスト不足／実機確認待ち|editor/selected Track/partial edit/cleanup実装、全仕様完了は未確認。単独起動の機能別証明は未完。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|2|MIDI録音|C|単独起動検証不足／実機確認待ち|今回の開始要求token・入力token・recorder/session捕捉で遅延開始、古いイベント/RAF、Count-in取消、access supersessionを防止。容量不足後の保持・再保存・再Openをproduction API回帰で確認。|最新資産のXcode同梱・起動接続を実装。仮想MIDI実Chrome検証を追加、exact-head実行待ち。SPM標準launcher資産同梱・Bundle.module起動を今回接続。file-origin WebView交換テスト追加、CI待ち。アプリ再起動と全fault matrixは未完|
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
|18|AIミックス支援|C|実装不足／自動テスト不足／実機確認待ち|music-studio.js: 実PCM Gain/EQ/Compression/提案/A-B/保存あり。既存実装で同期区間を候補へ接続し、短PCM空間処理・保存・履歴・再Open・WAV出力を追加。ボーカル可聴性の完成証明、複数伴奏分析・ブラウザ検証は未完。単独起動の機能別証明は未完。|複数伴奏/可聴性・空間全仕様・ブラウザ検証、共通production/policy不足解消後に実機|
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

A0/B0/C30; prior A0/B0/C30; delta0/0/0. No.2 remains C until native production whole path, complete bounded cancellation coverage, and migration acceptance evidence close. File-origin host replacement is not app restart. No model/license prerequisites are added to plain MIDI without evidence.

See music-residual-ledger-20261010.json for deduplicated confirmed residual subset and the explicitly unknown total denominator.

Physical checks last: Intel Mac/Keystation actual input/permission/audio unlock, count-in/metronome tempo/meter audibility, rapid starts/stops/held/repeated notes/disconnect,record→Stop→save→quit→restart→reopen→play→edit; native macOS/iPad file-origin persistence across restart/update; old public version explicit Export/Import and Backup/Restore into native application with original retained. Simulator/Chrome never substitutes physical evidence.

## Native file import follow-up — 2026-10-10 JST

At base #371, MusicStudioWebViewHost had no WKUIDelegate/runOpenPanelWith implementation. macOS web file inputs therefore lacked the host chooser path. The host now owns the UI delegate and presents NSOpenPanel for an approved main-frame file input after BROWSER_READY. Cancellation, foreign/subframes and stopped hosts return nil; selected files do not become allowed navigation targets. Existing JavaScript validators and atomic add-only JSON import remain authoritative. Swift regression checks readiness/origin/frame/stop and delegate ownership; existing loaded file-origin test checks allowed main frame and denied subframe. Actual chooser interaction, legacy exports, Backup import UI and whole native production path remain UNVERIFIED.

No whole ledger item is closed by this subtask. A0/B0/C30 unchanged. Partial R1=3/R2=3/R3=4/R4=3; known pre-physical subset10, full total unknown. The formal PDF was reread in this follow-up (all5 pages/166 lines, confirmed2026-09-30). The inherited 30-feature matrix is preserved; current production evidence is not newly certified exhaustive.

Follow-up local validation: Node2018/2018 PASS, Python504 PASS/5 existing skips (509 run), all184 tracked JavaScript syntax PASS and git diff --check PASS. Local Swift/Xcode/Chrome absent: UNVERIFIED. #371 five non-skipped workflows/six jobs SUCCESS, all six decoded job logs reread. These base results do not certify the new HEAD. Native-path changes now trigger the existing real-Chrome regression CI.
