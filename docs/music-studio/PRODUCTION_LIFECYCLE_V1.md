# Production lifecycle / scoped processing receipts

確認日: 2026-10-05 JST. Source: GitHub current main/Open and all-state newest PR metadata, exact HEAD Actions, repository callers and local tests. Main `552d56eafddfd192970c09f7d6278696cf8775c3`; base Draft #308 current HEAD `79741ef371ea513032d78a0834f7ac041c84036b`. Its stale PR-body HEAD was not used. At start/recheck no #309+ existed. 55 Open / 53 Draft; all Drafts mergeable; existing #10/#35 conflict. #308 current-head workflows 37291760163/37291760218/37291760193 SUCCESS. Every existing Open PR HEAD/base/Draft was reacquired; no existing PR was modified.

## Code and limits

- `local_distribution_entry.main` now calls the production lifecycle after the existing externally anchored manifest/runtime/source/assembly preflight. Only explicitly approved manifest `web:/...` assets are loaded; each is bounded and independently digest checked. Missing web entry or missing explicit `NOVA_LOCAL_BROWSER=system` blocks startup. This is an opt-in caller contract, not a new distribution/signing policy or a bundled approved asset set.
- A new owned Helper process group, random numeric 127.0.0.1 server port, per-attempt nonce/session, source/Helper identity and fresh Helper startup session checks precede browser launch. Existing Helpers are never reused or guessed/killed. Helper allows only the launcher-supplied exact local browser Origin in strict mode. Legacy paths remain separate.
- Browser bootstrap now consumes the one-shot transport and checks format/version/origin/build/manifest/config/Helper digest/session/nonce/expiry. Existing authenticated manifest/bootstrap/actualInventory verification is called before strict processing can be enabled. Replay, failure, cancellation, old Helper session and partial inventory block uploads. URL handoff fragment is removed before network bootstrap; native injection can deliver the same contract.
- Browser readiness/failure/close and heartbeat connect to lifecycle supervision. Browser callback cannot replace Helper identity/inventory evidence. Browser close beacon is best effort; a 30-second liveness timeout tears down the server/owned Helper. Pending bootstrap fetch is aborted and in-flight processing responses are epoch checked. Server invalidates nonce/envelope; Helper receives SIGTERM with existing child cleanup and bounded group SIGKILL fallback. Open browser window itself is not forcibly closed. This does not claim physical crash/power-loss acceptance.
- Swift package and Xcode root views use a strict-aware startup factory. Missing/invalid/expired local handoff or strict manifest entry cannot fall back to production HTTPS. Exact loopback origin/port navigation is retained; an ephemeral WebKit data store injects the anchored handoff before page bootstrap. Host exposes startup/load failure and stop states and forwards shutdown to browser. **Swift launching/supervising the Python process itself and an authenticated native launch-result delivery channel remain unconnected**; environment injection is an explicit integration boundary. WKNavigationDelegate contains navigation; CSP contains local page subresources. No complete native WebKit syscall isolation is claimed.
- `ProcessingReceipt` records actual invoked logical stage/function/version/source digest/architecture/fallback/native scope and completion under a bounded 256-entry budget. Soundfile input decode and Basic Pitch predict have production call sites; Demucs input conversion, actual julius resample calls when performed and the selected stem writer call have adapters. Unapproved source/version/fallback rejects before execution. Source identity is not full codec/native identity. Basic Pitch internal decoder/resample and Demucs writer dispatch/torch internals remain unresolved. The child processing receipt is not yet returned and bound into parent actualInventory. No unexecuted stage is reported as a successful call. All processing-chain completeness remains false.
- Declared Mach-O images get bounded load-command dependency observations without image/process/socket/interface enumeration or tooling subprocesses. Exact loader-relative declared child paths are checked through RTLD_NOLOAD and the existing 64 KiB streamed artifact verifier. @rpath/system/unresolved references remain unapproved/unverified; fat/ELF formats remain unsupported. Disk dependencies are not actual loader edges or mapped memory identity. Closure remains false. No transitive native inventory outside this runtime is collected.
- Existing Python remote socket/DNS/subprocess/protocol input rejection remains. Helper/Demucs/codec network capability classification is additive only; native syscalls remain UNVERIFIED. Python audit does not complete native containment. No syscall sandbox was selected or falsely enabled.
- Strict lifecycle eligibility requires trusted bootstrap, browser verification, complete Helper/model inventory, processing chain, native graph and native offline evidence. Publication additionally requires a separately bound production backend; this PR does not provide one. Real runtime processing/publication remain blocked.

## Verification

Local: node --test 1774 PASS, fail/skipped 0; JavaScript syntax and bash syntax/git diff --check PASS. Python 130 total: 125 PASS and five preexisting dependency-unavailable accuracy cases; no new skip, deletion or weakened test. 22 new JS/Python tests plus one Swift startup test. Swift/Chrome are unavailable locally; current-head CI is required. Existing CI dependencies/build/signing conventions are retained; no production model/package/binary downloaded or bundled locally. No CI result counts as Physical acceptance.

