# Offline binary resolver and generation boundary

Checked 2026-10-05 JST. Base #299 `269c29a74004e9e883de0fee2e59ac3e71b57d73`; main `552d56eafddfd192970c09f7d6278696cf8775c3`. Start audit contains all 46 known Open PRs / 44 Drafts and exact-head Actions. #299 is the safe checkpoint with 4 successful workflows. #298 original run is separately still in progress. No #300 existed at start; remote pull refs also checked before publication. Existing branches and main are untouched.

## Implemented runtime

Both production entry points load `music-studio-binary-boundary.js`. Explicit offline bindings connect `audioAssets`, `midiAssets`, `fileReferences` and actual parser/importer `importSource` original MIDI descriptors to byte sources. Top-level/nested duplicate importSource descriptions share one original-file dependency; conflicting file metadata is ambiguous. Inline midiData is independent of original file bytes. No path/URL fetch, permission prompt, Cloud API or provider call. Binding keys are per-snapshot paths, not a new persistent content identity.

Resolver distinguishes available, missing, external, permission-unavailable, reselection-required, unsupported, ambiguous and unverified; byte mismatch is separate. File/Blob, detached typed bytes and caller-supplied read-only file handles are supported. Handle permissions are queried; denied/prompt never trigger requestPermission or file reads. Unknown sources/statuses and failed reads fail closed; per-source reads have 5-second default / 15-second maximum bounds. Cancel/stale/supersession are rechecked after awaits. Bytes are privately detached; public report modifications cannot authorize publication. Size is compared when declared; optional explicit expected bytes are compared byte-for-byte. Size alone is not content identity and no content hash/storage naming policy is chosen.

Restore defaults to the compatible **metadata-only** behavior and explicitly reports that outcome. `binaryMode:'complete'` validates all metadata, resolves the selected Project dependency closure, then refuses unresolved bytes before publication. It refuses a metadata repository masquerading as a binary generation store. Required binaries additionally require a supplied `atomicGeneration` adapter bound to the current metadata repository. This is an injected contract, not a new production persistence backend. Existing IndexedDB v5 and saved data are unchanged. Projects without external dependencies may use existing atomic metadata Restore after complete preflight.

`inspectBackupCompleteness` combines actual production metadata validation with candidate package byte resolution. It never trusts binariesIncluded claims or uses source-side evidence as package evidence. Current exports remain metadata-only and binariesIncluded=false. Binary-complete requires all candidate dependency bytes actually read; fullBackupComplete also requires metadata validation. Empty metadata-only backups are not labelled binary-complete. Resolver callers are trusted explicit adapter code; a caller that lies about where bytes came from cannot be independently authenticated by this boundary.

Generation contract stages detached metadata, sanitized selected settings and privately observed bytes. Adapter owns one atomic publication and acknowledges only commit. Cancel/stale controls and transaction abort registration propagate to adapter. Recovery compares the complete snapshot, selected settings, exact binary key closure and every byte before accepting a reopened generation. Missing/duplicate/mismatched bytes, late reader failure, settings/metadata failure and Cancel/stale reject. Recovery only validates a candidate: it does not write, select a persistent generation or invent a rollback after durable commit.

## Evidence and limitations

40 new Node cases initially, extended thereafter; final counts in PR. Existing suites retained; cache-key assertions updated to current Studio version 1.4.120. Real Chrome script covers 1440/820/390 offline resolver statuses and actual isolated IndexedDB single-record generation transactions: late binary/metadata abort, Cancel/stale, absence of partial publication, retry, close/reopen and full byte recovery. The synthetic generation store is verification-only; it is not the selected production A/B/C backend. Existing production atomic transaction and complete application UI browser smoke remain unchanged and run in CI. Process watchdog / evaluation / page/browser cleanup / job-step timeout retained. Local Chrome installation was unavailable (download produced invalid ZIP); exact-head CI supplies real Chrome evidence.

Take / audio Version / named Checkpoint: no production Project implementation found. `lyrics.versions` and MIDI editor/history are implemented metadata, not audio Version or a named full Project Checkpoint. Verification graph kinds exist, but provide no actual Take/Comp/persistent binary feature. Unknown takes/versions/checkpoints are retained in metadata-only Restore and block complete dependency coverage; no fabricated production kind is added.

Standalone: offline deterministic VM tests exercise both boundary and actual Restore without Helper/native/provider access; local script closure includes the new runtime. Real Chrome exercises browser/IndexedDB on disposable origins. Helper Python packages/model weights, WKWebView/CoreMIDI/native, signing/notarization, distribution and transitive model/runtime licenses remain unverified. Browser CI cannot establish Intel Mac/M1 iPad Safari permission, crash or power-loss durability.

## Stage 2 gate

| Gate | Status | Remaining |
|---|---|---|
| Software/contract | **OPEN** | production generation adapter, complete binary Backup package writer/reader and selected-generation durable recovery; actual runtime/distribution capability verification |
| Physical acceptance | **PENDING** | Intel Mac/Chrome + M1 iPad/Safari quota/permission/reselection/interruption/reload/Japanese/touch; Audio Helper signing/six-note quality; Keystation/Logic |
| Policy decision | **REQUIRED** | eventual A/B/C, distribution/native/model and retention/GC choices; not decided here |

OPEN is due to missing production software, not merely undecided policy. Policy-neutral resolver, byte preflight, package completeness and generation/recovery validators are implemented; they do not make the missing concrete adapters complete. Stage 3 transition: **no**, Stage 2 production gaps remain. Shortest next: implement and fault-test an isolated injectable durable generation adapter + portable package codec using this boundary, then bind it to the approved production persistence contract. No need to decide Cloud/provider/model policy to finish generic adapter tests.

## All 30 formal A reevaluation

A remains **0/30**. No end-user formal A gate is newly established. Test count does not promote A.

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
| 23 Backup・復旧・移行 | no | resolver/preflightは実装。production binary generation adapter・完全package codec・別Mac復旧が残る |
| 24 診断・安全修復 | no | 全体性能原因診断、安全軽量化、修復可能範囲/同意/transaction |
| 25 AI実行環境・作品保護 | no | 完全Local/Project単位外部禁止の実行境界、送信内容提示、Intel/Apple Siliconの処理別capacityとModel選定 |
| 26 AI料金管理 | no | 料金事前表示、月額上限、Provider別使用量、予約/失敗/Cancel計上 |
| 27 AIモデル管理・互換性 | no | 真のProvider交換、軽量Model、速度/品質、旧版、更新前fixture test、Model license/versionの互換契約 |
| 28 スマートUI | no | 不要機能OFF、作業別UI、お気に入り、自然言語から画面表示、physical touch/Japanese glyph/a11y確認 |
| 29 素材・テンプレート | no | 曲/部分素材保存、曲に合わせるKey/BPM調整、文章検索 |
| 30 完成版・制作履歴 | no | 完成版固定、完成曲検索、Session/日次/時系列をつなぐ履歴 |
