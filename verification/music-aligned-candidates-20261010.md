# 30大機能 A/B/C判定 — 2026-10-10 JST

出典：Music_Studio_最終機能仕様書_v1.pdf（確定2026-09-30）、2026-10-10に現行5ページ・166行を全文取得。
#366 HEAD cc40af3b1e8fa58b99d561fdca08a4790f368d05を基準にコード・過去検証資料を確認。過去の各機能監査を全要件合格とは扱わない。
A=実機含む正式完成。B=全software/production/backend/policy完了、実機のみ待ち。C=実機以外にも不足または未検証。
共通不足：単独production packageのactual assets、runtime/license/system/interpreter policyの承認・全要件証明が未完。unsigned CIビルドはこれらの承認を代替しない。全行の実機も未完。したがってBへ上げられない。

|No.|正式大機能|区分|C理由の分類|根拠と実機以外の残件|次の作業|
|---:|---|---|---|---|---|
|1|MIDI・Track編集|C|実装不足／自動テスト不足／実機確認待ち|editor/selected Track/partial edit/cleanup実装、全仕様完了は未確認。共通不足も適用。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|2|MIDI録音|C|自動テスト不足／実機確認待ち|midi-input/dynamic-track-recording実装。共通不足も適用。|MIDI実機とP/Q未完の解消、共通production/policy不足解消後に実機|
|3|曲構造・音楽情報|C|実装不足／backend不足／自動テスト不足／実機確認待ち|meter-map/structure-info/transpose実装、解析全要件未確認。共通不足も適用。|全解析とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|4|AI新曲スタート|C|backend不足／依存資産不足／実機確認待ち|AI workflow/composition候補、文章・歌詞生成backend全要件未確認。共通不足も適用。|backend/model/P/Q/D未完の解消、共通production/policy不足解消後に実機|
|5|Music Studio AI制作アシスタント|C|backend不足／画面未接続／実機確認待ち|local panel/workflow、安全adapterあり、自然会話・複数作業完成支援未確認。共通不足も適用。|対話backendとP/Q/D未完の解消、共通production/policy不足解消後に実機|
|6|AI安全編集・変更管理|C|実装不足／自動テスト不足／実機確認待ち|candidate/family apply/locks/Undo実装、特定変更Undo全要件未確認。共通不足も適用。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|7|AI作曲・曲展開|C|backend不足／依存資産不足／実機確認待ち|continuation/section候補参照、実生成全要件未確認。共通不足も適用。|生成backendとP/Q/D未完の解消、共通production/policy不足解消後に実機|
|8|AIアレンジ支援|C|実装不足／画面未接続／backend不足／実機確認待ち|arrangement destinationはidentity参照、生成・Apply未達（verification note）。共通不足も適用。|参照から実生成への接続未完の解消、共通production/policy不足解消後に実機|
|9|AIコード支援|C|実装不足／backend不足／実機確認待ち|chord候補あり、音声解析/Voicing/追従補正全要件未確認。共通不足も適用。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|10|AI歌詞・メロディ制作|C|backend不足／依存資産不足／自動テスト不足／実機確認待ち|lyricsAssignmentPreview/adoptLyricsAssignment・tests/music-studio-lyrics-note-assignment.test.js：音符割当あり。言語/生成backend・アクセント・固定再生成全要件証明未完。共通不足も適用。|参照以外の全フロー未確認の解消、共通production/policy不足解消後に実機|
|11|AI仮歌・対話修正|C|実装不足／backend不足／依存資産不足／実機確認待ち|音声仮歌生成・再生中対話修正の完成実装は確認できません。共通不足も適用。|software/backend/assets未確認の解消、共通production/policy不足解消後に実機|
|12|ボーカル録音|C|実装不足／backend不足／画面未接続／実機確認待ち|WAV/Punch/Cycle/Take/Comp/Latency統合完成は確認できません。共通不足も適用。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|13|ボーカル編集|C|実装不足／backend不足／画面未接続／実機確認待ち|非破壊波形/歌詞/音符同期・Pitch/Timing完成は確認できません。共通不足も適用。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|14|ボーカル生成・Harmony|C|実装不足／backend不足／依存資産不足／policy不足／実機確認待ち|生成・本人声・Harmony完成は確認できません。共通不足も適用。|software/model/policy未完の解消、共通production/policy不足解消後に実機|
|15|ボーカル完成チェック|C|実装不足／backend不足／実機確認待ち|Take/仮歌比較・補正判断支援完成は確認できません。共通不足も適用。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|16|Stem Separation|C|依存資産不足／policy不足／自動テスト不足／実機確認待ち|server/Demucs child pipelineあり、approved runtimeなし。共通不足も適用。|actual assets/policy/実model未完の解消、共通production/policy不足解消後に実機|
|17|Audio-to-MIDI|C|依存資産不足／policy不足／自動テスト不足／実機確認待ち|pipeline/repair/comparisonあり、今回realモデル精度未検証。共通不足も適用。|actual assets/Intel精度未完の解消、共通production/policy不足解消後に実機|
|18|AIミックス支援|C|実装不足／自動テスト不足／実機確認待ち|music-studio.js: 実PCM Gain/EQ/Compression/提案/A-B/保存あり。本PRで同期区間を候補へ接続し、短PCM空間処理・保存・履歴・再Open・WAV出力を追加。ボーカル可聴性の完成証明、複数伴奏分析・ブラウザ検証は未完。共通不足も適用。|複数伴奏/可聴性・空間全仕様・ブラウザ検証、共通production/policy不足解消後に実機|
|19|AIマスタリング|C|実装不足／backend不足／画面未接続／実機確認待ち|music-studio.js mastering status=planned、masteringNotesはLUFS処理ではない。共通不足も適用。|planned・処理backend未完の解消、共通production/policy不足解消後に実機|
|20|Logic Pro往復連携|C|実装不足／画面未接続／実機確認待ち|SMF import/exportあり、audio referenceはtab内確認のみ、.logicx直接未対応。共通不足も適用。|WAV/Stem往復・直接操作未達の解消、共通production/policy不足解消後に実機|
|21|最終書出し・配信パッケー|C|実装不足／backend不足／実機確認待ち|MIDI exportあり、Master/Instrumental/Stem一括完成は未確認。共通不足も適用。|一括audio export全要件未確認の解消、共通production/policy不足解消後に実機|
|22|保存・曲バージョン管理|C|実装不足／画面未接続／自動テスト不足／実機確認待ち|projects/storage/AI workspaceあり、全Version部分合成未確認。共通不足も適用。|全version仕様/binding未完の解消、共通production/policy不足解消後に実機|
|23|バックアップ・復旧・移行|C|実装不足／画面未接続／自動テスト不足／実機確認待ち|createLongWavArchive/restoreLongWavArchive・long-wav-storage tests：元WAVの完全archiveあり。外部参照binaryは拒否、自動binary backup未接続、production binding未完。共通不足も適用。|外部参照のbyte検証とadd-only復元・自動binary backup、共通production/policy不足解消後に実機|
|24|Music Studio診断・安全修復|C|実装不足／画面未接続／実機確認待ち|dependency/storage/byte inspectionあり、性能診断・自動修復全要件未確認。共通不足も適用。|診断/修復全仕様未確認の解消、共通production/policy不足解消後に実機|
|25|AI実行環境・作品保護|C|backend不足／policy不足／自動テスト不足／実機確認待ち|strict runtime/lifecycle/fail-closed実装、native isolation production未承認。共通不足も適用。|production binding/policy/実機未完の解消、共通production/policy不足解消後に実機|
|26|AI料金管理|C|backend不足／policy不足／画面未接続／実機確認待ち|実料金見積/月上限/使用量backend完成は確認できません。共通不足も適用。|software/provider policy未完の解消、共通production/policy不足解消後に実機|
|27|AIモデル管理・互換性|C|実装不足／依存資産不足／policy不足／実機確認待ち|capabilities/identity/closureあり、軽量切替・旧Model・品質管理全要件未確認。共通不足も適用。|actual model/切替全仕様未完の解消、共通production/policy不足解消後に実機|
|28|スマートUI|C|実装不足／画面未接続／実機確認待ち|settings/assistant panelあり、全作業別/お気に入り/自然言語画面遷移未確認。共通不足も適用。|全スマートUI要件未確認の解消、共通production/policy不足解消後に実機|
|29|素材・テンプレートライブラリ|C|実装不足／画面未接続／backend不足／実機確認待ち|素材保存・Key/BPM適応・文章検索の統合完成は確認できません。共通不足も適用。|software/binding未確認の解消、共通production/policy不足解消後に実機|
|30|完成版・制作履歴管理|C|実装不足／画面未接続／実機確認待ち|productionHistory fieldあり、完成固定/検索/日次Session全フロー未確認。共通不足も適用。|field存在だけで全仕様を保証不可の解消、共通production/policy不足解消後に実機|

