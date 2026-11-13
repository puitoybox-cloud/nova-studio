# Demucs resident receipt / scoped closure checkpoint — 2026-10-05 JST

Fresh GitHub audit: main `552d56eafddfd192970c09f7d6278696cf8775c3`; base Draft #305 `e468e5dac3d3d5aae3ee0dfd78c11d79522524f4`, clean/mergeable, exact-head CI 6/6 SUCCESS. Individually reacquired all 52 Open PRs (50 Draft): HEAD/base/Draft/Open/conflicts and head Actions in `verification/music-demucs-closure-start-audit.json`. Latest all-state PR #305; no #306+ at start. No preexisting PR/main changed.

## Runtime changes

`demucs_child.py` is a resident adapter for official Demucs v4.0.1 (`demucs/pretrained.py`, `repo.py`, `states.py`, `separate.py`; https://github.com/facebookresearch/demucs/tree/v4.0.1/demucs). The real LocalRepo checkpoint load hook records only files actually deserialized successfully. Local repository files are exact declared `.th` and `.yaml` assets; remote repository fallback is not used. A failed checkpoint/model/CPU/eval step produces no successful load receipt. Receipt model revision is **manifest-bound serialized-byte evidence**, not a fabricated embedded model revision. Model object remains alive in the child and the same object is supplied to `separate.get_model_from_args` at processing. Strict decoder uses torchaudio directly and removes the FFmpeg/PATH fallback. Actual torchaudio native codecs/network behavior is not certified by Python auditing.

Receipt v1 carries format, request nonce, LIVE_CHILD lifetime, result status, worker source digest/build/Python/architecture, observed Demucs loader version/source binding, loaded model identity/companions, independently observed child Python executable and bounded scoped closure. Parent derives expected fields from authenticated distribution/config and rejects mismatches. Parent launches one exact manifest-verified Python executable and worker command with `-I`; no PATH resolution. Missing/partial/wrong/stale/failed receipt, timeout, crash and dead child fail closed; terminate/wait/kill cleanup and retry are tested. Native executable version is MANIFEST_BOUND_ONLY, not independently probed. Unsupported companion executables are rejected.

`scoped_closure.py` verifies an authenticated explicit graph: direct/transitive edges, reachability, no cycles/unexpected nodes, file digest and aggregate digest, size/budgets and exact installed distribution RECORD footprint/version. Only approved declared artifacts are inspected; no scan of all site-packages. Maximum 128 nodes, 4096 files globally, 64 MiB/file, 256 MiB verified total; oversized real ML artifacts remain blocked until a safe bounded cache/precomputed mechanism is implemented. Full package status requires exact declared installed footprint; entry-only and metadata evidence are never promoted. Successful byte-verification stat stamps feed both runtime rechecks, including native/package files, and invalidate on exact file changes. Graph completeness proves the **supplied scoped graph**, not every possible lazy/dynamic/native import. Proven production transitive graph and import/native resolution coverage remain software work.

Strict Helper startup authenticates the graph footprint **before ML/native imports**, loads Basic Pitch, launches resident Demucs and aggregates health actualInventory v2. `inventory_aggregation.py` binds model/version/architecture/native/closure plus actual imported dependency entry evidence. `complete` refers to identity evidence. `processingEligible` and `publicationEligible` remain false: native-network containment and backend acknowledgements are not supplied. Therefore production strict upload/process/publication remains fail closed, even with a COMPLETE fixture. Legacy runtime remains UNVERIFIED and compatible. A missing expected trusted identity never enters VERIFIED mode.

Browser `MusicStudioAudioPipeline.bootstrapIdentity(envelope, controls)` is an explicit production-shaped caller: externally supplied manifest/trust/runtime-config → authentication → Helper health → complete/inventory/processing checks → configuration. Pending/failed bootstrap cannot fall through legacy upload. Abort/Cancel/stale/retry are tested. This does not choose a production trust provisioner or fetch secrets. An envelope supplier/application distribution entry point remains a policy-bound production integration.

`verify_assembly` and `scripts/music-offline-assembly-verifier.py --root ... --manifest ... --anchor ... --build ...` check only supplied artifacts and required manifest identities. Output: PRESENT_VERIFIED / PRESENT_UNVERIFIED / MISSING / EXTERNAL_REQUIRED / LICENSE_REVIEW_REQUIRED / POLICY_REQUIRED / PHYSICAL_ONLY. CLI exits 2 on incomplete/authentication failure, prints logical IDs only, never downloads/installs/bundles. Approved license status must come from authenticated graph; a byte match is not license approval. No real approved artifact set was supplied, so actual assembly readiness remains OPEN.

Python audit guards reject connect/DNS/system/exec/spawn/fork and unexpected Popen; parent has a thread-scoped single-use exact-command permit. Child permits no subprocess. This is explicitly not an OS sandbox: native socket syscalls, dynamic-library resolution, native codec dependency closure remain UNVERIFIED and cannot be overridden by config. No OS-wide sandbox, new storage, migration or trust/distribution choice was introduced.

## Offline reference closure

The original 46 references were reclassified in `verification/music-offline-inventory-closure-v1.json`: development-only 33, documentation/placeholder/type/CORS references 5, optional explicit browser navigation 2, policy-dependent providers/legacy installer 3, runtime loader/native/hosted-wrapper obligations 3. Static references are not observed requests. No unproved dead-reference claim is made. Additional new adapter references and requirements declarations are scoped separately; final counts are in that JSON. The hosted Swift wrapper start URL is a genuine local-distribution integration blocker. Registry installation belongs to the legacy installer, optional live provider paths remain policy-dependent, and unknown-license model/packages are not bundled.

## Production Binding Matrix

| Component | Evaluation | Boundary |
|---|---|---|
| bounded ingress | IMPLEMENTED | Existing fail-closed limits |
| Helper identity | IMPLEMENTED | Externally anchored source contract; provisioning separate |
| Basic Pitch loaded model | IMPLEMENTED | Successful retained-object load; actual approved bytes not supplied |
| Demucs loaded model | PARTIAL | Real LocalRepo hook / same retained object; fixture tested, approved real model run outstanding |
| Demucs child receipt | IMPLEMENTED | Exact binding / live lifetime / timeout / crash cleanup |
| dependency closure | PARTIAL | Graph and RECORD verifier implemented; proven production transitive/dynamic/native scope outstanding |
| native companion identity | PARTIAL | Exact Python executable; native dylib/codec closure and independent version outstanding |
| actualInventory v2 aggregation | IMPLEMENTED | Identity complete separated from process/publication eligibility |
| production bootstrap caller | PARTIAL | Explicit authenticated caller implemented; trusted envelope supplier unresolved |
| offline network enforcement | PARTIAL | Python audit enforced; native socket/dylib enforcement unresolved |
| assembly verifier | IMPLEMENTED | Offline approved-set checker; no bundling |
| offline asset inventory | PARTIAL | Owned-source/static refs classified; assembled native runtime not supplied |
| repository identity | IMPLEMENTED | Backend-neutral exact linkage |
| generation identity | IMPLEMENTED | Existing codec/adapters |
| selected pointer | BLOCKED BY BACKEND | Injected fixture adapter only |
| publication eligibility | PARTIAL | Runtime/native/backend gates explicit; no production acknowledgement |
| atomic publication | BLOCKED BY BACKEND | Backend-neutral tests retained |
| binary store | BLOCKED BY BACKEND | No store chosen/created |
| generation store | BLOCKED BY BACKEND | No store chosen/created |
| commit marker | BLOCKED BY BACKEND | Fixture contract only |
| reload | BLOCKED BY BACKEND | Fixture selected acknowledgement only |
| cleanup | BLOCKED BY BACKEND | Fixture eligibility; no real deletion |
| migration | BLOCKED BY POLICY | No destructive migration/schema choice |
| quota handling | BLOCKED BY BACKEND | Existing preflight/fixtures; actual quota PHYSICAL ONLY |

Backend-neutral publication contracts/regressions are retained; no additional store or publication mutation was added this checkpoint.

## Stage 2 exit gate

| Gate | Status |
|---|---|
| Software/contract | OPEN |
| Production binding | BLOCKED |
| Runtime capability | OPEN |
| Distribution capability | OPEN |
| Actual offline distribution | OPEN |
| Identity chain | OPEN |
| Offline inventory | OPEN |
| Assembly readiness | OPEN |
| Physical acceptance | PENDING |
| Policy decision | REQUIRED |

Pure software blockers are narrowed to: (1) verified real production dependency/native/dynamic-import closure and native network/codec containment within the runtime path, (2) safe large-model byte evidence/cache beyond current conservative bounded limit, (3) local wrapper/launcher entry and complete approved-set assembly identity linking under the selected distribution contract. Resident receipt/validator, graph verifier, health aggregator, explicit browser caller and assembly checker are implemented, not remaining contract-only blockers. Real ML load/performance validation requires approved local artifacts and physical acceptance; it is not counted as fixture PASS. Backend: concrete atomic selected publication/stores/commit/reload/cleanup/quota after backend choice. Policy: backend/schema, trust provisioning, distribution, model/package license approval, retention/GC. Physical: Gatekeeper/notarization, Intel/Apple Silicon, six-note accuracy, Logic/Keystation/iPad, real quota/power loss. Stage 3 cannot yet pass its gate. Next shortest software step: resolve/audit exact native decoder/library imports and enforce their local/offline boundary without claiming Python audit is native containment.

## All 30 reevaluation

Formal A remains **0/30**. Each feature was reevaluated against the same unmet formal gates below. Receipt/closure fixture success does not promote end-user acceptance.

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
