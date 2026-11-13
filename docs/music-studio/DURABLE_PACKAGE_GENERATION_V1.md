# Durable package / generation boundary — 2026-10-05 JST

Base #300 4fef6c143340f4ff0c9d01b1796a38f4641dce12. main 552d56eafddfd192970c09f7d6278696cf8775c3. Fresh GitHub audit: 47 Open / 45 Draft; all Drafts mergeable, #10/#35 conflicting non-Drafts. No #301+ found at start. #300 exact-head 4 Actions SUCCESS, latest safe checkpoint. Existing PRs remain untouched.

## Implementation and backend contract

`music-studio-generation-adapter.js` is an injectable browser/Node contract implementation. prepare reserves a NEW immutable identity, stages detached metadata/binaries, verifies staged bytes and package, commits a digest-bound marker last, then reloads THAT selected identity. Write acknowledgement alone is never success. Selection verifies marker/metadata/dependency closure/settings/bytes; latest recovery considers backend monotonic sequence, skips incomplete/corrupt newest, preserves older valid generations. Backend list/read failures fail closed. Abort and explicit incomplete cleanup cannot delete committed generations. No retention/GC inference.

Backend interface: prepare, stageMetadata, stageBinary, read, commit, list, abort, cleanupIncomplete. Commit must atomically check control.reason and publish only an immutable marker; read must expose committed durable state after reopen, list must supply unique identities and monotonic safe integer sequences. Backend must not overwrite older slots; cleanup is only caller-selected incomplete slots. Direct staging methods are low-level backend operations, not a complete publication authorization. A/B/C remains undecided.

Cancel/stale/superseded checked before/after awaited operations. Late failure after commit rejects success but may leave a VALID committed generation; recovery identifies it. Such failure cannot promise physical rollback. Missing marker is never committed. No actual user origin/songs/Backup accessed. Disposable Linux fsync fixture is actual filesystem verification, not chosen production persistence or evidence of power-loss durability.

## Portable package

Version 1 JSON container with byte arrays (deliberately simple; no archive paths, decompression or executable entries). It keeps existing Backup snapshot including Projects/settings/opaque legacy fields, dependency manifest logical identities, generation identity, entry byte length and SHA-256 digest. Complete and metadata-only scopes are explicit. Reader verifies version/required fields, Project identity duplicates, manifest closure, entry duplicates/missing/unexpected/size/digest/contract and inventory support BEFORE restore. Unknown metadata, manifest and entry extensions survive package Restore and durable reload via the validated original package text; unknown dangerous binary contracts block complete. Metadata-only retains future contract data without asserting completeness. Production metadata validator is REQUIRED and injected; test uses actual Project/settings validators, browser uses actual Restore preflight. Digest verifies package consistency, not authenticity/signature.

JSON byte-array expansion and whole-package memory are known limitations; streaming/maximum capacity and durable backend quotas remain software/capacity work before production distribution. No package auto-import UI or production storage binding is added.

## Verification and end-to-end

28 added Node cases: complete package → independent disposable storage → fresh adapter reload matches snapshot/settings/bytes; incomplete/corrupt metadata/binary; marker/digest/length mismatches; missing/duplicate/unexpected entries/manifests, legacy/unknown fields, unsupported contract, Cancel/stale/superseded, late failure and fresh-identity retry. Filesystem slots never replace older generations. Browser harness uses disposable IndexedDB at synthetic origin at 1440/820/390 with request blocking, console/pageerror capture and finally cleanup/timeouts. Existing Node/browser tests unchanged. Local Chrome absent; CI is the real Chrome evidence source, not a local PASS claim.

## Production and future contracts

Production IndexedDB v5 persists Project/settings atomically, but has no binary/generation stores or selected generation model. Direct binding would need schema and storage decisions; this patch does not fabricate them. Adapter/codec isolated contract COMPLETE within specified interface; production binding BLOCKED BY POLICY AND BACKEND IMPLEMENTATION. The adapter does not claim it can be passed directly as existing Restore repository: required generated identity, atomic metadata publication integration and repository result shape must be implemented at approved binding.

Take, audio Version and named Checkpoint remain absent as production entities. Existing lyrics versions/MIDI edit history are distinct. Their future binary graph fields are retained metadata-only and fail complete coverage. No completed production claim.

| Runtime | Offline contract | Remaining |
|---|---|---|
| Browser only | No Node imports on browser path; WebCrypto SHA-256 and injected backend | Secure-context WebCrypto, actual quota and reopen acceptance |
| IndexedDB | Synthetic generation transactions/reopen harness | Approved production stores/atomic publication adapter |
| Native filesystem | Disposable fsync fixture | Approved backend, atomicity on target platform |
| Audio Helper | No dependency for package/adapter | Python/models/licenses/runtime compatibility and six-note quality |
| Mac distribution | Codec is policy-neutral | Packaging/signing/notarization/runtime/model distribution contracts |

## Exit gate

| Gate | Status | Reason |
|---|---|---|
| Stage 2 software/contract | OPEN | Actual runtime/distribution capability contract and production backend/transaction integration remain unimplemented; package capacity bounds remain |
| Production binding | BLOCKED | Policy plus backend/schema/metadata repository integration |
| Physical acceptance | PENDING | Intel/M1/iPad permissions/quota/interruption/reopen, Japanese/touch, Helper signing/audio quality, Keystation/Logic |
| Policy decision | REQUIRED | A/B/C, native/distribution/model, retention/GC; none chosen |

Stage 3 transition not authorized by exit evidence. Next shortest: bounded package decoding/resource contract and offline runtime/distribution capability validation; then approved generation backend and repository integration, followed by physical acceptance.

## All 30 formal A reevaluation

A remains 0/30; no formal end-user acceptance gate newly met. Test count does not promote A.

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
