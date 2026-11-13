# Request-bound native/processing closure

確認日: 2026-10-05 JST。Source: current GitHub main/all Open PR metadata/all-state newest PRs and exact-head Actions; repository production callers; disposable software tests. Main `552d56eafddfd192970c09f7d6278696cf8775c3`; base Draft #309 `d268830e9b84ae39d5791499f6a99f05ba773561`, branch `feature/music-production-lifecycle-v1`, base #308 `79741ef371ea513032d78a0834f7ac041c84036b`. 56 Open / 54 Draft; all Drafts mergeable; #10/#35 retain preexisting conflicts. No #310+ at startup. #309 exact-head four Actions SUCCESS. New work is an independent branch; main and existing PRs are not changed.

## Implemented production boundaries

- `runtime_evidence.exact_mapped_path` uses RTLD_NOLOAD only on one declared artifact. Linux dlinfo reads only this handle's link_map name, without following next/previous pointers. Darwin dladdr resolves one optional authenticated `mappedSymbols` export through the same handle; the symbol is never executed. Wrong/different symbol provider is UNEXPECTED_OBSERVED. No dyld image list, process list, socket list, packet capture, home/environment inventory or implicit binary load. Private paths and addresses are never emitted. A disposable compiled test library exercises the actual loader API, separately from mocked edge cases.
- `mapped_native_receipts` binds logical/expected identities, independently streamed disk proof, mapped pathname identity, bounded ELF/Mach-O architecture, parent module and observation source. Disk VERIFIED plus mapped observation remains OBSERVED_UNVERIFIED: neither mapped bytes nor runtime parent/child routing is authenticated. Missing, unexpected, unobserved, unsupported and architecture mismatch remain distinct. Fat images and unsupported native formats stay UNSUPPORTED. `runtime_native_closure` joins declared disk dependencies to independent parent/child mapped evidence; it never converts static edges into observed loader edges. Unexpected dynamic loads outside declared handles are not detectable by this adapter. `nativeClosureComplete=false`.
- Python audit reports bounded LOOPBACK / EXTERNAL_ATTEMPT / DNS_ATTEMPT / UNKNOWN counts, never IP/host/URL/socket identifiers. Existing Python connect/DNS/sendto/model-fetch/subprocess fail-closed behavior is retained in Helper and child. Numeric loopback **connect** is also denied by the processing guard; the inbound local HTTP server is separate. These are Python events, not native syscall observations. Native observation UNVERIFIED and native containment PARTIAL, with explicit per-component gaps for Helper, child, Basic Pitch, codec and approved companion. No COMPLETE claim or policy exception.
- Per-request call collectors replace Helper-wide shared call history. Decoder/inference/MIDI-result adapters, Basic Pitch internal librosa load/resample wrappers, Demucs actual `apply_model` and soundfile writer wrappers record only invoked stages. Wrappers restore functions on success/failure; expected backend/source/version and fallback rejection stay fail closed. Same-rate Demucs processing emits explicit resample NOT_APPLICABLE. A wrapper receipt does not prove librosa internal decoder/soxr or torchaudio selected writer dispatch; these remain unresolved. The actual Demucs retained model is checked at invocation; `RuntimeInventory.retained_model` checks exact previously loaded Basic Pitch object and serialized model identity (inventory snapshots also invalidate a replaced object) without reloading. No receipt-only model load.
- `processing_binding` binds owned session/request, streamed temporary input digest/length, stable runtime inventory revision, model/codec/native/network identities. Digest-cache HIT/MISS and historical processing-call caches do not change identity. Call/native summaries are bounded and detached. `BoundProcessingReceipt` requires all decoder/resample/model/inference/stem/encoder/result stages and independently complete native/network identity. Partial child evidence is rejected. Child results carry their own inventory binding plus exact parent request binding; legacy unbound child fixture protocol remains separate and is unavailable when authenticated runtime evidence is required.
- `SessionRequestRegistry` retains bounded one-shot IDs for one owned Helper lifetime. No tombstone eviction permits replay. Reusing an ID, old session, exhausted registry, expired receipt, changed runtime/model/codec/native, partial chain, duplicate consumption, Abort/Cancel/timeout all reject. Retry requires a fresh request; new launcher/Helper uses a fresh session. Deadline and Helper session are checked before body storage and after processing. Lifecycle propagates deadline to its owned Helper. Existing browser failure/close/heartbeat cleanup remains; this does not establish hard interruption of every native computation.
- HTTP processing wires begin → actual calls/child → fresh inventory/input recheck → output digest → receipt validation/one-shot consumption → response → temporary/receipt cleanup. Partial receipt never produces success. Strict failures expose only a stable error code, avoiding private traceback/paths. Loopback fixture tests exercise complete *synthetic* receipt transport, failure, partial receipt, close, heartbeat expiry, replacement, restart, retry and cleanup. These fixtures patch the preflight gate and do not demonstrate real eligible ML runtime.
- Browser strict-local requests send fresh random request and owned session, bind input/output bytes and revalidate the returned chain before import. Epoch/session/expiry checks still reject close/reload. WebCrypto input hashing has an explicit **64 MiB strict-only cap** because it has no streaming digest API here; legacy 500 MiB ingress remains. Streaming browser hashing above this cap is OPEN, and no new dependency/policy was selected. Standalone validator tests and Real Chrome fixture assertions cover stale/partial/tampered responses. The existing native-network-receipt-adapter-unavailable browser gate is retained: claimed booleans cannot enable native processing.
- actualInventory additive `processingReceiptVersion`, mappedNativeState, nativeClosureComplete, processingChainComplete and processingBlockedBy remain distinct from identityComplete/offlineRuntimeComplete/processingEligible/publicationEligible. Actual runtime completion remains false. Assembly verifier exposes mapped, transitive, codec, network and actual-call requirements; offline presence is never runtime observation. Publication stays BLOCKED BY BACKEND.

