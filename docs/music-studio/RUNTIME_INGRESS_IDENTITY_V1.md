# Runtime / ingress / publication identity — 2026-10-05 JST

Fresh GitHub: main 552d56eafddfd192970c09f7d6278696cf8775c3; base #302 5adfc3cf13ef488ce116c8c655166f5dce0560df, exact-head Actions 37250302261 SUCCESS. 49 Open / 47 Draft; every Draft mergeable; #10/#35 non-Draft conflicts. All current HEAD/base/status/Draft/mergeability/Actions individually fetched; latest all-state PR #302, no #303+. Detailed initial audit: verification/music-runtime-ingress-start-audit.json. Only a new independent branch is written.

## Production code

Audio Helper server captures a versioned runtimeIdentity at startup: protocolVersion=1, runtimeVersion=1, requirements SHA-256, identity module SHA-256, observed Python version. Existing health version/revision/sourceDigest remain compatible. Both Mac app reuse/poll and START command reuse/poll check health ok, localOnly, host/port, response version, exact source digest/revision and protocol/runtime/artifact digests using dependency-free helper_identity.py. Packaging includes the new validator in app and command archives. Health 200 or localOnly alone cannot authorize launch success. No process is killed by guessing its identity.

Browser bridge adds explicit configureIdentity/connectIdentity optional capability: strict mode validates health BEFORE audio upload and process response BEFORE MIDI publication; mismatch/unavailable/nonlocal/Abort/Cancel fail. Legacy revision-only path is retained explicitly for already distributed Helpers; no missing new field silently becomes trusted. Expected identity must be supplied by distribution binding, not learned from untrusted health. This prevents accidental version mixing, not hostile process attestation. Python version is observed; installed dependency versions/native extension binaries and loaded model bytes are not proven by requirements digest.

Current Demucs call selects htdemucs_6s and Basic Pitch calls predict with its package default. Actual loaded model file identity is not exposed. runtimeIdentity.modelInventory therefore reports UNCONFIGURED; explicit expected inventory rejects it. Offline synthetic model inventory tests are not proof of installed or loaded model identity. Source/protocol identity integration IMPLEMENTED; complete runtime/model binding PARTIAL.

music-studio-ingress.js is the shared guarded File reader used by Project JSON, Backup preview, Settings JSON and portable package readFile. It validates nonnegative safe declared size before opening, counts actual chunks before decoding, exact final size, mutable file size, reader failure, Abort of pending reads, Cancel/supersession/repository changes, and reader cancel/release. UTF-8 streaming decoder is fatal. Custom old text()-only File adapters remain compatible after declared preflight and observed UTF-8 verification; they cannot prove their own pre-materialization bound. Project import rechecks the guard/repository after awaited duplicate lookup and before put. Existing atomic Backup Restore remains unchanged; preview acceptance never directly publishes a package generation.

JSON user-facing acceptance ceiling is explicitly 64 MiB, configurable via maxBytes options; this is a software ingress acceptance ceiling, NOT storage quota, device capacity, asset limit or storage-policy choice. No small valid import is rejected. Legacy internal importText/previewBackupText remain explicitly unbounded. MIDI/audio file paths retain their existing separate limits and are outside this scoped JSON integration. JSON v1 still whole-buffer: bounded bytes do not guarantee physical RAM availability or bound engine/backend hidden copies.

Versioned portable package bindingIdentity carries repositoryId/generationId. Legacy packages without it remain readable by legacy codec; strong publication flow requires it. Strict generation adapter checks input/package/staged record/marker/reloaded result identity and rejects backend/repository changes. Stored binary bounds precede allocation/digest. selected pointer requires version/repository/generation/marker digest identity. The storage-neutral publication flow joins bounded ingress, metadata/package preflight, identity checks, immutable staging, commit eligibility, commit, reload and selected pointer acknowledgement, including a second pointer observation after reload. It is INJECTED ONLY and is not enabled as actual production persistence. An injected backend must own atomic metadata/result/selected-pointer publication; declarations and disposable tests do not prove a real durable implementation.

Commit or acknowledgement failure may leave a committed immutable generation; failure is honest and must be recovered, not deleted. No binary/generation store, marker store, schema migration, A/B/C, distribution/model/license/retention/GC choice or GC is introduced. Fixture identity/pointer behavior is synthetic only.

