# Resource/runtime/distribution/pre-binding contracts — 2026-10-05 JST

Fresh GitHub audit: main 552d56eafddfd192970c09f7d6278696cf8775c3; base #301 16db7aecd30313618837beaefa235bb8a3032a28 (tree eda0813c6e8dd77260b4537b13edc60e14c3edd9). 48 Open/46 Draft, every Draft mergeable, #10/#35 conflicting non-Drafts. HEAD/base/state/Draft/mergeability and current Actions queried individually. #301 run 37248459080 SUCCESS; safe checkpoint. No #302+ in initial Open list. Existing refs/main are protected from this work; new independent branch only.

## Bounded package contract

`music-studio-package-resources.js`: explicitly configured nonnegative safe integer maxPackageBytes, maxEntryCount, maxSingleBinaryBytes, maxMetadataBytes (snapshot JSON UTF-8), maxManifestEntries, maxObservedBytes. No default production limit. Missing configuration rejects through the prebinding factory; device capacity remains UNKNOWN. Existing autoBackup 4*1024*1024 is ONE metadata backup creation cutoff, not quota or a binary package limit. Storage estimate is optional/advisory and never capacityGuaranteed.

Reader rejects text UTF-8 overlimit before JSON.parse; object/count/metadata/entry/cumulative checks occur before JSON copy, byte allocation or digest. Declared sizes are safe integers and match actual bytes. Every duplicate logical entry is rejected rather than silently discounted/double-counted. Addition checks overflow. Exact JSON UTF-8 counter handles escape/surrogate/number serialization without allocating full JSON or encoded bytes, rejects cycles, accessors, sparse/non-JSON objects; cancellation callbacks sampled during counting. Writer preflights borrowed byte views and predicted digest metadata before copying/hash. Unknown package/entry/manifest extensions are preserved and included in the package bound. Digest consistency is not authenticity.

Legacy codec calls without limits stay compatible with #301 (UNBOUNDED LEGACY CONTRACT, not production-safe). New prebinding factory requires all limits and passes them through writer/reader/reload/staging. Direct #301 low-level methods are not production authorization. Caller limits are acceptance ceilings, never a guarantee of available RAM or storage. Source object/input string is already allocated before entry; ingress/file materialization must be bounded by the eventual backend/UI too.

## Memory/copy audit (source algorithm, not measured heap guarantee)

Let B=total raw bytes, J=serialized package bytes, M=metadata, S=largest binary. JS numeric array/string overhead is engine-dependent, so exact RAM/copy count cannot be guaranteed from source. The following live objects are visible in code; hidden engine/WebCrypto/backend copies are UNKNOWN.

| Phase | Visible copies/retained objects | New safety boundary |
|---|---|---|
| encode | caller B; copied S; numeric arrays B; package text J; read-back validation detached package and raw B; metadata baseline/copy M | Borrowed view/resource preflight before copying; configured ceilings |
| decode | caller text J; parsed numeric arrays B; typed bytes B; return packageText J and detached metadata M; object input has JSON roundtrip copy | text rejection before parse; object bounds before copy; entry bounds before typed arrays |
| digest | package string J + TextEncoder buffer J for marker; whole S WebCrypto entry digest; engine buffers UNKNOWN | package cap before marker encoding; per-binary cap; incremental interface separate |
| validation | original + detached snapshot M; inventory/maps; raw B retained alongside package arrays | limits/duplicates/sizes before validator/hash; no duplicate discount |
| Restore staging | input generation/raw B; baseline serialization; package read/write and parsed generation; backend buffers UNKNOWN; staged read + verified package | generation preflight before baseline/prepare; read receives limits; guarded factory requires backend quota/atomic capabilities |

Whole JSON v1 remains O(J+B) and is NOT a streaming format. No exact maximum physical heap claim. `validateChunks` is a future-compatible bounded incremental-digest interface (caller-supplied update/finish/abort); checks chunk size/cumulative observed bytes before digest update and refuses short/long/unsafe/Cancel inputs. It does not claim WebCrypto is incremental, does not replace v1 wire format, and does not choose a new package format. No arbitrary production chunk limit is chosen. Backend read must honor configured limits before returning records; existing injected fixtures do not prove production ingress bounds.