## Validation scope

Local Node: 1,804 PASS, fail/skipped 0; all 174 JS syntax PASS. Local Python: 159 total, 154 PASS and five inherited accuracy cases need the preexisting CI dependencies and are unavailable locally. New processing-closure suite: 29 PASS. No tests are deleted, skipped anew or weakened. New software cases include actual declared-handle loader observation, wrong/missing mapped artifacts, disk/memory distinction, architecture and transitive join, network privacy/classification/unknown gate, every required processing stage, changed binding/output, one-shot retry, retained-model object reuse and HTTP lifecycle cleanup. Bash syntax and git diff --check required.

Swift/macOS/iPad Simulator and Real Chrome are unavailable locally; final exact-head CI is the source for those results. Four workflows remain required, with bounded timeouts. The Chrome lifecycle test now also runs processing-receipt assertions at 1440/820/390; existing full UI/generation/binary/atomic regressions remain. Existing CI tooling/dependency conventions are retained; no production model/binary/package download or license-unknown bundle is added. All fixture success remains SOFTWARE ONLY, never Physical PASS.

## Production Binding Matrix

| Component | Classification | Remaining boundary |
|---|---|---|
| launcher lifecycle | PARTIAL | Owned/deadline handoff implemented; approved actual startup and long-session renewal absent |
| local server | IMPLEMENTED | Bounded anchored loopback transport; actual assembled assets pending |
| Swift hosted entry | PARTIAL | Strict injection/load/stop retained; authenticated native launcher ownership channel absent |
| browser bootstrap | IMPLEMENTED | One-shot anchored/session caller retained; actual native gate intentionally closed |
| Helper identity | IMPLEMENTED | Source/session/deadline checks; provisioned trust root still required |
| Basic Pitch chain | PARTIAL | Retained-object decode/resample/inference/result adapters; native decode/inference dispatch unresolved |
| Demucs chain | PARTIAL | Child/parent processing binding and retained stem invocation; concrete runtime chain incomplete |
| decoder | PARTIAL | Actual selected callable/source receipts; internal native decoder/fallback final identity open |
| resampler | PARTIAL | Actual invoked wrappers and same-rate NOT_APPLICABLE; native backend mapping/version open |
| writer | PARTIAL | Actual selected dispatch/soundfile callable receipts; torchaudio final codec/executable linkage open |
| stem backend | PARTIAL | Exact retained model checked at apply_model; torch internal mapped backend open |
| mapped native identity | OBSERVED ONLY | Exact-handle mapped path and disk/architecture separated; mapped bytes unverified |
| transitive native closure | PARTIAL | Independent mapped/static-edge join; actual loader routing and unexpected-load coverage absent |
| native network containment | UNVERIFIED | Python audit guard only; native syscall containment/observation absent |
| actualInventory | PARTIAL | Additive independent evidence/flags; actual completion intentionally false |
| processing receipt | PARTIAL | Request/child/output/one-shot contract and HTTP wiring implemented; real complete chain absent |
| processing eligibility | PARTIAL | Fail-closed gate; real native/network/codec evidence cannot satisfy it |
| publication eligibility | BLOCKED BY BACKEND | Separate gate requires concrete production publication backend |
| assembly verifier | IMPLEMENTED | Required runtime expectations exposed; assembled presence cannot prove runtime completion |
| offline inventory | PARTIAL | Static contract retained; approved assembled native/model/web set absent |
| repository identity | IMPLEMENTED | Existing neutral identity contract retained |
| generation identity | IMPLEMENTED | Existing neutral generation contract retained |
| selected pointer | BLOCKED BY BACKEND | Concrete store/acknowledgement absent |
| atomic publication | BLOCKED BY BACKEND | Contract retained; production binary/generation publication absent |
| binary store | BLOCKED BY BACKEND | No storage policy chosen |
| generation store | BLOCKED BY BACKEND | No storage policy chosen |
| reload | BLOCKED BY BACKEND | Committed selected-generation reload absent |
| cleanup | PARTIAL | Temp/request/owned child/server cleanup; hard native abort and durable backend cleanup open |
| quota | PHYSICAL ONLY | Real device capacity/quota and backend fault acceptance pending |

