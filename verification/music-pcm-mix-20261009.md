# Music Studio — real local PCM gain / A-B implementation

Date: 2026-10-09 (task date, JST). Authoritative source freshly read: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, five pages/166 lines, libfile_fea4127fde5c81919fee8296d5c7647d. Inherited readiness: verification/music-readiness-unified-20261009.md and verification/music-lyrics-note-assignment-20261009.md.

## Result

No.18 moves from mix-note placeholder to **partial implementation of actual local audio Volume processing**. Real PCM WAV decoding, Gain render, sample peak/dBFS/RMS/clipping measurement, actual Web Audio A/B buffers, Preview/Apply/Cancel, atomic persistence, Undo/Redo, Reopen/JSON/Backup/Restore and single PCM16 WAV output are implemented. No AI model output or whole-feature completion is claimed.

New branch feature/music-pcm-mix-v1 begins from #350 exact 752a4bf3522736b9c69e4635ba4635c3a52307e8, targeting feature/music-lyrics-note-assignment-v1. Current main re-fetched 552d56eafddfd192970c09f7d6278696cf8775c3. Open inventory 97 / Draft 95. All 97 PR detail records freshly retrieved (HEAD/base SHA/mergeable/mergeable_state/commits/files/additions/deletions) in music-pcm-github-inventory-20261009.json; only historical #10/#35 report conflicts. No successor to #350 existed at audit start. #350 remains Open/Draft/clean/mergeable, one commit/11 files/+277/-17. Its exact-head run 37912095080 SUCCESS; both decoded job logs (113759425307/113759425154) confirm checkpoint SHA, Node 1868, Python 503 + five skips, Swift 54 and both unsigned builds. Historical PRs' every job/log is not reaudited and is not acceptance of this new patch.

## Actual signal/data behavior

- WAV input accepts RIFF little-endian PCM16/24/32 and IEEE Float32, mono/stereo, 8–192 kHz. It verifies RIFF/chunk sizes, padding, duplicate fmt/data, alignment/byte rate, finite samples, length/channel bounds. It never guesses codec or silently fixes corrupt headers.
- Explicit selected asset and Gain -24..+24 dB. DSP computes sample * 10^(Gain/20), from original PCM each time; no successive destructive processing. Sample peak and RMS are actual values; silence uses null dBFS. Sample magnitudes >=1 are clipping candidates. No LUFS or true-peak claim.
- Imported originals are copied into a new versioned pcmMix field, kept separate from legacy audioAssets/fileReferences and all MIDI Tracks. Each asset holds immutable-by-edit original PCM, bounded Gain history/cursor. A renders the saved gain, B renders the current verified preview. Only one playback at a time; input/Cancel/navigation/commit stop playback.
- Preview computes real before/after signal metrics without writing; Apply rederives and compares the full preview/baseline. State/repository/project/preview changes, unsaved Project/MIDI, recording/starting, unsupported repositories and competing storage fail closed. IndexedDB compare-and-put checks and puts in one transaction; success is transaction completion, abort/quota preserves retryable preview/original.
- Undo/Redo persist only the selected asset's gain cursor; fresh Apply after Undo trims that asset's redo branch. Existing assets/Tracks/other projects/opaque metadata stay unchanged. Project revision and AI workspace revision stay aligned.
- Project JSON, duplicate, makeProject and Backup/Restore preserve actual inline original PCM, gains and cursor. Validation rejects malformed imported PCM/history before restoration. Inline PCM is explicitly flagged in Backup; binariesIncluded remains false because external references are not embedded. This is not complete binary Backup certification.
- Single applied-asset PCM16 WAV export uses real sample data and refuses peak >1 rather than silently hard-clipping. Quantization may round +1 to 32767; it is a 16-bit output, not lossless Float32 export. No Master/Instrumental/Stem consolidated render/export.
- Bound: 2,000,000 channel samples total per project, 32 assets, 64 gain edits, 64 MiB serialized project; long full-song mixing is still a capacity limitation. At 48 kHz this is about 41.67s mono / 20.83s stereo across all assets. Asset original amplitude must be finite and <=16. Unsupported/oversize input never overwrites data. JSON exports with inline PCM use compact serialization; oversized PCM Backups refuse export and direct users to individual project JSON.
- Entry points use Studio asset 1.4.123; all existing exact-version assertions are updated, none weakened/deleted. No new external dependency, model/binary/package installation or Provider traffic.

