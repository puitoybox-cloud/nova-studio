# Music Studio — compact recording/editing and durable take operations

Date: 2026-10-13 JST. Source: freshly retrieved main and all 156 Open PRs (154 Draft); each Draft's current HEAD/base, mergeability, changed files and exact-head Actions; all 22 unsuccessful historical runs and 21 failed-job logs read. Latest commit objects verified from the fresh clone. Source specification: Music_Studio_最終機能仕様書_v1.pdf, 2026-09-30, five pages / 166 lines freshly read. No attachment images are required for these code changes.

Base: #409 / feature/music-ipad-recovery-production-v1 / fde6933fa5b8e83cf44f802fd5d0683c90719c6c. Freshly Draft/Open/mergeable, six current-head workflows successful. Main: 552d56eafddfd192970c09f7d6278696cf8775c3. Prior checkpoints are not assumed.

## Connected changes

- Previous/Next take operations use atomic existing selected-take persistence. Strict boundaries and unknown directions reject; original recordings and Mix adoption remain unchanged. Selection survives a fresh app and Full WAV Archive identity remapping.
- Comp segments can be moved earlier/later, retaining source edit snapshots. The new order changes actual WAV output, is one Undo/Redo unit, survives fresh reopen, can be saved as editable WAV, and recovers byte-identical after full archive restoration.
- Manual capture latency now persists in the original recording plan and initializes the next capture after reopen. Old plans without this optional field remain valid; malformed values reject. This is NOT automatic physical latency measurement.
- Project settings/reference imports and project management retain their original forms inside disclosures. The large home hero is omitted from actual project editing; home/list retain it. Recording help, detailed recording settings and Comp are folded. Once saved takes exist, capture controls fold while editing remains visible; active capture remains open.
- The dedicated `/music-studio/vocal/:id` editing route reuses actual recorder/take/Comp operations, gives access to the original Project settings screen, and measures the focused screen separately. No recording or project data is cloned for this route. Project editor minimum height no longer forces an extra viewport below the menu.
- A project-bound MIDI/Vocal/Mix/Mastering/AI navigation row reuses the existing guarded production routes and prevents stale global project selection from redirecting a click.
- 4px label gaps, 6/10px button padding, 12px panel padding and 44px controls are applied to the affected Vocal scope. Advanced panels allow bounded internal scrolling. No fixed page overflow clipping is added: remaining overflow stays observable.

These are three durable production operations plus a scoped UI integration. The requested 20–30 meaningful-item target and whole-product completion are NOT claimed.

## Verification and limits

Local final full Node after the focused route and capture fold: 2196 PASS / failures 0 / skips 0. New Vocal suite: 38 PASS / failures 0. Python: 509 executed, 504 PASS, five existing unavailable dependency skips. All 198 tracked JavaScript syntax and whitespace checks passed; changed files rechecked after final edits.

Local Chromium installation failed because the downloaded ZIP was invalid/truncated. Local browser PASS is not asserted. Draft CI runs the full existing real Chrome scenarios at 1440/820/390 and 1180x820, including capture/pause/resume, edited WAV, original MIDI retention, reopen and Full WAV Archive byte equality. Recording report now separately records the default compact screen's scrollHeight/scrollWidth/viewport and disclosure state before advanced panels open. Vertical/horizontal overflow must be read from this artifact; screenshots alone cannot prove one-screen completion. Swift 105 PASS and unsigned macOS/iPad builds on #409 are previous-head evidence only; this change requires new-head results.

Real Intel Mac/iPad Safari/microphone/Keystation/Logic/Gatekeeper are unverified. Common Play/Stop/Record/Save positions across ALL editors, a fully split Mastering page, exhaustive dialogs, and all-screen one-screen completion remain unfinished.

## Formal 30-feature ledger

A requires production binding + backend + policy + physical acceptance. B requires ONLY physical acceptance remaining. No feature is promoted from the previous conservative C without complete production proof. The following checks against the current code and specification retain A0/B0/C30; this is a blocker/evidence ledger, not a quantitative percentage.