## Stage 2 Exit Gate

| Gate | Result |
|---|---|
| Software/contract | OPEN |
| Production binding | PARTIAL |
| Runtime capability | OPEN |
| Distribution capability | OPEN |
| Actual offline distribution | OPEN |
| Identity chain | OPEN |
| Offline inventory | OPEN |
| Assembly readiness | OPEN |
| Native closure | OPEN |
| Native/network containment | OPEN |
| Processing chain | OPEN |
| Processing eligibility | OPEN |
| Hosted entry | OPEN |
| Physical acceptance | PENDING |
| Policy decision | REQUIRED |

Remaining pure software blockers are specifically limited to:
1. Authenticate scoped mapped-page/runtime parent-edge identities and unexpected native loading coverage, including supported ELF/fat/@rpath/system dependency resolution; exact declared handle observations are insufficient.
2. Process-tree native socket/DNS/fetch syscall observation and fail-closed containment. Current Python guard cannot supply the missing native adapter.
3. Prove concrete Basic Pitch decoder/resampler/inference and Demucs torch/writer/encoder dispatch identity. Wrappers now collect actual calls but cannot substitute for the native dispatch/backend evidence. Child wire budgets and chain evidence must be exercised with actual approved artifacts.
4. Authenticated Swift-owned launcher result/stop channel, bounded session renewal, and interruption of pending/native processing. Environment handoff and post-response checks do not complete those boundaries.
5. Bounded streaming browser input hashing above the current strict 64 MiB cap; fully eligible native receipt transport/browser verifier remains blocked until a real adapter can verify native containment, rather than accepting asserted flags.

Separate production/backend blockers: approved assembled ML/native/dependency/web assets and provisioned anchors; concrete binary/generation/selected-pointer atomic publication, reload, durable cleanup and quota adapters. No schema or A/B/C store choice is implemented.

Separate physical blockers: Intel/Apple Silicon Mac, iPad/Safari, Gatekeeper/notarization, real native isolation, real ML/performance, six-note Audio-to-MIDI accuracy, Logic and Keystation remain PENDING.

Separate policy blockers: storage/A-B-C/schema, provider/model/license, distribution/trust/signing/notarization/PKI, retention/GC. No exception or distribution/isolation scheme chosen.

Stage 3 entry: **not yet permitted by the Stage 2 gate**. Shortest next engineering step is concrete codec/native dispatch evidence through the new request/child binding, then scoped native syscall containment; Swift ownership/renewal stays a separate software boundary. No new physical actions are requested in this Work.

## 30-feature formal reevaluation

Compared against current `COMPLETION_MASTER_PLAN_V1.md` and #309 acceptance gaps. #16/#17/#23/#25/#27 receive additional software foundations, none completes the full end-user/physical requirement. A remains **0/30**; overall implementation percentage cannot be confirmed.

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