## Requirement classification

**No.18 formal lower requirements:** Volume = partial overall, actual bounded selected-asset Gain implemented; EQ = unimplemented; Compression = unimplemented; space = unimplemented; accompaniment conflict = unimplemented; vocal audibility = unimplemented; multiple Mix proposals/comparison = partial (real saved/candidate A-B, no AI multi-track proposals). Whole No.18 = partial. Original protection, Preview/Apply, Cancel, Undo/Redo, persistence/reopen/JSON/Backup/error recovery of this scope implemented and regression-tested. Audible/physical acceptance remains device-only; browser acceptance UNVERIFIED.

**No.19:** multiple Master proposals unimplemented; LUFS unimplemented; Peak/Clipping actual primitive implemented, mastering integration/true peak unfinished; final loudness check partial sample-level only. Whole No.19 remains partial foundation, not Master completion.

**No.21:** single WAV actual output newly implemented; inherited MIDI export implemented; Master WAV/Instrumental/Stem/consolidated package/pre-release checks remain unimplemented or integration unverified. Whole No.21 partial.

All other rows inherit their cited last audit; this patch does not newly certify unseen requirements. “Unverified” means completion cannot be confirmed, not proof that all code is absent.

|No.|Feature|Current software lower requirements / remaining gates|
|---:|---|---|
|1|MIDI/Track edit|Partial existing editor/velocity/quantize/length/mute/solo/multi-track/partial/correction/cleanup; all expanded requirements not certified|
|2|MIDI recording|Partial recording/count-in/metronome/save; hardware/playback device-only|
|3|Song structure|Partial BPM/Key/Scale/meter/maps/transpose; complete analysis/section alignment unverified|
|4|AI new song|Partial safe candidate workflow; real text/lyric to full composition backend open|
|5|AI assistant|Partial panel/routing/workflow; natural conversation/multi-task/completion backend open|
|6|AI safe editing|Partial preview/lock/candidates/adoption/history/Undo; selective-change Undo full scope unverified|
|7|Composition/development|Partial continuation/section references; real continuation/second verse/final chorus/intro/interlude/outro/time version/partial regeneration open|
|8|Arrangement|Partial reference/Track/destination checks; real single/multiple-track generation/apply open|
|9|Chord assistance|Partial local candidates; audio analysis/voicing/follow correction full flow unverified|
|10|Lyrics/melody|Implemented explicit manual reading/note assignment from #350; whole feature partial; AI lyric generation/rewrite/count/accent/two-way and partial/full regeneration open|
|11|Guide vocals/dialogue|Real singing generation/listening-dialogue edits unverified; model/rights approval pending|
|12|Vocal recording|WAV/input/monitor/latency/Punch/Cycle/Take/Comp/scroll completed flow unverified; physical acceptance pending|
|13|Vocal edit|Waveform/lyrics/notes sync/Pitch/Timing/length/Crossfade/Breath/Vibrato non-destructive full flow unverified|
|14|Vocal/Harmony|Actual Harmony/Double/Chorus/own-voice backend unverified; consent/license/voice approval pending|
|15|Vocal final check|Guide/Take/pitch/timing/range comparison and repair/rerecord decision backend unverified|
|16|Stem separation|Partial pipeline implemented; approved actual bytes/runtime/model/policy and physical quality pending|
|17|Audio-to-MIDI|Partial pipeline/repair implemented; approved assets/Intel six-note quality device acceptance pending|
|18|AI mix|NEW partial actual Volume/PCM/A-B/save/recovery; other lower requirements listed above open|
|19|AI mastering|NEW actual sample Peak/Clipping primitive; multiple Master/LUFS/true peak/final loudness integration open|
|20|Logic round trip|Partial SMF; new local single WAV transferable but finished WAV/Stem return/diff mapping/full checks open; .logicx undecided|
|21|Final export|NEW single actual PCM16 WAV; inherited MIDI; full package/render requirements above open|
|22|Save/versions|Partial project/autosave; NEW persisted per-asset Gain history; whole partial version composition unverified|
|23|Backup/recovery|Partial atomic metadata/binary foundations; NEW inline PCM restoration validated; production complete-binary/migration acceptance open|
|24|Diagnosis/repair|Partial dependency/storage diagnostics; all performance/lightening/automatic repair flows unverified|
|25|Execution/protection|Partial local/fail-closed identity/lifecycle; actual production binding/Intel/Apple Silicon/policy/physical gates open|
|26|AI cost|Pre-run pricing/monthly caps/per-AI accounting backend unverified; Provider approval pending|
|27|Models/compatibility|Partial capability/runtime identity; approved models/light switching/quality/old model/update test full flow open|
|28|Smart UI|Partial settings/task/assistant foundations; favorites/full task UI/natural language navigation unverified|
|29|Material/library|Material save/Key-BPM adaptation/text search integrated reusable backend unverified; unchanged|
|30|Final/history|Completed-version freeze/song search/sessions/daily chronological integrated flow unverified; unchanged|

