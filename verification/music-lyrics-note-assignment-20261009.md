# Music Studio: lyrics-to-note assignment implementation (2026-10-09 JST)

## Outcome and authoritative sources

Closed one repository-only functional gap in No.10: explicit reading tokens now bind to real existing MIDI note IDs and timing, with Preview/Apply/Cancel, atomic persistence, Reopen/JSON/Backup, and fail-closed stale/error handling. This is manual lyric editing/assignment, not AI lyric generation or accent analysis. No whole major feature is newly certified complete.

Sources read on 2026-10-09: Music_Studio_最終機能仕様書_v1.pdf (confirmed 2026-09-30; Library libfile_fea4127fde5c81919fee8296d5c7647d, all five pages/166 extracted lines); verification/music-readiness-unified-20261009.md; current exact checkpoint source.

GitHub audit-start: main 552d56eafddfd192970c09f7d6278696cf8775c3; Open PR inventory 96, Draft 94; latest #349, no successor at audit start. #349 Open/Draft/mergeable=true; head ffaf8dc45205d421d928e53964948dd0f2498ee3; base feature/music-package-native-graph-v1 at 6ef95994a939817b5d579ff452997598da356673. Its create-event exact-head run 37907649713 was re-fetched SUCCESS, both jobs SUCCESS (native 113744898517/software 113744898813). Both decoded logs include exact checkpoint SHA. PR-trigger-only helper returns an empty list for this create-event workflow; the run was retrieved directly instead. Historical Drafts' individual conflicts/jobs were not all reaudited.

New branch starts from #349: feature/music-lyrics-note-assignment-v1. Existing PRs and main remain untouched. No Ready/Merge/Auto Merge/force push, Provider API communication, model adoption/download/install/signing, or 0.1 sales start.

## Actual functionality

- Project detail and Lyrics / Notes home route reach the same assignment editor. Explicit track, chronological first/last note, original lyric text and whitespace-separated reading tokens are required.
- One reading token per note; `~` extends the preceding syllable. Exact notes retain pitch/start/duration/velocity and MIDI metadata. Range remains within an unambiguous monophonic track. No automatic Japanese pronunciation or syllable inference.
- Preview exposes note IDs and actual tick positions without a write. Apply rederives all mappings and rejects changed project/preview/storage and unsaved project/MIDI/AI state or active recording. Input change and Cancel invalidate the preview.
- Partial reassignment retains untouched mappings and opaque legacy records. Splitting a previously assigned melisma is rejected; no dangling extension is silently repaired.
- Memory and IndexedDB use compare-and-put; the latter reads baseline and writes in one readwrite transaction and reports success only at transaction completion. Abort/quota failure retains input and preview for retry; unsupported repositories fail closed.
- Saves increment revision and rebind existing AI workspace revision without changing candidates or opaque extensions. Existing makeProject/export/Backup/Restore retains the real assignment records. No derived baseline/preview is persisted.
- Saved mapping changed by later note editing is shown as requiring review rather than silently retargeted. Malformed imported records render safely and cannot be treated as valid replacement bindings.
- 100000 input-note bound, 4096 selected-note bound, 10000-character lyric/reading bound; overlap check uses a sorted sweep rather than quadratic comparison.
- Studio asset version moves 1.4.121 → 1.4.122 in both standalone/host entry points. Existing exact version assertions are updated to the new version; none is weakened or removed. Feature remains `working`.

## Validation

- Added assignment suite: 37/37 PASS, zero skips. Real timing/identity, melisma, partial replacement, legacy preservation, invalid inputs, stale/modified previews, dirty/recording guard, concurrent storage changes, repository switch, quota failure/retry, atomic IndexedDB transaction completion, AI revision rebinding, malformed imported-record HTML safety, Save/Reopen/JSON/Backup.
- Full Node: 1868/1868 PASS, zero skips (1831 inherited + 37 added).
- Full Python: 508 run, 503 PASS, five inherited optional-dependency skips unchanged. No Python code changed. Those skips do not establish real-model accuracy.
- All JS syntax: 177 PASS; Python compile: 53 PASS; shell syntax: five PASS; git diff --check PASS.
- Browser test implemented in scripts/music-lyrics-note-assignment-browser.js for 1440/820/390, actual IndexedDB Apply/Reload, overflow, console error/warn/pageerror and external requests. Attempt blocked because Playwright Chromium executable is absent. No browser install/download performed. All browser measurements, including external request 0, remain UNVERIFIED.
- Local Swift/Xcode unavailable. New scoped create-event CI uses existing runner tools only for full Node/Python/syntax/whitespace and Swift/unsigned macOS/iPad Simulator builds. No install/model download/signing commands. Existing workflows untouched; [skip ci] suppresses their unsafe push/PR-trigger paths. New exact-head Actions status is pending at authoring; final PR evidence supersedes this paragraph.

## Formal 30-feature state (no complete-row inference from aggregate tests)

Status is software evidence/remaining requirements, not formal A. Every row still lacks complete production/package/policy/physical acceptance evidence. The original v1 table contains truncated No.21 heading; that wording is retained.