集計：A 0 / B 0 / C 30。B+C=30機能。各行の未検証を含む残件群を記載。下位要件の全件数・完了証拠の母数が確立していないため、software完成率・実機確認開始準備率・残下位要件数は確認できません。formal AへBを加算していません。


## 今回閉じた実機能不足
- 時間同期した2音声の注意区間を短PCM・長WAVの実測改善候補へ接続。明示ボーカルは抑制対象から除外。区間と秒数を証拠に保持。Gain/EQの部分採用、Preview、A/B、確定保存は既存経路を使用。候補は音声全体への設定変更であり区間自動編集ではない。聴感改善や学習型AIを保証しない。
- 短PCMのattenuating balanceとmid/side width 0–1を実renderに接続。保存済み空間設定をGain/EQ/Compression処理にも保持。additive bounded history、Undo/Redo、JSON reopen、Backup、実WAV export。旧JSONはidentity設定を使い元PCM/MIDIを変更しない。monoの空間変更を拒否。
- quota/stale/CAS失敗時の非書換え、tampered preview、mono/invalid history、履歴分岐、実測同期候補の選択/保存を自動回帰で検証。

## 判定と優先順
A0/B0/C30、前回差すべて0。下位要件母数が未確定のため完成率・準備率は確認できません。Bへ近づける次の候補はNo.2の仕様ごとの録音/Count-in/Metronome/保存証明、No.1とNo.6の全編集経路・特定変更Undo、No.18の複数伴奏/可聴性分析と空間全仕様。相対的な近さの数値順位は未確定。
No.23の外部参照binary完全Backup/復元・自動binary Backupは未解消。元WAV archiveは既存のまま外部参照をfail closedで拒否する。Cloud Sync構成も未確定。既存データの扱いを緩和してBへ上げない。

## 再取得・検証
2026-10-10 JST: 正式仕様書の現行5ページ166行（確定2026-09-30）と前回30行を再読。main 552d56eafddfd192970c09f7d6278696cf8775c3、113 Open PRの全metadata・HEAD/base/mergeableと各commits/files/runs先頭100を再取得。111 Draft。詳細はinventory JSON。100件を超える履歴の全page/全logは未監査。最新#366 exact-head create Actions 38016090076 software/native成功を取得し、2job decoded logsも再取得。
新HEADの最終結果はDraft PR本文・Actionsを参照。ローカルSwift/Xcodeはなし。1440/820/390、Console error/warn、ブラウザ外部通信はUNVERIFIED: Playwright Chromium executableが存在せず起動できない。download/installなし。元曲/既存PR/main/バックアップ変更なし。Live Provider通信なし。

## 実機必須確認（最後に集約）
Intel Mac/iPadの可聴性、音声権限とLatency、MIDI接続/切断・録音、再起動耐久性、長WAV memory/quota、同時tab、archive別端末移行、native acceptance。Audio-to-MIDIの既存6音精度FAILをCIで上書きしない。実機完了後もsoftware/backend/policy未完ならAではない。
