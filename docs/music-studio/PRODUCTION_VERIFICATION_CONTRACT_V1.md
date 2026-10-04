# Production verification contract — 2026-10-04 JST

Stage 2 software/contract: OPEN. Physical acceptance: PENDING separately. A 0/30. Stage 3 execution not authorized by the current exit gate. No production storage policy selected.

## Verified production routes (source at base #296)

| Object | Actual boundary | Limit |
|---|---|---|
| Project metadata | music-studio.js makeProject / repository.put / projects store | IndexedDB v5 or memory fallback |
| MIDI | saveMidiEditor / midiData inside Project / repository.put | Original imported MIDI file binary not retained by this route |
| Audio | audioAssets/fileReferences metadata; music-studio-audio.js temporary input; tools/music-audio-pipeline/server.py processing | No production full binary repository established |
| Take / audio Version / named Checkpoint | No resolver/write contract found in production repository | New contract refuses takes/versions/checkpoints fields rather than dropping them |
| revision / Undo | Project revision; Editor snapshots | Neither establishes named audio Version/Checkpoint |
| Backup | backupObject / markExternal / JSON export; autoBackups store | settings, projects, reference metadata; binariesIncluded=false; reselection marked |
| Restore | validateBackup / restoreBackup / per-project put / persistSettings / refresh | Additive; invalid projects skipped; failures can leave earlier additions. Not atomic full Restore |

IndexedDB request helper resolves on request.onsuccess, not transaction.oncomplete. A late abort cannot establish durable completion after the Promise has resolved. This defect is recorded, not silently repaired in this additive verification checkpoint. Settings normalizeSettings/mergeKnown keeps known fields only; unknown settings are not guaranteed retained. Project raw repository copies preserve opaque JSON fields, while makeProject selectively preserves supported fields. Do not generalize opaque project preservation to all normalization paths.

## New implementation

music-studio-production-verification-contract.js derives asset mappings from actual Project collections, using collection path as ephemeral resolver key and retaining logical identity separately. Audio/MIDI asset nodes map to verification binary copies, not production managed ownership. Readers are explicitly supplied offline; paths/URLs never fetched or opened automatically. fileReferences remain external-file and fail the existing external recovery gate. This conservative limitation is intentional and is not an exhaustive real file resolver.

Detached current Project snapshots connect to #294 closure, #295 observed-byte and #296 owned disposable filesystem save/fsync/commit/reload/recovery. Reader and fault boundaries recheck stale/Cancel. No production publication is authorized, even on a successful disposable commit. Unknown Take/Version/Checkpoint contracts and schema mismatch block. No actual migration occurs.

Backup validator always reports full completeness false for current metadata format. It separately compares a Project snapshot against current markExternal export semantics, reports missing/ambiguous Project and external binary/reselection requirements. It does not claim settings or whole-library completeness. Restore preflight byte acceptance is distinct from publicationAllowed=false. Existing production Restore remains unchanged and is not upgraded to atomic semantics.

Standalone capability validator requires explicit browser IndexedDB, script/style closure, binary, Helper runtime, native, host navigation and distribution evidence. Caller declarations are requirements evidence only, not independently verified runtime facts. Current capabilities remain pending; static inventory alone cannot assert portability. Migration validator checks format/schema/revision and unsupported dependency contracts, preserves detached unknown JSON, refuses unknown workspace version. This is conservative compatibility screening, not complete production migration acceptance.

## Exit gate

| Gate | Current value | Remaining software condition |
|---|---|---|
| persistence contract | inspected, incomplete | transaction-complete success and actual binary lifecycle contract |
| resolver | partial explicit adapter | exhaustive file/Take/Version/Checkpoint mapping |
| Backup completeness | false | complete binary packaging and all dependency coverage |
| Restore preflight | offline byte verification; production publish blocked | production atomic transaction/reload/recovery adapter |
| Standalone portability | not established | transitive/runtime/native/distribution evidence |
| migration compatibility | conservative checks only | supported legacy/future roundtrip across production normalizers |

Physical pending: disposable Mac/iPad permissions/reselection, real capacity, crash/reopen; Japanese/touch; Intel Audio Helper signing and six-note accuracy; Keystation recording/playback; Logic roundtrip. These are separate from the missing software above.

Shortest next work: reproduce late IndexedDB abort against the actual request helper; add a transaction-completion adapter with disposable IndexedDB tests, then connect atomic metadata Restore preflight. Binary A/B/C, Cloud/provider/model/retention/GC remain undecided; do not choose them implicitly.

## 30-feature A reevaluation

No A promotion: this checkpoint implements verification contracts, not the unmet end-user capability. Each row lists one blocking requirement; satisfying it alone is not a promise that all other subrequirements are complete.

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
| 23 Backup・復旧・移行 | no | 音声binary含む完全Backupと依存検査、別Mac移行、更新前保護、復旧の範囲 |
| 24 診断・安全修復 | no | 全体性能原因診断、安全軽量化、修復可能範囲/同意/transaction |
| 25 AI実行環境・作品保護 | no | 完全Local/Project単位外部禁止の実行境界、送信内容提示、Intel/Apple Siliconの処理別capacityとModel選定 |
| 26 AI料金管理 | no | 料金事前表示、月額上限、Provider別使用量、予約/失敗/Cancel計上 |
| 27 AIモデル管理・互換性 | no | 真のProvider交換、軽量Model、速度/品質、旧版、更新前fixture test、Model license/versionの互換契約 |
| 28 スマートUI | no | 不要機能OFF、作業別UI、お気に入り、自然言語から画面表示、physical touch/Japanese glyph/a11y確認 |
| 29 素材・テンプレート | no | 曲/部分素材保存、曲に合わせるKey/BPM調整、文章検索 |
| 30 完成版・制作履歴 | no | 完成版固定、完成曲検索、Session/日次/時系列をつなぐ履歴 |
