# Runtime inventory and authenticated bootstrap — 2026-10-05 JST

Fresh GitHub evidence: main `552d56eafddfd192970c09f7d6278696cf8775c3`; base Draft #304 `b6ba1d3063153899fe0eb6ec4f7764d4afce3f55`, clean/mergeable. 51 Open / 49 Draft. All 51 current PRs individually refetched with HEAD/base/Draft/Open/mergeability and Actions; audit `verification/music-runtime-inventory-start-audit.json`. Latest all-state PR also checked before publication. #304 exact-head Actions 6 SUCCESS. No prior Work state used as evidence.

Implemented production connections: `server.py` explicit authenticated bootstrap, additive `runtimeIdentity.actualInventory` version 2, strict refusal before body read/temp storage/processing and again before response. Legacy health v1 and existing processing remain compatible and UNVERIFIED. Strict network/subprocess audit guard refuses socket connect/name lookup/Popen/system before execution. This is a Python audit guard, not OS sandbox proof or native networking containment.

Basic Pitch loader integration: authenticated runtime-config provides a confined single model file and required companions. Bounded digest and size verified before calling actual `basic_pitch.inference.Model(path)`; successful returned object recorded, runtime-visible class recorded, original object retained and explicitly passed to `predict(model_or_model_path=...)`. Manifest-bound revision identifies serialized bytes; independent embedded revision is not observed. Load exception/None, file replacement/deletion/changed stamps clear loaded evidence. No huge model repeatedly hashed: individual cap 64MiB; larger files fail closed pending an approved bounded attestation/cache contract. Stat dev/inode/size/mtime/ctime are invalidation, not a defense against a malicious OS or identical-stat in-place memory modification. Real Basic Pitch/model performance is not tested here.

Demucs remains legacy `sys.executable -m demucs.separate -n htdemucs_6s`. Strict processing is intentionally BLOCKED: no verified Demucs child/model receipt exists. Python executable exact resolved path, executable permission, bounded bytes, manifest identity and architecture can be observed at bootstrap. Version field is MANIFEST_BOUND_ONLY, not output from `--version`; subprocess/native full identity remains PARTIAL. No PATH executable is newly adopted. Unsupported model/native loaders fail closed.

Installed dependency evidence: configured important module entry file verified before import; actual imported `__file__` must resolve to that same file; exact installed package version compared. Declared native extensions must import from verified companion files. Evidence is `VERIFIED_ENTRY_FILE`, with scope `ENTRY_FILE_AND_DECLARED_NATIVE_ONLY`, never `VERIFIED_ARTIFACT`. Existing metadata inventory stays UNVERIFIED. Package/transitive artifact closure remains a software blocker, not solved by hashing every site-package. No absolute installation path, username/environment/package dump or personal-file inventory reported.

Authenticated bootstrap: external manifest digest/build anchor -> manifest asset `runtime-config` SHA-256/size -> canonical browser configuration -> expected inventory -> health/runtime comparisons. Canonical config contains `{version:1,models:[{id,path,runtimeIdentifier,companions:[{id,path}]}],dependencies:[{id,module,path,native:[{id,path,module}]}],native:[{id,path,architecture,version}],assets:[{id,path}]}`. File mappings are relative to explicit `NOVA_RUNTIME_ASSET_ROOT`; no implicit trust provisioning, PKI, default manifest or storage decision. Python config rejects duplicate keys. Browser `bootstrap` requires exact authenticated config bytes, inventory IDs, every asset mapping and native expected identity. Old `bind` remains v1 compatibility; production-shaped bootstrap requires actualInventory v2, complete closure and full package artifact evidence. PARTIAL/metadata-only/legacy fail. A fixture identity match returns identityEligible, while publicationEligible remains false until backend acknowledgement. No production caller/trust issuer configured automatically.

Offline local asset enforcement: all expected manifest assets require an explicit local mapping (including model companions/dependency native files/executable); missing/unexpected mappings rejected. Assets byte-verified with root/symlink/size/digest guards; runtime-config is itself byte-bound and rechecked. Whole-app static inventory covers tracked JS/CSS/HTML/Helper/Python/config/native sources with logical paths and digests; remote URLs reported as STATIC_REFERENCE_ONLY, not automatically proven runtime requests. pip/model-loader/subprocess markers detected. Source files classified LOCAL_SOURCE, distribution UNVERIFIED until actual assembly; no unsupported BUNDLED/BUNDLEABLE claim. Report `verification/music-offline-asset-inventory-v2.json`.

