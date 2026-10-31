# Native runtime verification v1

確認日：2026-10-05 JST。Source: GitHub current REST branch/PR/head Actions; `verification/music-native-runtime-start-audit.json`. Main `552d56eafddfd192970c09f7d6278696cf8775c3`; base Draft #306 `c774e9191cd60a3642854cd61d5f0a05c21fe6e5` (Draft/Open/mergeable, 6 head Actions SUCCESS). All 53 Open PRs (51 Draft) reacquired individually; #10/#35 conflict, historical #298 has a cancelled diagnostic, latest #306 safe checkpoint. All-state latest #306; no #307+ at start. No existing PR/main/user song/backup changes.

## Implementation and trust boundaries

`artifact_verification.py`: 64 KiB bounded streaming SHA-256, hard 8 GiB per artifact, regular-file/descriptor/path identity checks, Abort/Cancel before reads and cache return, reader cleanup, no result on partial/failing read. Cache key includes logical identity, expected digest/size, artifact version, source build, algorithm version and local path. Stat identity (device/inode/size/mtime/ctime) only invalidates previously hashed process-local receipts; it is not evidence by itself. Corrupted/copied/partial/stale cache entries rehash. No serialized/disk cache is trusted or written, no cache schema/retention policy is chosen. New process hashes once again; privileged mutations able to falsify all file identity are outside this software cache contract. Unknown algorithm fails, never reuses a prior receipt. Capacity is bounded. Successful evidence reveals logical IDs only.

Runtime model/companion verification and scoped closure reuse the verifier. Scoped graph limit: 4,096 declared files, 16 GiB total, 8 GiB/file; authenticated graph/evidence documents have bounded 1 MiB readers. Parent/child model loads still recheck prior stamps. Cache implementation is authenticated with the existing uncached trust-root verifier before strict source startup/launcher import. There is no model/package/binary downloader in the new implementation.

`runtime_evidence.py`: externally authenticated `runtime-evidence.json` asset; exact build/architecture, explicit package namespaces, logical import/native identities, expected source/digest/size/version and codec native IDs. It never enumerates installed packages, system libraries/processes/interfaces/home directories. Source byte evidence, extension entry evidence, observed ExtensionFileLoader load, and metadata-only/shared-library evidence are separate. A single extension entry is never reported as the entire package/library footprint. A framework/shared library/executable with only file bytes cannot pass observed native closure. Scoped complete extension/import fixtures prove only declared namespaces, never unknown dlopen/syscall/transitive runtime paths.

Scoped meta-path import guard rejects undeclared/missing/wrong module resolution within the declared namespaces. Python source loader compiles the exact bounded authenticated bytes rather than reopening through ordinary source/pyc loading. Snapshot also checks cached/preloaded modules, source mismatches and unexpected modules within scope. This does not intercept every native loader or unrestricted importlib bypass outside declared scope. Unconfirmed namespaces/native loads keep overall complete=false. The child runtime-evidence contract digest is independently derived and parent-bound; wrong/missing/overstated child evidence is rejected.

Real-code audit: Helper `spec_from_file_location` bootstrap, `RuntimeInventory.observe_dependency(importlib.import_module)`, conditional numpy/soundfile/librosa/mido/Basic Pitch imports; Demucs child imports pretrained/repo at actual checkpoint load and separate/torch/torchaudio/audio at process. No dynamic import(), eval/new Function/script injection/plugin discovery site found in owned `music-studio*.js` by this scan. This is a source observation, not proof that third-party JS/Python/native artifacts have no dynamic behavior. Basic Pitch Model backend selection and its transitive ML native libraries are not installed/observed here. Declared requirements are ranges, not pinned observed artifacts.

Scoped candidates: Python executable (existing file/architecture binding); numpy extensions, torch/libtorch, torchaudio native backend, scipy/librosa resampling/analysis and soundfile/CFFI/libsndfile decode/encode. Actual extension/shared-library filenames, loaded versions, architecture and library closure cannot be confirmed without the approved local runtime. Their production status remains UNVERIFIED/EXPECTED_ONLY, not invented observed identities. Native library load guards/receipts beyond ExtensionFileLoader remain OPEN.