|No.|Major feature|Software state and open requirements|
|---:|---|---|
|1|MIDI・Track編集|Existing editor/partial edit/cleanup implemented; entire v1 expansion not certified|
|2|MIDI録音|Existing recording/count-in/metronome; native/Keystation physical acceptance pending|
|3|曲構造・音楽情報|Meter/tempo/key maps and transpose implemented; analysis requirements unverified|
|4|AI新曲スタート|Local candidate workflow; text/lyrics generation backend requirements open|
|5|Music Studio AI制作アシスタント|Panel/safe workflow implemented; conversational/multiple-task backend open|
|6|AI安全編集・変更管理|Candidate/locks/partial adoption/Undo implemented; all selective-history requirements unverified|
|7|AI作曲・曲展開|Continuation/section foundations; all real-generation requirements unverified|
|8|AIアレンジ支援|Reference/track/destination inspection; actual multi-track generation/apply still open|
|9|AIコード支援|Local chord candidates; audio analysis/voicing/follow correction unverified|
|10|AI歌詞・メロディ制作|NEW explicit manual note assignment, persistence and recovery implemented/tested; AI lyric generation/rewrite/accent/two-way regeneration still open|
|11|AI仮歌・対話修正|Actual sung audio generation and conversational editing unverified|
|12|ボーカル録音|WAV/monitor/latency/Punch/Cycle/Take/Comp integrated flow unverified|
|13|ボーカル編集|Non-destructive waveform/lyric/note synchronization, pitch/timing processing unverified|
|14|ボーカル生成・Harmony|Actual singing/Harmony/Double/Chorus backend and voice rights open|
|15|ボーカル完成チェック|Take/reference comparison and correction decision backend unverified|
|16|Stem Separation|Pipeline implemented; approved production runtime/model bytes and quality acceptance open|
|17|Audio-to-MIDI|Pipeline/repair implemented; actual assets and Intel accuracy acceptance open|
|18|AIミックス支援|Planned; real volume/EQ/compression/space/conflict/audibility/A-B processing open|
|19|AIマスタリング|Planned; real Master/LUFS/Peak/clipping processing open|
|20|Logic Pro往復連携|SMF round trip implemented; finished WAV/Stem return/diff tracking open, direct .logicx undecided|
|21|最終書出し・配信パッケー|MIDI export implemented; consolidated Master/Instrumental/Stem/WAV export and checks open|
|22|保存・曲バージョン管理|Project/autosave foundations; all partial version composition requirements unverified|
|23|バックアップ・復旧・移行|Metadata/atomic/binary recovery foundations; complete production binding and migration acceptance open|
|24|Music Studio診断・安全修復|Dependency/storage inspection; performance diagnosis and all automatic repair requirements open|
|25|AI実行環境・作品保護|Fail-closed isolation/lifecycle foundations; actual production binding/policy/physical acceptance open|
|26|AI料金管理|Actual pre-run pricing/monthly cap/per-AI usage backend unverified; Provider not adopted|
|27|AIモデル管理・互換性|Capability/runtime identity foundations; actual model sets/light switching/quality compatibility open|
|28|スマートUI|Settings/assistant foundations; task UI/favorites/natural-language navigation unverified|
|29|素材・テンプレートライブラリ|Reusable material storage/Key-BPM adaptation/text search integrated flow unverified|
|30|完成版・制作履歴管理|History field foundations; completed-version freeze/search/sessions/daily history flow unverified|

Software completion: percentage cannot be confirmed. The v1 requirements are not yet a fully decomposed, weighted, verified denominator. Aggregate tests are not that denominator. This work closes one scoped lower requirement and does not turn 37 passing tests into a claimed 99% or 100%.

Readiness: 100% NOT reached. New UI browser acceptance remains open, as do the matrix's software gaps and approved Wrapper/Helper/private CPython/stdlib/dependencies/native libraries/model/config/manifest/license/system policy production bindings. Existing signatures/builds/tests are not production approval.

formal A: 0/30 confirmed; no row has all production binding/backend/policy/physical acceptance. Stage 2 OPEN; Stage 3 NOT PASSED. Refer to inherited stage contracts; this lyric patch does not satisfy them.

## Next shortest functional target and consolidated physical work

Recommended next repository-only target: No.18 local audio volume/peak/clipping analysis and actual gain-processing/A-B output, with immutable original PCM, cancellation, saved processing parameters, restoration and real signal tests. This is a DSP editing subrequirement; do not call it AI mixing completion or fabricate generated model output. Keep EQ/compression/space/audibility and model backend separate until implemented.

Before physical work: close browser acceptance and software matrix gaps, adopt exact assets and their license/policy evidence, establish unsigned package completeness and approved distribution. Mac-only checklist remains unified in verification/music-readiness-unified-20261009.md: Gatekeeper/packaged offline runtime, MIDI input/save/reopen, six-note conversion accuracy, vocal chain, Mix/Master/export/Logic return, Backup migration and compatibility. Add lyric reading/melisma Preview/Apply/Reload/JSON/Backup/changed-note warning to that one consolidated session. No user operation is required now.