## Runtime capability matrix

`music-studio-runtime-capabilities.js` derives profiles from current paths, with per-feature requirement, presence status, fallback, source and PHYSICAL TEST REQUIRED. Package requires WebCrypto SHA-256 + TextEncoder; durable browser metadata additionally requires IndexedDB.open. IndexedDB absence has session-memory fallback but durable profile rejects. File export requires Blob + object URLs. Playback requires AudioContext or webkitAudioContext. These are presence checks, not open/digest/playback permission success.

| Capability | Feature classification / fallback |
|---|---|
| IndexedDB | REQUIRED for durable browser metadata; FALLBACK AVAILABLE session memory only |
| WebCrypto | REQUIRED package/generation; no silent digest fallback |
| Blob / object URL | REQUIRED file export; headless text result is not a downloaded file |
| File | OPTIONAL constructor; file.text/arrayBuffer input interface |
| TextEncoder | REQUIRED marker; autoBackup size fallback does not replace it |
| TextDecoder | OPTIONAL; URI/ASCII MIDI label fallback |
| AudioContext | REQUIRED playback; webkitAudioContext fallback |
| MIDI | OPTIONAL for app; external hardware recording needs physical permission/device |
| storage estimate | OPTIONAL; no capacity promise |
| file handle APIs | OPTIONAL injected resolver; byte binding/reselection fallback, no permission prompt |
| AbortController | OPTIONAL offline; reason callback; live provider transport outside scope |
| FileReader / structuredClone / Worker | Not required by current offline product paths; JSON clone fallback for structuredClone |
| native helper | External optional capability for conversion; separate distribution/health/models contract |

Missing API is UNSUPPORTED unless a specific fallback exists. All capability presence remains separate from physical test. Missing estimate/permission returns UNAVAILABLE. No API is called merely to infer support except explicitly requested advisory estimate (not used to authorize capacity).

## Distribution and Audio Helper

`music-studio-distribution-capabilities.js` machine-readable matrix is the source contract; distribution product readiness remains OPEN.

| Mode/dependency | Actual source evidence / acceptance |
|---|---|
| browser-only | Standalone page/local script closure exists; hardware/offline acceptance pending |
| local static serving | Existing browser smoke serves local assets; secure-context digest and physical origin behavior pending |
| PWA | No current service worker/cache/install manifest implementation found; UNSUPPORTED |
| native wrapper | Swift/WKWebView exists; production config opens hosted HTTPS, local startURL logic is not bundled offline distribution |
| Audio Helper | Loopback server/launcher/package exist; launcher installs pip at first run, hosted URL opens; not self-contained offline |
| Python runtime | external python3 + venv dependencies; requirements ranges are not lockfile/architecture guarantee |
| model files | Demucs/Basic Pitch runtime dependency; no complete bundled approved model inventory inferred |
| signing/notarization | workflow ad-hoc codesign --sign - + verify; not notarization or Gatekeeper acceptance |
| Intel Mac | macos-15-intel packaging configuration; six-note real-device accuracy/signing remain pending |
| Apple Silicon | native sources exist, model/runtime/device acceptance not established |

Software validators: source packaging regression verifies actual launcher/plist/workflow/requirements/native config. Health validator requires localOnly=true, pipelineRevision=2, exact expected server.py sourceDigest (unconfigured expected digest fails). Model validator verifies explicit caller inventory unique identity/safe observed size/SHA-256 within configured bounds; no model choice/download/license assumption. Synthetic model byte fixtures are not installed-model acceptance. Helper observation validator refuses unobserved Python/dependencies/models/source identity. Current mac-app launcher still only checks localOnly; source START command checks sourceDigest/revision. This integration gap remains an explicit software blocker; no Helper launch, dependency installation or Mac security bypass occurred.

## Production binding prerequisites

