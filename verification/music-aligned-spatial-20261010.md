# 30大機能 A/B/C判定 — 2026-10-10 JST

出典：Music_Studio_最終機能仕様書_v1.pdf（確定2026-09-30）、2026-10-10に現行5ページ・166行を全文取得。
#365 HEAD 13bf1acb1cb6380559e66b4336575e989fdb9b56を基準にコード・過去検証資料を確認。過去の各機能監査を全要件合格とは扱わない。
A=実機含む正式完成。B=全software/production/backend/policy完了、実機のみ待ち。C=実機以外にも不足または未検証。
共通不足：単独production packageのactual assets、runtime/license/system/interpreter policyの承認・全要件証明が未完。unsigned CIビルドはこれらの承認を代替しない。全行の実機も未完。したがってBへ上げられない。

|No.|正式大機能|区分|根拠と実機以外の残件|次の作業|
|---:|---|---|---|---|
|1|MIDI・Track編集|C|editor/selected Track/partial edit/cleanup実装、全仕様完了は未確認。共通不足も適用。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|2|MIDI録音|C|midi-input/dynamic-track-recording実装。共通不足も適用。|MIDI実機とP/Q未完の解消、共通production/policy不足解消後に実機|
|3|曲構造・音楽情報|C|meter-map/structure-info/transpose実装、解析全要件未確認。共通不足も適用。|全解析とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|4|AI新曲スタート|C|AI workflow/composition候補、文章・歌詞生成backend全要件未確認。共通不足も適用。|backend/model/P/Q/D未完の解消、共通production/policy不足解消後に実機|
|5|Music Studio AI制作アシスタント|C|local panel/workflow、安全adapterあり、自然会話・複数作業完成支援未確認。共通不足も適用。|対話backendとP/Q/D未完の解消、共通production/policy不足解消後に実機|
|6|AI安全編集・変更管理|C|candidate/family apply/locks/Undo実装、特定変更Undo全要件未確認。共通不足も適用。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|7|AI作曲・曲展開|C|continuation/section候補参照、実生成全要件未確認。共通不足も適用。|生成backendとP/Q/D未完の解消、共通production/policy不足解消後に実機|
|8|AIアレンジ支援|C|arrangement destinationはidentity参照、生成・Apply未達（verification note）。共通不足も適用。|参照から実生成への接続未完の解消、共通production/policy不足解消後に実機|
|9|AIコード支援|C|chord候補あり、音声解析/Voicing/追従補正全要件未確認。共通不足も適用。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|10|AI歌詞・メロディ制作|C|lyricsAssignmentPreview/adoptLyricsAssignment・tests/music-studio-lyrics-note-assignment.test.js：音符割当あり。言語/生成backend・アクセント・固定再生成全要件証明未完。共通不足も適用。|参照以外の全フロー未確認の解消、共通production/policy不足解消後に実機|
|11|AI仮歌・対話修正|C|音声仮歌生成・再生中対話修正の完成実装は確認できません。共通不足も適用。|software/backend/assets未確認の解消、共通production/policy不足解消後に実機|
|12|ボーカル録音|C|WAV/Punch/Cycle/Take/Comp/Latency統合完成は確認できません。共通不足も適用。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|13|ボーカル編集|C|非破壊波形/歌詞/音符同期・Pitch/Timing完成は確認できません。共通不足も適用。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|14|ボーカル生成・Harmony|C|生成・本人声・Harmony完成は確認できません。共通不足も適用。|software/model/policy未完の解消、共通production/policy不足解消後に実機|
|15|ボーカル完成チェック|C|Take/仮歌比較・補正判断支援完成は確認できません。共通不足も適用。|software/backend未確認の解消、共通production/policy不足解消後に実機|
|16|Stem Separation|C|server/Demucs child pipelineあり、approved runtimeなし。共通不足も適用。|actual assets/policy/実model未完の解消、共通production/policy不足解消後に実機|
|17|Audio-to-MIDI|C|pipeline/repair/comparisonあり、今回realモデル精度未検証。共通不足も適用。|actual assets/Intel精度未完の解消、共通production/policy不足解消後に実機|
|18|AIミックス支援|C|music-studio.js: 実PCM Gain/EQ/Compression/提案/A-B/保存あり。本PRは明示frame位置の2音声分析、長時間stereo WAVのbalance/widthを追加。時間分析から改善案への接続、短PCM空間保存履歴、聴感品質、ブラウザ検証が残る。共通不足も適用。|同期区間に基づく提案接続・短PCM空間履歴・ブラウザ検証、共通production/policy不足解消後に実機|
|19|AIマスタリング|C|music-studio.js mastering status=planned、masteringNotesはLUFS処理ではない。共通不足も適用。|planned・処理backend未完の解消、共通production/policy不足解消後に実機|
|20|Logic Pro往復連携|C|SMF import/exportあり、audio referenceはtab内確認のみ、.logicx直接未対応。共通不足も適用。|WAV/Stem往復・直接操作未達の解消、共通production/policy不足解消後に実機|
|21|最終書出し・配信パッケー|C|MIDI exportあり、Master/Instrumental/Stem一括完成は未確認。共通不足も適用。|一括audio export全要件未確認の解消、共通production/policy不足解消後に実機|
|22|保存・曲バージョン管理|C|projects/storage/AI workspaceあり、全Version部分合成未確認。共通不足も適用。|全version仕様/binding未完の解消、共通production/policy不足解消後に実機|
|23|バックアップ・復旧・移行|C|createLongWavArchive/restoreLongWavArchive・long-wav-storage tests：元WAVの完全archiveあり。外部参照binaryは拒否、自動binary backup未接続、production binding未完。共通不足も適用。|外部参照のbyte検証とadd-only復元・自動binary backup、共通production/policy不足解消後に実機|
|24|Music Studio診断・安全修復|C|dependency/storage/byte inspectionあり、性能診断・自動修復全要件未確認。共通不足も適用。|診断/修復全仕様未確認の解消、共通production/policy不足解消後に実機|
|25|AI実行環境・作品保護|C|strict runtime/lifecycle/fail-closed実装、native isolation production未承認。共通不足も適用。|production binding/policy/実機未完の解消、共通production/policy不足解消後に実機|
|26|AI料金管理|C|実料金見積/月上限/使用量backend完成は確認できません。共通不足も適用。|software/provider policy未完の解消、共通production/policy不足解消後に実機|
|27|AIモデル管理・互換性|C|capabilities/identity/closureあり、軽量切替・旧Model・品質管理全要件未確認。共通不足も適用。|actual model/切替全仕様未完の解消、共通production/policy不足解消後に実機|
|28|スマートUI|C|settings/assistant panelあり、全作業別/お気に入り/自然言語画面遷移未確認。共通不足も適用。|全スマートUI要件未確認の解消、共通production/policy不足解消後に実機|
|29|素材・テンプレートライブラリ|C|素材保存・Key/BPM適応・文章検索の統合完成は確認できません。共通不足も適用。|software/binding未確認の解消、共通production/policy不足解消後に実機|
|30|完成版・制作履歴管理|C|productionHistory fieldあり、完成固定/検索/日次Session全フロー未確認。共通不足も適用。|field存在だけで全仕様を保証不可の解消、共通production/policy不足解消後に実機|