## Production Binding Matrix

| Element | Classification | Scope / remaining work |
|---|---|---|
| bounded ingress | IMPLEMENTED | production Project/Backup/Settings + package; audio/MIDI separate existing paths |
| helper identity | PARTIAL | launch exact source/protocol/runtime artifacts; actual loaded models/dependencies and default browser strong distribution binding remain |
| repository identity | IMPLEMENTED | versioned prebinding identity + exact repository object guards |
| generation identity | IMPLEMENTED | input/package/record/marker/result strict matching |
| selected pointer | PARTIAL | validation + acknowledgement flow; concrete atomic pointer backend absent |
| atomic publication | PARTIAL | joined guarded prebinding; real storage transaction/result mapping absent |
| binary store | BLOCKED BY BACKEND | no new store/schema selected |
| generation store | BLOCKED BY BACKEND | no new store/schema selected |
| commit marker | BLOCKED BY BACKEND | existing injected interface; real marker transaction absent |
| reload | PARTIAL | strong selected identity acknowledgement; actual production selected reload absent |
| cleanup | PARTIAL | explicit incomplete cleanup interface retained; real backend cleanup absent |
| migration | BLOCKED BY POLICY | existing guard rejects destructive/cross-version migration |
| quota handling | PARTIAL | limits + atomic quota prerequisite + rejection; real backend handling/physical quota absent |

## Offline distribution closure

Native production URL is hosted HTTPS. Mac Helper first run creates external Python venv and pip installs ranged requirements plus pip/wheel/setuptools; no locked architecture-native dependency inventory. Demucs may download htdemucs_6s; Basic Pitch defaults depend on installed package assets; loaded files are unverified. No approved complete offline Python/native/model asset manifest exists. The newly packaged source/validator artifact digests reduce identity ambiguity, but do not remove those downloads. No license-unknown dependency bundled. Ad-hoc codesign in CI is not notarization or real Gatekeeper acceptance.

## Stage 2 exit gate

| Gate | Result |
|---|---|
| Software/contract | OPEN |
| Production binding | BLOCKED |
| Runtime capability contract | COMPLETE |
| Distribution capability contract | COMPLETE |
| Actual offline distribution | OPEN |
| Physical acceptance | PENDING |
| Policy decision | REQUIRED |

Remaining software ONLY: actual loaded model/dependency/native runtime identity observation and strict distribution-to-browser expected identity configuration; concrete binary/generation/marker backend and atomic metadata result/selected-pointer integration with reload/cleanup/quota; self-contained offline Python/dependencies/model/native asset packaging for the eventually approved distribution. Policy: A/B/C/schema/distribution/model/licenses/retention/GC. Physical: Intel Mac/M1 iPad permissions/quota/interruption/reopen/Japanese/touch, Helper signing/notarization/six-note accuracy, MIDI/Logic. Stage 3 gate not met. Shortest next policy-neutral unit: loaded model/dependency identity and versioned expected-identity distribution manifest; then approved backend binding and physical acceptance.

## Verification

42 new Node tests cover correct/wrong/missing Helper identities, models/nonlocal/unavailable/Abort/Cancel/retry; ingress normal/exact/over/declared short-long/negative/unsafe/pending reader failure/Abort/Cancel/superseded/stale/retry; production Project/Backup + legacy compatibility/repository switch; package digest failure and strict repository/generation/pointer/prepublication guards. Four new dependency-free Python tests include parameterized source/artifact/protocol/local/model failures; existing eleven HTTP boundary tests retained. Browser harness adds corresponding offline fixture checks at 1440/820/390 and retains existing generation/resource/binary/atomic/UI checks, external blocking, console/pageerror capture and bounded cleanup. Final counts/exact-head CI/artifact evidence are recorded in the PR after verification.

## All 30 formal A reevaluation

A 0/30. Every feature below was reevaluated against this implementation. Contract/fixture completion does not meet end-user A acceptance. Feature 23 gains production file guarding and strong injected publication identity; concrete storage/device recovery remains missing. Feature 16/17 gains launcher identity, not model/quality/signing acceptance.

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
