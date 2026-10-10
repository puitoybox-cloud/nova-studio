# 30大機能 A/B/C判定 — 2026-10-10 JST

出典：Music_Studio_最終機能仕様書_v1.pdf（確定2026-09-30）、2026-10-10に現行5ページ・166行を全文取得。
#367 HEAD 29d61d61b673c90e7df276cde0614b6da2454773を基準にコード・過去検証資料を確認。過去の各機能監査を全要件合格とは扱わない。
A=実機含む正式完成。B=全software/production/backend/policy完了、実機のみ待ち。C=実機以外にも不足または未検証。
依存資産・backend・policyは、その機能の実際のproduction経路で必要なものだけを判定する。No.1/2の純粋なブラウザMIDI経路にAIモデル資産を一律必須とはしない。全行で下位要件の証明または実装が未完で、実機も未完。unsigned CIは実機を代替しない。

|No.|正式大機能|区分|C理由の分類|根拠と実機以外の残件|次の作業|
|---:|---|---|---|---|---|
|1|MIDI・Track編集|C|実装不足／自動テスト不足／実機確認待ち|editor/selected Track/partial edit/cleanup実装、全仕様完了は未確認。単独起動の機能別証明は未完。|全要件とP/Q/D未完の解消、共通production/policy不足解消後に実機|
|2|MIDI録音|C|自動テスト不足／実機確認待ち|midi-input/dynamic-track-recording実装。本PRで選択入力のCount-in切断取消・active入力切替拒否をproduction実装し、tests/music-studio-logic-pro.test.jsの2回帰で検証。単独起動の機能別証明は未完。|MIDI実機とP/Q未完の解消、共通production/policy不足解消後に実機|
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

集計：A 0 / B 0 / C 30。B+C=30機能。各行の未検証を含む残件群を記載。下位要件の全件数・完了証拠の母数が確立していないため、software完成率・実機確認開始準備率・残下位要件数は確認できません。formal AへBを加算していません。


## 今回解消した実コードの不足
選択鍵盤がCount-in中に切断されても予約が残り、代替入力へ切り替えて録音開始できていた。refreshMidiInputDevicesでcancelCountInを呼び、予約token・timer・音源を停止する。遅延callbackを実行しても録音せず、保存曲は同一。editorSelectMidiInputはstarting/countingIn/recording/stopping中の切替・再検出をtransport-busyで拒否し、権限再要求もしない。停止後の切替は維持。cache versionは1.4.129、schema/app versionは不変。

## No.1/2/6 要件別確認
|候補|実装/UI|保存・再Open・Backup|backend/資産/policy|自動検証|残る具体的作業|
|---|---|---|---|---|---|
|No.1 MIDI・Track編集|editor/selection/partial-edit/cleanup経路あり|logic-pro/storage testsに個別例あり、全編集の横断証明未完|ブラウザ編集自体は外部AI不要。Provider Partial Edit別途未完|既存editor/dynamic tests|Velocity/Quantize/音長/全Track/Correction/Cleanupごとに単独production保存復元証明を対応づける|
|No.2 MIDI録音|MIDI Input/Record/Count-in/Metronome/Stopに接続、本PRで切断取消|既存logic-pro testsのStop保存/再Open、設定Backupあり。全入力故障の横断証明未完|Web MIDI/Web Audio、Chrome権限。AIモデル不要。iPad SafariではMIDI非対応表示|本PRの2回帰＋既存Count-in/tempo-map/Stop保存テスト|音源unlock/権限待ち中のStopとsession切替、録音後切断の保存失敗回復を全経路で閉じる|
|No.6 AI安全編集・変更管理|locks/candidate/family apply/部分採用あり|workspace保存あり。特定変更Undoの全family統合は未証明|各生成familyのbackend/policyを個別確認|既存candidate/workflow/lock tests|特定変更Undoの対象依存と保存/復元、A/B/C全familyのproduction実適用を確認|

No.18: 本PRで変更なし。全空間仕様、複数伴奏、可聴性の残件は維持。No.23: 外部参照byte完全Backup/add-only復元・自動binary Backup未完、今回変更なし。
全30行は前回根拠を引き継ぎ、全下位要件を新規に検証済みとは扱わない。A0/B0/C30、差0/0/0。Bへ進めた機能なし。次の優先候補はNo.2。最短との確定比較は確認できません。

## 再取得と検証（2026-10-10 JST）
正式PDF全5ページ166行を再読。main 552d56eafddfd192970c09f7d6278696cf8775c3。Open114/Draft112のHEAD/baseを取得、全114のcommit/file rangesをcloneで照合。各歴史HEADのActionsと競合の全件再取得はUNVERIFIED。#367 Draft/Open/mergeable、exact-head create run38024621518 software/native SUCCESSを再取得。pull-request専用run wrapperは0件でありcreate runを別照合。
ローカル検証結果および新exact-head CIの最終結果は新Draft PR本文を参照。Swift/Xcodeなし、既存browser executableなし。1440/820/390、Console error/warn、browser外部通信はUNVERIFIED。Live Provider呼出しなし。download/install/signingなし。

## 最後に必要な実機確認
Intel Mac Chrome/KeystationでCount-in中の切断、停止後再接続、音符録音/Stop保存/再Open、Count-in/Metronomeとtempo変更の時刻・可聴性。共通のnative単独起動・権限・再起動耐久性、長WAV/quota/移行、No.17の6音精度、No.18の聴感比較。CIは実機確認の代わりではない。