集計：A 0 / B 0 / C 30。B+C=30機能。各行の未検証を含む残件群を記載。下位要件の全件数・完了証拠の母数が確立していないため、software完成率・実機確認開始準備率・残下位要件数は確認できません。formal AへBを加算していません。

## 本PRの実装と検証
時間分析は同sample rateと明示startFrameのみ。最大10000区間、各区間100ms以下、WAVは16384 framesずつ復号。帯域重なりは近似crossover energyであり聴感masking確定ではない。音量差はpairwise、複数伴奏の合成可聴性ではない。同期候補はまだ既存自動提案へ接続していない。
空間DSPはattenuating balanceとmid/side width 0–1。長時間WAV UI/Preview/A-B/Save/history/Undo-Redo/reopen/archive/exportは既存settings経路を使用。元音声変更なし。空間Save/reopen/Undo-Redo/archiveと元byte/MIDI保護の統合回帰を追加。quota/staleは既存共通経路の検証であり実機acceptanceではない。
Node 1994/1994 PASS（追加5、最終suite結果はPR本文を優先）。Python 508実行、503 PASS、既存5 skip。JS 182 syntax / Python 53 compile / shell 5 syntax PASS。git diff --check PASS。
1440/820/390、Console error/warn、ブラウザ外部通信：UNVERIFIED。既存PlaywrightのChromium実行ファイルなし。download/installなし。Swift/macOS/iPad署名不要build：新HEAD Actionsにて検証予定、現時点UNVERIFIED。
GitHubのmainと112 Open/110 Draft metadataを再取得。commits/filesは各先頭100、PR-event runs先頭ページ。過去全page/全logは未監査。#365 create-event CIは独立再取得。

## 実機のみで確認する項目
Intel Mac/iPadの可聴性・音声権限/latency・再起動保存・大WAVメモリ/quota・同時tab・archive移行・native acceptance。Audio-to-MIDIの6音精度は継続。これらを終えてもsoftware/backend/policy残件があればAにはしない。

cache keyを1.4.127へ更新。初回再実行で古いescaped regex assertion 2件が失敗したため、期待cache keyを一致させて全suiteを再実行。assertionの削除・緩和なし。