`music-studio-binding-prerequisites.js` exports matrix and guarded storage-neutral adapter factory. Before backend operations: limit configuration, runtime package profile, exact repository object identity, existing source/target schema 5 with explicit legacy preservation, all backend methods, declared immutableSlots/guardedCommit/atomicMetadataPublication/selectedPointer/quotaFailureAtomic capabilities. Caller declarations are prerequisites, NOT backend atomicity evidence. Factory still labels actual production binding BLOCKED/INJECTED ONLY. QuotaExceededError fails without capacity inference; Abort/Cancel/stale reject and retry uses a fresh operation. Destructive or cross-version migration fails.

| Prerequisite | Classification |
|---|---|
| binary/generation/marker stores | BLOCKED BY BACKEND |
| metadata transaction/publication | BLOCKED BY BACKEND; existing v5 metadata-only Restore implemented |
| selected pointer | BLOCKED BY BACKEND |
| exact repository identity | IMPLEMENTED guard |
| rollback/recovery | IMPLEMENTED interface/reload; backend durable evidence remains |
| explicit incomplete cleanup | IMPLEMENTED interface; no GC/retention selection |
| quota errors | IMPLEMENTABLE WITHOUT POLICY backend enforcement; adapter rejects |
| migration | IMPLEMENTED no destructive/cross-version guard |
| legacy compatibility | IMPLEMENTED metadata preservation and old codec path; full production migration unimplemented |
| A/B/C / schema and retention/GC | BLOCKED BY POLICY |
| physical capacity/interruption/reopen | PHYSICAL ONLY |

Take/audio Version/named Checkpoint production entities remain absent on fresh schema/editor search. lyrics.versions and MIDI edit/export histories remain distinct. No inferred implementation or A promotion.

## Exit gates and next shortest work

| Gate | Result |
|---|---|
| Stage 2 software/contract | OPEN |
| Production binding | BLOCKED |
| Runtime capability contract | COMPLETE (presence/profile validators); physical capability PENDING |
| Distribution capability contract | COMPLETE (source/observation validators); actual offline distribution OPEN |
| Physical acceptance | PENDING |
| Policy decision | REQUIRED |

Remaining implementable software blockers ONLY: concrete production backend + atomic repository publication/selected pointer/limited ingress integration; Helper mac-app exact runtime identity integration; self-contained offline native/Helper asset+dependency/model packaging for the eventually selected distribution; frontend bounded file-ingress/production binding. Streaming format is not required by this bounded v1 contract, but a production large-asset format would need an independently approved compatible adapter. Policy/physical are separate below.

Production blocker: no real binary/generation/marker stores or publication binding exist. Policy blockers: approved A/B/C/schema/distribution/models/license/retention/GC (none chosen). Physical blockers: Intel Mac/M1 iPad actual storage permissions/quota/power interruption/reopen; Helper signing/notarization/6-note accuracy; Keystation/Logic; Japanese/touch/UI acceptance. Stage 3 exit gate not met. Next shortest policy-neutral change: mac-app runtime identity validator integration and bounded production ingress; then approved concrete backend/distribution and physical acceptance.

## Verification

Resource/runtime regression covers exact/over limits, cumulative accounting, negative/unsafe/overflow/duplicate/size mismatch, early rejection, missing IndexedDB/WebCrypto/File APIs/optional APIs, fallbacks, no estimate/permission, unsupported profile, unavailable digest, Abort/Cancel/stale/retry, migration guards, quota rejection, guarded injected end-to-end reload, synthetic model/health verification and incremental digest abort. Existing tests preserved. Real Chrome harness retains original generation/binary/atomic/UI smoke, adds bounded resource/runtime/digest failure cases at 1440/820/390, blocks external requests and captures console/pageerror. CI process/step/job bounds and cleanup preserved. Final counts and exact-head CI are recorded in PR after verification; no local Chrome is installed and no local browser PASS is claimed.

## All 30 formal A reevaluation

A 0/30 unchanged. Each gate reevaluated against this patch: no production binding, physical acceptance or end-user quality gate newly satisfied; contract/test count is not A.

| Feature | A | One blocking requirement |
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
