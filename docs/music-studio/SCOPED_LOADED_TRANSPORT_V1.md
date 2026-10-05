# Scoped loaded-library receipts and local envelope transport

確認日: 2026-10-05 JST. Sources: freshly reacquired GitHub main/Open PR/all-state latest/each PR metadata/head Actions, repository production sources, and exact-tree tests. Main: `552d56eafddfd192970c09f7d6278696cf8775c3`. Base Draft #307: `8317535ffe327f8437f39827f836d3c893ce98d9`. Start: 54 Open / 52 Draft; all Drafts mergeable, #10/#35 conflicts. Latest all-state #307; no #308+ at start. #307 three head workflows SUCCESS. Other current-head workflows SUCCESS except inherited #298 cancelled diagnostic; #10/#35 have no returned PR workflow runs.

## Implemented scope

- Exact declared local shared-library/framework path RTLD_NOLOAD probing on Linux/macOS. No image enumeration, process/socket/interface inventory, install-root reporting or ordinary dlopen fallback. Temporary loader reference explicitly closed. Receipt reports logical ID, parent module, declared origin/version, observed load status, separate streamed artifact digest and architecture/mapped-integrity UNVERIFIED. Unsupported platforms remain UNSUPPORTED. RTLD_NOLOAD presence is **not** evidence of mapped-byte integrity, architecture, library version or transitive dependencies.
- Helper and resident child observation reuse the existing authenticated runtime-evidence source. v2 inventory gains shared-library observations, logical dynamic-native graph and offlineRuntimeComplete=false. Parent/child edges remain EXPECTED_ONLY / runtimeObserved=false until actual edge evidence exists; observed child presence is separately tracked. Bounded child summaries digest-bind new entries/edges. Existing artifact verifier/cache unchanged.
- Python audit counts socket creation/connect/DNS/sendto and subprocess attempts, without arguments/hosts/paths. Existing processing-plane connect/DNS/UDP/subprocess rejection retained. Helper health exposes this scoped state; nativeNetworkVerified=false. A localhost **transport** adapter is separate from the strict **processing** guard, which continues rejecting even Python loopback connect. No native syscall firewall is claimed.
- Explicit local HTTP transport adapter: numeric 127.0.0.1 only, controlled/random port, immutable SHA-256 checked bounded assets, no directory traversal/listing or remote fallback. Host and Origin bound, externally supplied build/manifest/runtime-config/Helper digest anchors checked, session/nonce expire and consume once, replay rejected, shutdown/retry lifecycle. Anchors are supplied by caller; this adapter does not decide trust provisioning. It is not called automatically by launcher/main and does not complete browser expected-identity/health/inventory eligibility handoff. Full manifest schema/health validation remains with existing trusted bootstrap.
- Explicit Swift loopback hosted navigation factory binds scheme, numeric host and exact port, refuses remote hosts/missing port/credentials. Existing production HTTPS configuration is retained. This factory is navigation containment; server/Helper startup, anchored envelope ingestion, shutdown and errors are not integrated into Swift entry.

No actual approved Basic Pitch/Demucs/native runtime assembled here. Decoder/resample/encoder/stem identity remains partial or unverified. No ML/native backend identity is invented. Strict processing/publication remains false. No storage, distribution, signing, notarization, PKI, license, model, retention/GC or provider policy chosen.

## Validation

Local node --test 1764 PASS, fail/skipped 0. All 172 JavaScript syntax PASS. Python 116 total: 111 PASS, five **preexisting** accuracy tests unavailable in this dependency-free runtime; no existing tests deleted/skipped/weakened. New tests: eight. Native test uses a separately loaded stdlib _ssl entry only when available; statically linked local Python proves built-in origin and supplies no actual shared-artifact observation. Mac CI is needed for the dynamic extension path. Existing streaming/cache, native/import/codec/launcher and HTTP regressions retained. Bash syntax and git diff --check PASS. Swift compiler and Chrome are absent locally: exact-head CI results must be checked separately; do not substitute #307 evidence. Test source has no external AI/provider/model/package download.

## Production Binding Matrix