| No. | Current code evidence | Result | Nonphysical remaining obligation |
|---|---|---|---|
| 1 | music-studio-editor.js; shared Track editing | C | complete target-track/partial-edit product acceptance mapping |
| 2 | music-studio-midi.js; bundled/native MIDI scenarios | C | native distribution/runtime/assets closure |
| 3 | tempo/key/meter maps and transpose | C | real BPM/Key/Scale/section audio analysis quality |
| 4 | music-studio-ai-composition.js | C | practical language/lyrics-driven generation model |
| 5 | music-studio-ai-assistant-panel.js | C | conversational multi-task planning and execution |
| 6 | AI preview/apply/history and edit locks | C | cross-domain specific-change Undo conflicts |
| 7 | AI continuation/family candidates | C | practical full section/time-constrained regeneration |
| 8 | arrangement reference/destination inspection | C | complete regenerated audio/instrument production execution |
| 9 | chord candidates and metadata | C | actual chord analysis/voicing quality |
| 10 | lyrics assignment and guarded previews | C | language generation/accent and practical regeneration |
| 11 | lyric/note data contracts | C | approved real singing renderer and conversational edits |
| 12 | vocalStart/Stop/Save, cycles, Comp, manual latency | C | measured latency and gapless cycle recording |
| 13 | vocalEdit/Render/CompMove and waveform/lyrics correction | C | formant/vibrato correction product implementation |
| 14 | harmony MIDI and preview audition | C | real singing/Double/Chorus assets, consent/license/runtime |
| 15 | vocal analysis and candidates | C | integrated guide-vocal/final-quality decision workflow |
| 16 | Python Demucs adapters and native receipts | C | approved assets/package closure and real quality acceptance |
| 17 | Python conversion/refinement and compare UI | C | approved packaged runtime/assets and full accuracy acceptance |
| 18 | PCM/long-WAV gain/EQ/compression/spatial proposals | C | full non-destructive multiple Mix-version product workflow |
| 19 | productionPreview/master and longMaster/final export | C | multiple Master proposals and measurement quality acceptance |
| 20 | MIDI/WAV import/export retained references | C | full Logic correspondence/difference/roundtrip management |
| 21 | finalPreview/Save/Replay/Download/delivery history | C | real MIDI sound-library rendering and distribution checks |
| 22 | IndexedDB/revision/duplicate/history | C | named checkpoints and partial version composition |
| 23 | full binary archive/restore/legacy validation | C | complete dependency/migration/cloud-sync architecture |
| 24 | scoped diagnostics and validation | C | whole-product performance diagnosis/safe repair execution |
| 25 | offline guards and native processing boundary | C | complete owned native isolation/runtime distribution closure |
| 26 | provider execution remains disabled | C | approved priced-provider ledger/reservations/caps |
| 27 | adapter/provenance/model contracts | C | actual interchangeable approved models/version quality checks |
| 28 | workspace/favorites/project-bound navigation/folds | C | full natural-language UI actions and all-screen layout closure |
| 29 | retained assets/notes/source files | C | complete reusable material save/key/BPM adjustment/text search |
| 30 | production/export histories | C | finished-version locking/search/session/daily timeline |

Safe next step: inspect new-head browser measurements and fix the remaining visible overflow; continue actual local production rendering/approved asset integration without claiming physical or policy acceptance.

Safety: only a new Draft branch/PR. No main/other PR mutation, force push, Ready/Merge/Auto Merge, source-data deletion or Live Provider API. No external model or production binary download.

Initial-head UI CI failed because an old scenario tried to select a now-folded recording setting without opening its disclosure. The scenario now opens the settings via actual visible UI; no assertions or scenarios were removed. Final-head CI must pass before transfer of any result.

Landscape follow-up: the focused selected-take screen places recording/take/Comp controls in a 260px dock beside the waveform/editor. All-take mode can remain taller; no editor is clipped or deleted. Closed advanced/Comp disclosures remove redundant outer padding; checkbox labels gain a 44px touch region. Final asset keys are synchronized to 1.4.149. New-head browser measurements and exact-head checks remain required.

A successfully committed recording atomically selects the new take for editing; failed/quota-aborted recordings cannot change selection. No take is adopted to Mix by this editor selection. Explicit All remains available to view retained older takes. This prevents a completed multi-cycle capture from defaulting to a stack of all editors.

Comp disclosure opening is tracked per project in the current UI session and retained across edits/Undo/Redo paints, without adding project/backup metadata. Browser operations explicitly open the visible Comp summary. Initial CI failures were disclosure visibility regressions in old scenarios; all original assertions remain.

Measured ce32113590b7a645a3123fa1ebdc7a76c266734f UI: 1180x820 capture scrollHeight 861 (+41), selected editor 1094 (+274), horizontal false. All six workflows passed but one-screen completion was NOT achieved. SHA256-verified UI artifact 11814116823 (6ef835e49f3542bdf9da762c81c72c953bbe310d8c2f078eacf79dd48afdf666) was independently read and screenshot inspected. It revealed an always-visible empty lyric help block, expanded rename metadata, shared-CSS form/margin overrides, and a white-on-white generic header.

Follow-up fixes fold empty lyric help and rename settings, retain actual live assigned lyrics, apply focused grid spacing after the shared compact stylesheet, and explicitly style the focused heading/disabled controls. Fractional manual latency now has a valid native number-input step and reopen/restore regression. Asset versions: Studio 1.4.150 / shared compact UI 1.0.3. A separate fast Chrome layout job measures 1440/820/390 and touch-emulated 1180x820, retains screenshots/reports, and asserts no overflow for the iPad fixture; the full original integration suite remains. Final measurements/CI are pending and cannot inherit old-head PASS.

Fast 554d2b1 exact-head layout passed with 1180x820, touch=1, DPR=2, both record/edit scrollHeight=820 and scrollWidth=1180, visible controls >=44px, heading contrast 15.11:1 and console/external empty. SHA256-verified artifact 11819060367 (01905c2e7a679a16e77a6f39c82e0016203e84454cf4b107879b1117f98e817a) and both screenshots were independently inspected. Image QA caught the inherited generic `nav { position:sticky;top:84px }` partially covering production tabs. Scoped production nav now stays in normal flow, compact stylesheet version is 1.0.4, and the fast layout test checks nav bottom <= heading top. All original assertions remain. The local executor disconnected before this last fix; these final edits were made from freshly retrieved immutable GitHub files, JavaScript was parsed with V8 without execution, and new-head CI remains mandatory. No local final-head shell PASS is asserted.