Codec adapter accepts existing local files only and rejects URL/protocol inputs. Exact soundfile version is required; strict Helper melody refinement refuses librosa fallback. The resident-child decoder can take the explicit soundfile adapter rather than torchaudio dispatch; no external FFmpeg/PATH fallback is allowed in the child. Existing legacy behavior is preserved. Basic Pitch's internal decoder, drum analysis/resample, stem encoder/save_audio backend and libsndfile's actual dlopen dependencies still require integration/receipt. Because native network evidence remains UNVERIFIED, strict processing cannot reach those unresolved paths. This is not an end-user codec completion claim.

Python audit adds UDP sendto rejection to connect/DNS/system/exec/spawn/fork/exact-child Popen checks. Offline fixtures test socket/urllib/model URL attempts, curl/codec subprocess and UDP. Native socket syscalls/CFFI/library URL fetch are not constrained by Python auditing; no configuration can assert otherwise. Overall runtime complete, processingEligible and publicationEligible remain false. Backend acknowledgement is also absent.

actualInventory v2 is additive: `identityComplete`, `runtimeClosureVersion`, `runtimeEvidence` (native/dynamic/codec/network/large-artifact/cache evidence). Existing identity-only aggregation remains compatible; the real Helper snapshot upgrades it and cannot expose overall VERIFIED/complete while native network closure is unknown. Runtime verification evidence is separately added to parent inventory. Child receipt extends v1 additively; all scoped child entry receipts are digest-bound in bounded summaries (counts/status counts/digests), preserving the existing wire budget without dropping observations or claiming independent signatures. Browser's authenticated bootstrap also binds the evidence asset digest, rejects omitted/unknown/incomplete native evidence, and refuses asserted native enforcement because no authenticated native-network receipt adapter exists. Existing no-extension clients remain compatible; no legacy upload fallback. Evidence JSON is canonical and externally anchored.

Assembly checker keeps `artifactAssemblyComplete` distinct from overall `complete`/`assemblyReady`; required runtime/codec/network evidence and local executable are exposed, and CLI exits 2 if incomplete. Existing positive manifest-file-link test retains its artifact assertion and adds strict overall rejection. It does not install/bundle or grant licenses.

`local_distribution_entry.py`: externally supplied manifest/anchor/build/root -> authenticated cache/source checks -> runtime config -> approved artifact assembly -> exact local Python/server command. Returns the correctly shaped envelope for the existing browser bootstrap caller; strips PYTHON*/NOVA* ambient environment overrides before explicitly supplying the anchored runtime values. Mac app strict branch runs before rsync/install/health reuse/hosted browser open; source strict branch runs before legacy installer/network health calls. No distribution/signing/storage policy is selected. No local static server/browser envelope supplier or Swift hosted-wrapper replacement is claimed: this is a prepared local entry adapter, not a completed standalone browser distribution. Native/network runtime acceptance is still required before processing/publication.

## Verification scope

Local node --test: 1,764/1,764 PASS, fail/skipped 0. All 172 JavaScript syntax checks PASS. Python: 108 tests, 103 PASS, five preexisting audio accuracy tests unavailable because soundfile/mido are absent locally; no dependency/model downloads or substituted tests were run locally. The inherited macOS test environment runs those real lightweight tests separately. New Python regressions: 39. New Node native evidence regressions: 3. Chrome fixture adds 8 native-evidence negative cases per width to the existing 240, expected total 264. Actual exact-head CI/browser results belong to the final PR report, not this anticipated count. Bash syntax and diff whitespace checks PASS.

All original assertions/tests/cleanup/timeouts are retained. The existing assembly manifest-link positive assertion now checks artifactAssemblyComplete and additionally rejects incomplete overall assembly. The new launcher fixture compares exact resolved paths to account for macOS /var -> /private/var aliasing.

## Production Binding Matrix

