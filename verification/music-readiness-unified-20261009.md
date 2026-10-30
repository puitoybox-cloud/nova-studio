# Music Studio — 統合readiness監査（2026-10-09 JST）

## 結論

実機確認開始地点100%には未到達。30大機能すべてのsoftware実装完了は確認できません。
約99%（software）・約90〜95%（readiness）は過去の非公式目安で、今回の実測値ではありません。
formal A 0/30、Stage 2 OPEN、Stage 3 NOT PASSED。0.1販売開始は行いません。

## 現在実物と修正

GitHub再取得：main 552d56eafddfd192970c09f7d6278696cf8775c3。
Open PR 95件、そのうちDraft 93件。最新は#348。#347/#348はOpen/Draft/mergeable=true。
#347：412cb636d43e60a1466f51dbb011cc1b711427a1、base 1303a26041c07425bb0469f5abcfc017307a9ebb、1 commit/8 files/+269/-5。
#348：6ef95994a939817b5d579ff452997598da356673、base 412cb636d43e60a1466f51dbb011cc1b711427a1、2 commits/9 files/+644/-7。

安全checkpoint：[PR #348](https://github.com/puitoybox-cloud/nova-studio/pull/348)。exact-head Actions 4/4 SUCCESSを再取得。
[Helper](https://github.com/puitoybox-cloud/nova-studio/actions/runs/37904831891)、
[Swift/build](https://github.com/puitoybox-cloud/nova-studio/actions/runs/37904831712)、
[AI UI](https://github.com/puitoybox-cloud/nova-studio/actions/runs/37904831871)、
[Dependencies](https://github.com/puitoybox-cloud/nova-studio/actions/runs/37904831890)。
Helper job 113735671208のdecoded logも再取得。他3件はrun metadataのみ今回再確認し、全job log再監査は未完了。
#348記載の実Wrapper観測は、approved production assetsではありません。

新branchは#348 exact HEADから作成：feature/music-native-format-closure-v1。
修正前に4つの回帰テストFAILを確認：拡張子なしnative nodeのテキスト、native nodeのscript、distributionの.so script、空filesのnative node。
修正後はNATIVE_EXTENSION/.so/.dylibにMach-O bytesを要求し、空filesの全asset nodeをMISSINGと報告します。
通常のHelper scriptは既存interpreter policy経路を保持。Apple systemは未承認、外部はfail-closed。
既存unsigned_appとWrapper観測が同じgraphを利用するため、両者にもこの拒否が伝播します。
資産採用、policy承認、runtime許可、署名、公証は行いません。

ローカル検証：Node 1831/1831 PASS、0 skip。Python full 508件/503 PASS/既存optional-dependency skip 5件。
Graph 30/30 PASS（追加4件）。全JS syntax 175、Python compile 53、bash syntax 5、git diff --check PASS。
Chrome 1440/820/390：実行ファイルなしで起動失敗。Console/error/warn/pageerror/external 0は新HEADでは確認できません。
Swift/Xcode/macOS/iPad Simulator：ツール不在で未実施。

今回の禁止事項に対応し、commitの[skip ci]で既存push/pull_request Actionsを抑止します。
新規music-readiness-offline.ymlは当該新branchのcreate eventだけを対象にし、既存runner toolのみでNode/Python/Swift/unsigned buildを実行する経路です。
install、model/binary download、署名を実行せず、既存workflowやテストを削除・変更しません。
新しいcreate-event Actionsは作成後にexact HEADとjob logを確認します。開始前時点では未検証です。
既存Helper workflowはpip installとcodesign --sign -を実行するため、そのままの再実行はしません。
テスト削除・テストskip追加・assertion弱体化はありません。新HEADのActions成功は主張しません。
新Draftはレビュー可能な成果であり、CI完了済み安全checkpointへの昇格ではありません。

## 正式30項目readiness matrix

出典：Music_Studio_最終機能仕様書_v1.pdf、確定日2026-09-30、2026-10-09全文取得。
Library ID libfile_fea4127fde5c81919fee8296d5c7647d、5ページ、42740 bytes。
No.21/23はPDF抽出の見出しが途中で切れているため、その抽出表記を保持し補完しません。

このmatrixは機能ごとの完全な実装保証ではなく、現コードとテストの証拠および不足を記録します。
CI欄の「基盤」は#348 exact-headの総合suite成功であり、当該大機能全要件の合格ではありません。
各行の開始は「30機能を備えた単独production appとして統合実機確認を開始できるか」です。
共通P＝approved単独app/manifest/architecture bytes不足。共通Q＝配布・license・system/interpreter policy未完。
共通D＝Intel/Apple Silicon/iPadでの当該機能実機acceptance未完。全行formal A未達。

|No.|正式大機能|software根拠・未達部分|CI証拠|package/asset|policy|physical acceptance|統合開始|formal A未達理由|
|---:|---|---|---|---|---|---|---|---|
|1|MIDI・Track編集|editor/selected Track/partial edit/cleanup実装、全仕様完了は未確認|editor系基盤|P|Q|D：編集・再生|不可|全要件とP/Q/D未完|
|2|MIDI録音|midi-input/dynamic-track-recording実装|recording/native bridge基盤|P、native MIDI|Q|D：Keystation・停止保存|不可|MIDI実機とP/Q未完|
|3|曲構造・音楽情報|meter-map/structure-info/transpose実装、解析全要件未確認|meter/metadata/transpose基盤|P、解析backend|Q|D：途中変更・小節|不可|全解析とP/Q/D未完|
|4|AI新曲スタート|AI workflow/composition候補、文章・歌詞生成backend全要件未確認|composition/UI基盤|P、生成model|Q、model選定|D：生成採用|不可|backend/model/P/Q/D未完|
|5|Music Studio AI制作アシスタント|local panel/workflow、安全adapterあり、自然会話・複数作業完成支援未確認|assistant/UI基盤|P、対話backend|Q|D：会話から操作|不可|対話backendとP/Q/D未完|
|6|AI安全編集・変更管理|candidate/family apply/locks/Undo実装、特定変更Undo全要件未確認|family/locks/persistence基盤|P|Q|D：却下・部分採用|不可|全要件とP/Q/D未完|
|7|AI作曲・曲展開|continuation/section候補参照、実生成全要件未確認|continuation/composition基盤|P、生成model|Q|D：続き・指定時間版|不可|生成backendとP/Q/D未完|
|8|AIアレンジ支援|arrangement destinationはidentity参照、生成・Apply未達（verification note）|arrangement参照基盤|P、生成backend|Q|D：複数Track採用|不可|参照から実生成への接続未完|
|9|AIコード支援|chord候補あり、音声解析/Voicing/追従補正全要件未確認|composition基盤|P、解析/生成backend|Q|D：コード連動|不可|全要件とP/Q/D未完|
|10|AI歌詞・メロディ制作|lyrics reference/structure、音符割当・アクセント・実生成全要件未確認|lyrics reference基盤|P、言語/生成backend|Q|D：歌詞固定/曲固定|不可|参照以外の全フロー未確認|
|11|AI仮歌・対話修正|音声仮歌生成・再生中対話修正の完成実装は確認できません|専用全要件CI未確認|P、歌声model/backend|Q、歌声権利|D：仮歌・修正|不可|software/backend/assets未確認|
|12|ボーカル録音|WAV/Punch/Cycle/Take/Comp/Latency統合完成は確認できません|専用全要件CI未確認|P、録音backend|Q、入力権限|D：入力/monitor/latency|不可|software/backend未確認|
|13|ボーカル編集|非破壊波形/歌詞/音符同期・Pitch/Timing完成は確認できません|専用全要件CI未確認|P、audio編集backend|Q|D：非破壊編集|不可|software/backend未確認|
|14|ボーカル生成・Harmony|生成・本人声・Harmony完成は確認できません|専用全要件CI未確認|P、歌声model/backend|Q、本人同意/権利|D：Harmony品質|不可|software/model/policy未完|
|15|ボーカル完成チェック|Take/仮歌比較・補正判断支援完成は確認できません|専用全要件CI未確認|P、音声解析backend|Q|D：比較・判断品質|不可|software/backend未確認|
|16|Stem Separation|server/Demucs child pipelineあり、approved runtimeなし|Python基盤、実model今回未実施|P、htdemucs_6s/native|Q、checkpoint|D：6 stems性能/品質|不可|actual assets/policy/実model未完|
|17|Audio-to-MIDI|pipeline/repair/comparisonあり、今回realモデル精度未検証|Python/repair基盤|P、Basic Pitch/Demucs|Q、weights|D：C4 E4 G4 C5 G4 C4|不可|actual assets/Intel精度未完|
|18|AIミックス支援|music-studio.js mixing status=planned、mixNotesは処理backendではない|全要件CI未確認|P、DSP/Mix backend|Q|D：可聴性/Mix比較|不可|planned・DSP生成未完|
|19|AIマスタリング|music-studio.js mastering status=planned、masteringNotesはLUFS処理ではない|全要件CI未確認|P、Master/LUFS backend|Q|D：Peak/clip比較|不可|planned・処理backend未完|
|20|Logic Pro往復連携|SMF import/exportあり、audio referenceはtab内確認のみ、.logicx直接未対応|logic-pro/MIDI基盤|P、audio復帰backend|Q、Apple公式手段|D：Logic往復|不可|WAV/Stem往復・直接操作未達|
|21|最終書出し・配信パッケー|MIDI exportあり、Master/Instrumental/Stem一括完成は未確認|MIDI基盤|P、audio export|Q、配信requirements|D：全成果ファイル|不可|一括audio export全要件未確認|
|22|保存・曲バージョン管理|projects/storage/AI workspaceあり、全Version部分合成未確認|storage/persistence基盤|P、binary storage binding|Q、Cloud選定|D：reopen/版比較|不可|全version仕様/binding未完|
|23|バックアップ・復旧・移行|portable package/generation/atomic restoreあり、production complete Backup未確立|atomic/binary基盤|P、binary assets/binding|Q、移行/Cloud|D：別Mac復元|不可|production binding/assets未完|
|24|Music Studio診断・安全修復|dependency/storage/byte inspectionあり、性能診断・自動修復全要件未確認|inspection基盤|P、診断対象runtime|Q、安全修復範囲|D：負荷・障害復旧|不可|診断/修復全仕様未確認|
|25|AI実行環境・作品保護|strict runtime/lifecycle/fail-closed実装、native isolation production未承認|Python/native基盤|P、private runtime/native|Q、system/interpreter|D：通信・停止・隔離|不可|production binding/policy/実機未完|
|26|AI料金管理|実料金見積/月上限/使用量backend完成は確認できません|全要件CI未確認|P、料金adapter|Q、Provider採用|D：上限拒否・表示|不可|software/provider policy未完|
|27|AIモデル管理・互換性|capabilities/identity/closureあり、軽量切替・旧Model・品質管理全要件未確認|runtime/resource基盤|P、model sets|Q、Model採用|D：性能/旧結果|不可|actual model/切替全仕様未完|
|28|スマートUI|settings/assistant panelあり、全作業別/お気に入り/自然言語画面遷移未確認|settings/UI基盤|P、対話backend|Q|D：iPad gesture|不可|全スマートUI要件未確認|
|29|素材・テンプレートライブラリ|素材保存・Key/BPM適応・文章検索の統合完成は確認できません|全要件CI未確認|P、素材storage/search|Q、素材権利|D：再利用・検索|不可|software/binding未確認|
|30|完成版・制作履歴管理|productionHistory fieldあり、完成固定/検索/日次Session全フロー未確認|projects/workflow基盤のみ|P、履歴storage binding|Q|D：完成固定・履歴|不可|field存在だけで全仕様を保証不可|

readinessの算定：全行についてsoftware全仕様＋必要package bytes＋policy＋再現可能な実機手順の証拠が揃った場合のみSTART_READY。
今回START_READY確認0/30、未確立30/30。これは製品完成度0%の意味ではありません。
残件の工数・全下位要件の重みが未確定なため、実機確認開始地点の進捗率は確認できません。
過去90〜95%を今回の数字として再利用せず、100%を主張しません。

## Actual asset requirements

対象は現checkoutのtracked sourceとpackage recipe。ユーザー端末や別保管先の存在は確認していません。
新たなmodel/binary/wheelの取得・install/adoptionなし。CIのtest runtimeは製品runtimeではありません。

|資産|状態|根拠/残件|
|---|---|---|
|Native Wrapper source|AVAILABLE|tools/music-native-wrapperのSwift/Xcode source|
|Native Wrapper production bytes|MISSING|approved exact architecture/package binding未配置。#348 CI観測はUNVERIFIED|
|Helper source|AVAILABLE|mac-app/NovaMusicAudioHelper、pipeline sources|
|Helper production bundle|MISSING|private interpreter/assetsを含むapproved bundleなし|
|private CPython|MISSING|externally anchored selected executableなし|
|stdlib|MISSING|同じprivate generationの全stdlib bytes未配置|
|installed dependencies|MISSING|requirements.txtは要求一覧でinstalled RECORD bytesではない|
|native/shared libraries|MISSING|approved x86_64/arm64 closureなし。Apple system候補はPOLICY_REQUIRED|
|Basic Pitch model|MISSING|selected weights digest/format/provenance/material未配置|
|Demucs htdemucs_6s|MISSING|selected checkpoint digest/provenance/material未配置|
|config/manifest|UNVERIFIED|schema/source/fixtureあり、production approved manifest/anchor未確立|
|license material|UNVERIFIED|source metadataとexact配布bytesの対応未完|
|system/interpreter policy|POLICY_REQUIRED|/usr/lib/dyld、Apple libraries、/bin/bash、/usr/bin/envを未承認維持|

## License / policy 一次情報（確認日2026-10-09）

以下はsource evidenceのみ。選定版、重みdigest、wheel/native build、同梱第三者notice、配布物へのmaterial bindingが未完で、承認しません。

|対象|一次情報URL|確認結果/不足|
|---|---|---|
|Basic Pitch source|https://github.com/spotify/basic-pitch/blob/main/LICENSE|Apache-2.0 source表示|
|Basic Pitch weights|https://huggingface.co/spotify/basic-pitch/blob/main/README.md|model cardのlicense metadataはexact採用weight/formatの承認ではない。LICENSE_UNCONFIRMED維持|
|Demucs source|https://github.com/facebookresearch/demucs/blob/main/LICENSE|MIT source表示|
|Demucs checkpoint|https://github.com/facebookresearch/demucs/blob/main/README.md|htdemucs_6s記載。exact checkpoint配布根拠はEXTERNAL_LICENSE_VERIFICATION_REQUIRED|
|Python/stdlib|https://docs.python.org/3.11/license.html|PSF等license stack、組込software notice。exact build版未選定|
|PyTorch|https://github.com/pytorch/pytorch/blob/main/LICENSE|main sourceとexact native build/third-party materialは別|
|NumPy|https://numpy.org/about/|source BSD情報、exact build/BLAS material別|
|SciPy|https://scipy.org/about/|source BSD情報、exact native/bundled material別|
|SoundFile|https://github.com/bastibe/python-soundfile/blob/master/LICENSE|source表示とlibsndfile/codec配布物は別|
|libsndfile|https://libsndfile.github.io/libsndfile/FAQ.html|LGPLの説明。exact binary/codec/materialは未確認|
|Apple signing/nested code|https://developer.apple.com/library/archive/technotes/tn2206/_index.html|nested code配置/署名順序の参考。system使用/再配布policy承認ではない|
|notarization|https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution|公証準備の参考。実行・申請・方式決定なし|

exact配布bytesがないためlicense materialとの対応を完成させることはできません。
将来の確認はnode ID/version/各file digest→source/version/provenance→material digest→policy記録の対応で行い、名前だけで承認しません。
Apple候補やinterpreterにsource licenseがあるという理由でpolicyを承認しません。

## Signing / notarization前準備

unsigned_app/package_native_graphにlayout、全bound native inventory、selected architecture closure、typed load edges、leaf-first/container-inside-out候補、cycle reviewが実装済み。
今回native formatと空assetの拒否を強化。system policy未完、production package未配置のためunsigned completenessは未完。
署名順候補はdependency leaf→nested container/Helper→main→root。cycleと依存順はgraph結果で再確認し、署名実施しません。
architectureはx86_64とarm64ごとに必要な全imagesを検証。synthetic arm64 PASSはactual arm64 packageの証拠ではありません。
配布方式、PKI、identity、entitlements、notarization、stapling、retentionを決めません。

## Mac不要の作業

完了：現在GitHub metadata再取得、#348 exact Actions metadata再確認、4回帰再現/修正/ローカル検証、正式30項目原文取得、matrix、現asset不足整理、一次情報URL再確認、unsigned/signing候補の根拠整理、下記一括実機手順。
未完：全93 Draftの各mergeable/jobs/logs再監査、新HEAD Actions/Chrome/build、30機能の全下位要件production実装、approved assets/material/policy binding、Cloud/音声/生成/DSP/料金/素材/完成履歴backendの不足解消。
repository-only残件は0ではありません。今回閉じたgraph blockerだけで全体完成にしません。
優先順位は正式30項目の不足が判明したため、package純softwareと不足機能の実装を分離し、各backendの承認不要な処理を次に閉じます。

## 統合実機チェックリスト（実行は最後）

開始条件：同一候補HEADの全自動検証、approved exact bytes/license/policy、30項目software audit、選定済み配布手段が揃うまで保留。
1. 一つの候補HEAD・package digest・model digestを記録。IntelとApple Siliconで同じfixture/結果表を使用。実保存曲/Backupを使わず使い捨て複製で検証。
2. Gatekeeper通常操作：取得経路・OS・CPU・表示メッセージ・署名/公証状態を記録。警告はbypassせず中断。今回未署名bundleを起動する指示ではない。
3. Native Wrapper/Helperの起動・private CPython/native/model identity・offline隔離・health・一回処理・Cancel・停止・再起動・古いprocess拒否を一回の連続sessionで確認。
4. 共通合成WAV→Demucs Vocals/Drums/Bass/Guitar/Piano/Other→Basic Pitch→MIDI。C4/E4/G4/C5/G4/C4の6音、extra/missing/分割、時間/音程、処理時間/メモリ/失敗保護をCPU別に記録。新modelを実機でdownloadしない。
5. Keystation Mini 32 MK3の録音→count-in/metronome→stop/save→reopen→再生。MIDI edit/tempo/key/meter→AI候補preview/部分採用/却下→Undo/Redoまで同じfixtureでNo.1〜10を確認。
6. No.11〜15の仮歌→録音→Take/Comp→非破壊編集→Harmony→完成比較を一続きで実施。採用済み本人同意・権利・backendが揃うまで開始しない。
7. No.18〜21のMix A/B→Master/LUFS/Peak/clip→一括WAV/Stem/MIDI→Logic Pro import/finish→Music Studio再取込を一往復で確認。直接.logicx操作は公式手段確立まで含めない。
8. No.22〜30：save/reopen/版比較/完成固定/素材再利用→Backup export→別使い捨て環境restore→故障fixture診断→offline/料金拒否/model切替→履歴検索。同じBackupを一回の移行検証に使用し原本不変を比較。
9. iPad/Safari：同じHEAD/fixtureで390/820表示、touch/選択/スクロール/file import/保存復元/通信禁止をまとめる。Simulator buildと物理Safari acceptanceは別記録。
10. 30項目それぞれ結果・CPU/OS・HEAD/digest・証拠・失敗理由を保存。PASSを再試行するのは変更/失敗がある項目のみ。

## 次に残る最短の作業

禁止操作を含まないexact-head CI経路を整備し、新Draftを安全checkpointへ検証する。
その後、No.18/19のplanned状態とNo.11〜15等の未確認backendを正式下位要件へ照合し、承認不要なpure-softwareから実コードで閉じる。
Actual assets/選定policyを未配置のまま承認・署名・実機開始に進まない。
ティアが今やる必要のある操作：ありません。Mac操作は開始条件が揃った後の一括確認に保留。