Primary upstream load API inspection (2026-10-05): https://github.com/spotify/basic-pitch/blob/main/basic_pitch/inference.py and https://github.com/facebookresearch/demucs/blob/main/demucs/pretrained.py . These are API shape references, not installed artifact/version proof.

## Offline assembly readiness

| Component | Status | Remaining |
|---|---|---|
| Repository JS/CSS/HTML/local Helper source/config | UNVERIFIED | byte inventory exists; approved complete bundle/license closure absent |
| runtime_inventory.py in CI Helper source artifact | UNVERIFIED until artifact inspected | packaging copy implemented; source-only package |
| Python interpreter | EXTERNAL REQUIRED | approved interpreter artifact absent |
| pip registry / legacy setup / hosted URLs | EXTERNAL REQUIRED | strict blocks setup/network; legacy prerequisites retained |
| ML packages/native extensions/model companions | LICENSE REVIEW REQUIRED | no redistributed unknown-license artifact |
| Distribution/trust/model/storage/retention/GC | POLICY REQUIRED | user decision intentionally not made |
| Gatekeeper/notarization/Intel/Apple Silicon/accuracy | PHYSICAL ONLY | CI/source fixture cannot accept physical behavior |

## Production Binding Matrix

| Boundary | Status | Evidence / gap |
|---|---|---|
| bounded ingress | IMPLEMENTED | existing bounded reader; strict pre-body gate added |
| Helper source identity | IMPLEMENTED | current source digest and manifest comparison |
| Helper runtime identity | PARTIAL | additive actual inventory; artifact closure missing |
| actual loaded model identity | PARTIAL | explicit Basic Pitch file/object receipt; Demucs absent |
| dependency metadata identity | OBSERVED ONLY | installed versions retained |
| dependency artifact identity | PARTIAL | entry/import/native proof only, not complete package |
| native/subprocess identity | PARTIAL | Python executable exact byte/path/arch; child receipts absent |
| distribution manifest | IMPLEMENTED | external anchor validator; actual distribution absent |
| browser expected identity | PARTIAL | authenticated v2 config adapter; trusted production caller absent |
| offline asset inventory | PARTIAL | local mappings enforced; full runtime/transitive closure absent |
| repository identity | IMPLEMENTED | prior exact prebinding contract retained |
| generation identity | IMPLEMENTED | prior exact prebinding contract retained |
| selected pointer | PARTIAL | injected acknowledgement only |
| publication eligibility | PARTIAL | identity eligibility separated; backend acknowledgement required |
| atomic publication | BLOCKED BY BACKEND | concrete transaction/store absent |
| binary store | BLOCKED BY BACKEND | no store created |
| generation store | BLOCKED BY BACKEND | no store created |
| commit marker | BLOCKED BY BACKEND | real atomic transaction absent |
| reload | PARTIAL | existing backend-neutral verifier, no concrete backend |
| cleanup | PARTIAL | existing neutral interface only |
| migration | BLOCKED BY POLICY | schema/store choice not made |
| quota handling | PARTIAL | bounded resources; concrete backend capacity handling absent |

## Stage 2 exit gate

| Gate | Result |
|---|---|
| software/contract | OPEN |
| production binding | BLOCKED |
| runtime capability | OPEN |
| distribution capability | OPEN |
| actual offline distribution | OPEN |
| identity chain | OPEN |
| offline inventory | OPEN |
| physical acceptance | PENDING |
| policy decision | REQUIRED |

Stage 3 gate not met. Pure software blockers: (1) Demucs real loaded model/companion receipt in bounded offline child path, (2) scoped complete package/native/transitive artifact inventory, (3) v2 actual inventory aggregation and production bootstrap caller handoff, (4) runtime external/native closure including network containment beyond Python audit, and (5) offline assembly verifier using approved artifacts. Backend-dependent code: concrete atomic selected publication/commit acknowledgement/reload/cleanup/quota after approved backend. Separate policy blockers: storage/schema/distribution/model/license/trust provisioning/retention/GC. Separate physical blockers: Gatekeeper/notarization/Intel/Apple Silicon/six-note accuracy/Logic/Keystation/iPad permissions/offline/reopen/quota/UI. Next shortest software step: implement a local Demucs child receipt against exact loader version/verified repository files, without downloads or storage decision.

## All 30 reevaluation


A 0/30. Each formal gate below remains unmet; identity validators and synthetic PASS do not promote end-user features to A. Features 16/17/23/25/27 gain verified contracts, not end-user acceptance.