| Component | Status | Remaining boundary |
|---|---|---|
| Helper identity | IMPLEMENTED | External anchor provisioning |
| Basic Pitch receipt | IMPLEMENTED | Approved real inference backend acceptance |
| Demucs receipt | IMPLEMENTED | Approved real child/model/backend acceptance |
| shared library closure | PARTIAL | Exact declared path presence + disk digest; mapped bytes/architecture/transitive coverage unknown |
| dynamic native closure | PARTIAL | Logical expected graph; actual loader edges absent |
| network containment | PARTIAL | Python rejection/observation; native syscalls UNVERIFIED |
| decoder identity | PARTIAL | Existing explicit soundfile path; Basic Pitch internals/native codec unresolved |
| resample identity | UNVERIFIED | Actual selected backend/receipt not connected |
| encoder identity | UNVERIFIED | Actual selected stem/write backend not connected |
| stem backend identity | PARTIAL | Child model/load receipt; torch/audio process chain unresolved |
| large artifact verification | IMPLEMENTED | Existing 64 KiB/cache/exact invalidation retained |
| actualInventory | PARTIAL | Additive software evidence; runtime completeness false |
| assembly verifier | IMPLEMENTED | Readiness remains fail closed |
| local web serving | PARTIAL | Explicit tested adapter, production caller/assets handoff absent |
| browser envelope | PARTIAL | Anchored one-shot transport; actual browser consumption/health/inventory linking absent |
| Swift/hosted entry | PARTIAL | Explicit exact-origin factory; lifecycle/envelope integration absent |
| launcher integration | PARTIAL | Existing preflight; transport orchestration absent |
| offline inventory | PARTIAL | Approved assembled native distribution absent |
| repository identity | IMPLEMENTED | Existing contract retained |
| generation identity | IMPLEMENTED | Existing contract retained |
| selected pointer | BLOCKED BY BACKEND | Concrete store absent |
| publication eligibility | PARTIAL | Always false pending full software/native/backend evidence |
| atomic publication | BLOCKED BY BACKEND | Backend-neutral contract only |
| binary store | BLOCKED BY BACKEND | No storage choice made |
| generation store | BLOCKED BY BACKEND | No storage choice made |
| reload | BLOCKED BY BACKEND | Concrete selected acknowledgement absent |
| cleanup | BLOCKED BY BACKEND | Concrete lifecycle and policy absent |
| quota | BLOCKED BY BACKEND | Device quota acceptance PHYSICAL ONLY |

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
| Hosted entry | OPEN |
| Physical acceptance | PENDING |
| Policy decision | REQUIRED |

Remaining pure software blockers:
1. Actual transitive native loader edges, scoped unexpected-library detection and mapped artifact/architecture/version binding for actual ML/codec libraries; exact-path presence alone cannot complete closure.
2. Process/child-scoped native socket/DNS/HTTP/download enforcement and observation beyond Python audit; currently UNVERIFIED.
3. Actual decoder, resampler, encoder and stem torch/audio backend receipts, fallback/executable mismatch enforcement across all processing paths.
4. Production orchestration of verified local web assets/Helper/server, out-of-band nonce/session delivery, actual browser envelope consumption with health/inventory/eligibility checks and Swift shutdown/error propagation. Existing validators/transport are not end-to-end integration.

Production blockers: concrete backend atomic selected publication/binary and generation store/reload/cleanup/quota plus the software integration above. Policy blockers: approved local artifacts/licenses, storage/schema, distribution/trust/signing/notarization/PKI, model/provider/retention/GC. Physical blockers: Intel/Apple Silicon/Gatekeeper/Safari/iPad/real isolation/model performance/six-note accuracy/Logic/Keystation/power-loss/quota. These categories are not software PASS claims.

Stage 3 entry gate is not passed. Shortest next step: connect an authenticated local asset set and the existing browser bootstrap caller to the one-shot local transport, with server/Helper lifecycle supervision; native enforcement stays separately blocked.

## 30-feature reevaluation

Formal A remains **0/30**. All 30 rows rechecked against the current master plan and #307 evaluation; this change adds software boundaries but satisfies none of the missing end-user/physical/backend gates. No end-user feature is promoted from contract tests.

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
