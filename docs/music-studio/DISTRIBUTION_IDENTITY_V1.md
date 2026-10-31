# Distribution identity implementation — 2026-10-05 JST

Source: freshly fetched GitHub main 552d56eafddfd192970c09f7d6278696cf8775c3; base #303 3b3b178f81a5b6096af421a577f80fe49fa6b74e. 50 Open / 48 Draft, all Drafts mergeable; #10/#35 conflict. Exact base CI 6 SUCCESS. No #304+ at start.

Implemented: versioned JS/Python manifest validation, external canonical SHA-256 trust anchor + expected build revision, duplicate/critical field/version/digest/stale failure; manifest → launcher health verification and browser configure/connect adapter; strict versus legacy unverified distinction. Launcher explicit NOVA_TRUSTED_MANIFEST_PATH / NOVA_TRUSTED_MANIFEST_DIGEST / NOVA_EXPECTED_BUILD_REVISION are an externally supplied trust boundary, not authentication of environment or local JSON. No signature/PKI policy chosen. Browser bind requires an externally authenticated expected digest, expected revision and SHA-256 provider; configure is PENDING_HEALTH, never VERIFIED until health checks pass. Nested expected values frozen. Adapter loaded by product HTML. Caller supplies bootstrap trust explicitly; no implicit default trusted bootstrap.

Helper installed package inventory observes actual importlib.metadata versions for setuptools/demucs/basic-pitch/mido/librosa/soundfile/numpy/torch/torchaudio, Python version and machine architecture only. Metadata is OBSERVED_METADATA/UNVERIFIED, never package artifact proof. No usernames, paths, personal files, environment dump or network collected. Observer source digest exposed and pinned by strong manifest. Bounded local asset verifier checks root confinement, bytes, size and trusted digest; generic model/native fixture evidence is not evidence of actual model loading. Exact dependency version/digest validator is implemented.

Model loader audit: server.py run_demucs invokes separate Python subprocess demucs.separate -n htdemucs_6s, without explicit local model path. transcribe_pitched_stem calls basic_pitch.inference.predict with its default model. We cannot establish actual loaded byte inventory from these boundaries. modelInventory remains UNCONFIGURED; strict manifests fail closed. Full actual loader integration still required, with companion asset coverage and subprocess offline guard. No external models/dependencies downloaded or bundled in this change.

Strict launcher prevents absent-venv pip setup and setuptools repair. This is not complete offline execution: current Demucs loader may still download on use in legacy mode, and no production strict model-ready inventory exists. Strong launcher health rejects unverified dependencies/models. macOS source packaging includes both new Python modules; this is source packaging, not bundled Python/model distribution.

## Offline closure inventory

| Item / source | Classification | Evidence |
|---|---|---|
| Repository JS/HTML/CSS and Helper Python sources | BUNDLEABLE | local repo files; full standalone bundle not produced |
| New identity Python modules in macOS package workflow | BUNDLEABLE | copy instructions implemented; artifact verification required |
| Python interpreter | EXTERNAL REQUIRED | launcher command -v python3 / venv |
| pip/wheel/setuptools and ranged requirements | EXTERNAL REQUIRED | launcher setup/repair uses pip; strict blocks setup |
| ML Python packages / transitive runtime / native libraries | LICENSE REVIEW REQUIRED | no approved locked artifacts/license inventory |
| Demucs htdemucs_6s / companions | LICENSE REVIEW REQUIRED | subprocess implicit cache/download; loaded bytes unobserved |
| Basic Pitch default model | LICENSE REVIEW REQUIRED | installed package default assets; actual selected bytes unobserved |
| Native wrapper and Helper hosted Music Studio URL | EXTERNAL REQUIRED | explicit github.io HTTPS start URL |
| Complete distribution, storage and GC choice | POLICY REQUIRED | not selected |
| Gatekeeper / Intel / iPad offline permissions and capacity | PHYSICAL ONLY | real device acceptance absent |

Existing read-only dependency inspection remains authoritative for whole-app CDN/font/runtime closure; no evidence newly obtained that every third-party asset is bundled. No item is BUNDLED solely because its filename appears in a manifest.

## Production Binding Matrix

| Element | Classification | Remaining |
|---|---|---|
| bounded ingress | IMPLEMENTED | existing production guarded readers retained |
| Helper source identity | IMPLEMENTED | exact source/protocol check retained |
| Helper runtime identity | PARTIAL | Python metadata observed; native/package artifact chain absent |
| model identity | PARTIAL | exact contract/bounded verifier; actual load boundary absent |
| dependency identity | PARTIAL | installed versions observed; installed artifacts/native executable collection absent |
| distribution manifest | IMPLEMENTED | externally anchored validator contract; actual distribution manifest not supplied |
| browser expected identity | PARTIAL | manifest adapter/product script implemented; authenticated bootstrap not supplied |
| repository identity | IMPLEMENTED | existing strict prebinding |
| generation identity | IMPLEMENTED | existing strict prebinding |
| selected pointer | PARTIAL | injected acknowledgement, production backend absent |
| atomic publication | PARTIAL | injected contract, production transaction absent |
| binary store | BLOCKED BY BACKEND | schema/store not selected |
| generation store | BLOCKED BY BACKEND | schema/store not selected |
| commit marker | BLOCKED BY BACKEND | real transaction absent |
| reload | PARTIAL | injected strict verification only |
| cleanup | PARTIAL | injected interface only |
| migration | BLOCKED BY POLICY | no destructive migration |
| quota handling | PARTIAL | bounded resource contracts, concrete backend absent |

No extra backend-neutral interface added: #303 publication/prebinding remains the reference, avoiding duplicate contracts.

## Exit gate

Software/contract OPEN; Production binding BLOCKED; Runtime capability OPEN (existing capability contract COMPLETE, actual installed/loaded closure incomplete); Distribution capability OPEN (existing capability contract COMPLETE, distribution identity inventory/bootstrap incomplete); Actual offline distribution OPEN; Identity chain OPEN; Physical acceptance PENDING; Policy REQUIRED. Stage 3 gate not met.

Remaining software: actual model loading bytes/companion inventory and subprocess offline binding; installed package/native artifact observation; authenticated distribution bootstrap supplied to launcher/browser and local asset inventory enforcement; concrete production binary/generation/marker transaction selected-pointer/reload/cleanup/quota binding after backend approval; offline assembly after approved artifacts. Generic manifest/validator implementation is no longer the blocker. Production blockers are real stores/atomic publication and runtime identity integration. Policy blockers: storage/schema, distribution/model/license/retention/GC and trust provisioning. Physical blockers: Intel Gatekeeper/accuracy/six-note test, iPad/Mac permissions/interruption/reopen/quota/MIDI/Logic/UI. These do not count as code-complete evidence.

## All 30 reevaluation

A 0/30. Each formal gate below remains unmet; identity validators and synthetic PASS do not promote end-user features to A. Features 16/17/23/25/27 gain verified contracts, not end-user acceptance.

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