| Feature | A | Remaining formal gate |
|---|---|---|
| 1 MIDI・Track編集 | no | Mac/iPadの物理操作、全対象Trackの一貫性確認 |
| 2 MIDI録音 | no | Keystation接続・切断・権限・音と入力遅延、途中Tempo/拍子の実演奏、保存再開を物理確認 |
| 3 曲構造・音楽情報 | no | 音源に基づくBPM/Key/Scale/拍子解析、セクション解析の品質、全曲Transpose整合 |
| 4 AI新曲スタート | no | 文章/歌詞を理解してBPM/Key/コード/メロディ/構成/編成を提案する実用Model、品質評価、楽器内容 |
| 5 AI制作アシスタント | no | 普通の会話の理解、機能呼出し、複数依頼の計画、次工程・完成までの支援 |
| 6 AI安全編集・変更管理 | no | 特定変更Undoの競合処理を含む全制作領域への拡張 |
| 7 AI作曲・曲展開 | no | 実用の続き/2番/ラスサビ/Intro/Interlude/Outro/時間指定/部分再生成、構成と範囲mapping policy、共通再生成execution |
| 8 AIアレンジ支援 | no | Destination binding、書込互換、保存policy、楽器/音符生成、Applyは未確定 |
| 9 AIコード支援 | no | 実音楽コード解析、自動コード、追従補正、Voicing、コード別案の品質 |
| 10 AI歌詞・メロディ制作 | no | 本文生成/修正、文字数・読み・アクセント・音節割付、固定歌詞/固定メロディの実再生成、重複歌詞occurrence・persisted rebinding・競合/履歴・保存policy |
| 11 AI仮歌・対話修正 | no | メロディ＋歌詞→仮歌、聴きながら部分修正 |
| 12 ボーカル録音 | no | WAV入力確認/monitor/Latency/Punch/Cycle/Take/Comp/歌詞スクロール、Mac/iPad permissionsと音声保存 |
| 13 ボーカル編集 | no | 波形＋歌詞＋音符同期、Pitch/Timing/長さ/Crossfade/Breath/Vibrato、非破壊編集とUndo |
| 14 ボーカル生成・Harmony | no | Local/Online Model・License・本人同意・品質・保存契約 |
| 15 ボーカル完成チェック | no | 11–14の音声/Take契約後に比較と判断支援 |
| 16 Stem Separation | no | 6音声stemの品質・回収・制作資産としての保持/再開、Intel package署名/配布・物理動作、Model/License |
| 17 Audio-to-MIDI | no | 最優先：Intel MacでC4/E4/G4/C5/G4/C4の6音再検証 |
| 18 AIミックス支援 | no | Volume/EQ/Compression/空間/衝突/可聴性/複数Mix比較、音声DSP/Model選定、非破壊Mix version |
| 19 AIマスタリング | no | 複数Master、LUFS/Peak/Clipping/最終音量、正しい音声計測・renderと品質評価 |
| 20 Logic Pro往復連携 | no | 完成WAV/Stem再取込、差分・対応管理、受渡し前検査の統合 |
| 21 最終書出し・配信 | no | Master WAV/Instrumental/音声Stem/MIDI一括export、manifest、配信前音量/権利/漏れ検査 |
| 22 保存・曲バージョン | no | 名前付きCheckpoint、候補版/A-B比較、複数Version部分合成、競合と保存互換 |
| 23 Backup・復旧・移行 | no | adapter/codecと隔離復旧は実装。production binding・別Macの実復旧が残る |
| 24 診断・安全修復 | no | 全体性能原因診断、安全軽量化、修復可能範囲/同意/transaction |
| 25 AI実行環境・作品保護 | no | 完全Local/Project単位外部禁止の実行境界、送信内容提示、Intel/Apple Siliconの処理別capacityとModel選定 |
| 26 AI料金管理 | no | 料金事前表示、月額上限、Provider別使用量、予約/失敗/Cancel計上 |
| 27 AIモデル管理・互換性 | no | 真のProvider交換、軽量Model、速度/品質、旧版、更新前fixture test、Model license/versionの互換契約 |
| 28 スマートUI | no | 不要機能OFF、作業別UI、お気に入り、自然言語から画面表示、physical touch/Japanese glyph/a11y確認 |
| 29 素材・テンプレート | no | 曲/部分素材保存、曲に合わせるKey/BPM調整、文章検索 |
| 30 完成版・制作履歴 | no | 完成版固定、完成曲検索、Session/日次/時系列をつなぐ履歴 |