The new Chrome test exercises the real loopback HTTP transport and real browser bootstrap at 1440/820/390 with **disposable synthetic inventory and intercepted local Helper health**, not real ML/offline runtime acceptance. Existing complete UI/generation/binary/atomic tests remain. Exact-head reports must show console error/warn/pageerror and external requests zero. CI timeouts and cleanup are retained.

## Production Binding Matrix

| Component | Classification | Remaining boundary |
|---|---|---|
| launcher lifecycle | PARTIAL | Production main connected; approved assembled inputs and actual startup absent |
| local server | IMPLEMENTED | Bounded authenticated transport/one-session/shutdown; real asset set acceptance pending |
| Swift hosted entry | PARTIAL | Root entry/injection/failure/stop connected; native launcher supervision and authenticated result channel absent |
| browser envelope | IMPLEMENTED | Real caller consumes strict one-shot envelope; approved production handoff acceptance pending |
| Helper identity | IMPLEMENTED | Source/runtime/session checks; externally provisioned anchor required |
| Basic Pitch identity | PARTIAL | Loaded model receipt retained; internal audio/native chain unresolved |
| Demucs identity | PARTIAL | Resident model receipt retained; full processed child chain not parent-bound |
| decoder backend | PARTIAL | Actual soundfile call receipt; libsndfile mapped identity and Basic Pitch path open |
| resample backend | PARTIAL | Demucs julius invoked-call adapter; native implementation/version coverage open |
| encoder backend | PARTIAL | Selected Demucs writer source call; torchaudio dispatch/executable identity open |
| stem backend | PARTIAL | Retained model + stage adapters; torch/native chain and parent receipt absent |
| shared-library closure | PARTIAL | Loaded declared paths + disk dependency observations; mapped/transitive edges not proven |
| native network containment | UNVERIFIED | Python guard only; native external socket/syscalls uncontained |
| actualInventory | PARTIAL | Identity evidence and call observations; runtime complete=false |
| processing eligibility | PARTIAL | Fail-closed software gate implemented; real strict evidence incomplete |
| publication eligibility | BLOCKED BY BACKEND | Separate gate; no bound publication backend |
| assembly verifier | IMPLEMENTED | Existing verification retained; readiness blocked by actual runtime gaps |
| offline inventory | PARTIAL | Static inventory/manifest contract; approved assembled native artifacts absent |
| repository identity | IMPLEMENTED | Existing neutral identity contract retained |
| generation identity | IMPLEMENTED | Existing neutral generation contract retained |
| selected pointer | BLOCKED BY BACKEND | Concrete store/acknowledgement absent |
| atomic publication | BLOCKED BY BACKEND | Existing contract only |
| binary store | BLOCKED BY BACKEND | No storage choice made |
| generation store | BLOCKED BY BACKEND | No storage choice made |
| reload | BLOCKED BY BACKEND | Concrete committed-selected reload absent |
| cleanup | PARTIAL | New owned process/server cleanup; durable store cleanup still backend/policy blocked |
| quota | PHYSICAL ONLY | Device capacity/quota and backend errors not accepted |

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
| Native/network containment | OPEN |
| Hosted entry | OPEN |
| Processing eligibility | OPEN |
| Physical acceptance | PENDING |
| Policy decision | REQUIRED |

Remaining **pure software** blockers:
1. Bind processed Demucs child chain into the resident parent receipt/actualInventory, including actual torch inference and selected encoder dispatch/executable; intercept Basic Pitch internal decode/resample and verify selected native codec versions/artifacts.
2. Actual scoped mapped/transitive loader edges and unexpected native load detection, including @rpath/fat/ELF support where relevant. Mach-O disk commands cannot substitute for these.
3. Process/child/codec-scoped native external socket/DNS enforcement/observation. Python audit remains insufficient.
4. Connect Swift to owned launcher startup-result/failure/shutdown supervision through an authenticated native channel, including pending native requests. Current injected handoff does not establish ownership of Python lifecycle.
5. Exercise full strict eligible startup with authenticated production-shaped backend adapters; current incomplete evidence intentionally blocks it. No real eligible runtime has been accepted.

**Production backend/artifact** blockers: concrete binary/generation/selected publication and durable reload/cleanup/quota; approved model/dependency/native/web assembly and provisioned trust roots. These are not converted into software or Physical PASS.

**Physical**: Intel/Apple Silicon real Mac, iPad/Safari, Gatekeeper/notarization, native isolation, model performance, six-note Audio-to-MIDI accuracy, Logic/Keystation and durable interruption/quota remain pending.

**Policy**: storage A/B/C/schema, local model/dependency license approval, distribution/trust/signing/notarization/PKI and provider/retention/GC remain undecided. No choice made here.

Stage 3 entry gate has not passed. Shortest next engineering step: return and parent-bind actual per-processing child/backend receipts, then connect authenticated Swift launcher ownership while native containment remains independently OPEN.

## 30-feature reevaluation

Read against `COMPLETION_MASTER_PLAN_V1.md` and the current #308 retained acceptance gaps. This change touches #16/#17/#23/#25/#27 distribution/runtime boundaries. It completes no entire end-user feature. A remains **0/30**, not a claim of zero implementation or an estimated overall percentage.

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