| Component | Evaluation | Remaining boundary |
|---|---|---|
| bounded ingress | IMPLEMENTED | Existing limits and zero-write rejection retained |
| Helper identity | IMPLEMENTED | External trust provisioning separate |
| Basic Pitch receipt | IMPLEMENTED | Retained successful model object; approved real backend not observed |
| Demucs receipt | IMPLEMENTED | Resident actual-load hook/live receipt; real ML acceptance pending |
| native closure | PARTIAL | Scoped extension/source evidence implemented; shared-library dlopen/codec/ML native scope unconfirmed |
| dynamic import closure | PARTIAL | Allowlisted resolution/exact source execution/snapshot; actual transitive runtime scope not supplied |
| codec identity | PARTIAL | Local soundfile version/source/native-ID contract; all processing/encoding backends not connected |
| network containment | PARTIAL | Python/exact-child/UDP enforced; native syscalls UNVERIFIED |
| large artifact verification | IMPLEMENTED | Bounded digest plus expected identity and cancellation, 8 GiB/file |
| verification cache | IMPLEMENTED | Process-local digest receipts, exact invalidation; no durable trust cache |
| actualInventory v2 aggregation | IMPLEMENTED | Overall incomplete if unresolved runtime/native evidence |
| bootstrap caller | PARTIAL | Existing browser caller, correctly shaped local envelope; transport/supplier remains |
| assembly verifier | IMPLEMENTED | Artifact/runtime readiness split; strict failure on absent evidence |
| local wrapper/launcher entry | PARTIAL | Source/Mac strict preflight; local web serving/browser handoff/Swift wrapper integration remains |
| offline inventory | PARTIAL | Owned source/static references; assembled runtime is absent |
| repository identity | IMPLEMENTED | Existing exact backend-neutral linkage |
| generation identity | IMPLEMENTED | Existing adapter/codecs retained |
| selected pointer | BLOCKED BY BACKEND | No selected concrete store |
| publication eligibility | PARTIAL | False until software/runtime and backend acknowledgement complete |
| atomic publication | BLOCKED BY BACKEND | Existing fixture contracts retained |
| binary store | BLOCKED BY BACKEND | No store chosen/created |
| generation store | BLOCKED BY BACKEND | No store chosen/created |
| commit marker | BLOCKED BY BACKEND | Fixture contract only |
| reload | BLOCKED BY BACKEND | No concrete production selected acknowledgement |
| cleanup | BLOCKED BY BACKEND | No real user deletion/retention decision |
| migration | BLOCKED BY POLICY | No destructive schema/storage choice |
| quota handling | BLOCKED BY BACKEND | Actual device quota remains PHYSICAL ONLY |

## Stage 2 Exit Gate

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
| Native/network containment | OPEN |
| Physical acceptance | PENDING |
| Policy decision | REQUIRED |

Remaining pure software blockers only:
1. Exact production scoped native/dynamic closure coverage and observed shared-library/dlopen receipts for Basic Pitch, torch/torchaudio, numpy/scipy/librosa and soundfile/libsndfile; approved artifact availability is a separate input/policy dependency.
2. Runtime-scoped native network containment/observation that cannot be bypassed by ML/native libraries, plus deterministic decoder/resample/encoder/stem backend integration and fallback rejection. Python guard does not satisfy this gate.
3. Local web serving/anchored browser-envelope handoff, Swift/native-wrapper hosted-entry integration and end-to-end approved assembly identity linking. Signing/distribution/trust provisioner choices remain policy rather than software.

Safe large artifact verification/cache is implemented and no longer a contract-only blocker within the stated bounds. Persistent cross-process cache trust is deliberately not selected. Large verified fixtures are not model load/performance acceptance.

Production blockers: real atomic selected publication, binary/generation stores, commit/reload/cleanup/quota after backend selection; frontend transport to the local entry.
Policy blockers: approved model/package licenses/artifacts, backend/schema/storage, trust provisioning/signing/distribution, provider/model/retention/GC choices.
Physical blockers: Gatekeeper/notarization, Intel and Apple Silicon actual ML, six-note accuracy, Logic/Keystation/iPad, real quota/power-loss. No physical PASS follows from CI.
Stage 3 cannot pass its entry gate yet. Shortest next software step: add a bounded source-to-native-load receipt for the actual soundfile/libsndfile and model backend paths, then deterministic native codec integration while strict publication stays blocked.

## All 30 formal reevaluations

A remains **0/30**. Source is the current master plan (2026-09-30 final specification mapping), existing feature code and tests. No new end-user capability completed every save/failure/restart/physical gate. No estimated implementation percentage is claimed.

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