## Validation and acceptance

Local PCM suite: 47/47 PASS, zero skip. Full Node: 1915/1915 PASS (1868 inherited + 47 new), zero skip. Full Python: 508 run/503 PASS/five unchanged optional-dependency skips; no Python behavior changed. All JS syntax (179 including browser script), Python compile 53, shell syntax five and git diff --check PASS. PCM tests verify exact independent numeric signal values, real integer/float WAV bytes, A/B real buffers, preservation of other data, branching Undo history, round trips, quota/conflict/repository/state errors and IndexedDB completion/abort.

Browser script scripts/music-pcm-mix-browser.js covers 1440/820/390, actual IndexedDB save/reload/Undo/Redo, A/B, overflow, console error/warn/pageerror/external traffic. Chromium executable is absent; actual display/browser console/external 0 UNVERIFIED. No browser/model/binary installation performed. Local Swift/Xcode unavailable: UNVERIFIED locally.

New music-pcm-offline.yml uses branch-create event and preexisting runner tools only for full Node/Python/syntax/whitespace and Swift/unsigned macOS/iPad Simulator builds. Commit [skip ci] suppresses existing push/PR workflows containing installation/signing; their definitions stay untouched. Exact-head run/jobs/log evidence will be appended to the new Draft PR after publication. Unsigned builds are not device or distribution acceptance.

Software completion percentage **cannot be confirmed**: formal v1 full lower requirements have no verified decomposed denominator/weights. Count of tests is not a completion denominator. No 99%/100% claim. Readiness 100% not reached. formal A **0/30 confirmed**, Stage 2 OPEN, Stage 3 NOT PASSED; production binding/backend/policy/physical gates remain mandatory.

Shortest next functional target: actual EQ and Compression processing through the same protected PCM preview/history/save path; then LUFS/true-peak and master rendering before consolidated export. Larger full-song assets need scalable binary storage integration rather than raising inline JSON limits without recovery evidence.

No user operation required now. Consolidated later physical session: approved package/Gatekeeper/offline runtime, Keystation MIDI recording/playback/save, six-note conversion, vocal workflow, Mix A/B listening/Undo/save/reload/export and Logic return, Backup migration/iPad compatibility. Close software gaps/browser acceptance/assets/license/policy/distribution first. Existing main/PRs/user songs/real Backups untouched; no Ready/Merge/Auto Merge/force push, no non-vocal recording or 0.1 sale.
