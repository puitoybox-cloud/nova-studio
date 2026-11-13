# Exact Lyrics Structure anchor Preview

2026-10-03 JST. Start: fresh GitHub main/open PRs/issues plus all 26 Drafts #256–#281, latest HEAD/mergeable/returned CI. Every Draft was mergeable with returned CI success; #279 is c6a73c24706e31a95120201f1b552dbca43f6312. Main is 552d56eafddfd192970c09f7d6278696cf8775c3. Independent branch feature/music-ai-lyrics-exact-preview-v1 based on fresh #281 f0d13fc8c355f624210538ca0d7655b8b2abea57. Audit is music-ai-lyrics-exact-preview-audit.json.

## Missing feature reproduced

Actual #281 code had no lyricsTimeline API. Lyrics Preview with M2–3 still returned all four phrase slots, no exact ticks; malformed excluded stress was accepted. Section Project Apply is already implemented there and is not rebuilt here. Tracking issue #255 and prior verification/TODO records separate physical audio/MIDI acceptance from code-only development.

## Result

Lyrics Structure Preview now converts existing measureSlot anchors through the coordinated Editor meter map. Individual candidate Preview, Family Preview and selected Family Apply Plan display exact anchor measure/tick windows, line IDs, syllable counts, stress pattern and the existing linked Melody candidate/phrase slot. Explicit M2–3 at the tick-1000 meter change displays only line 2 [1000,1720) and line 3 [1720,2440). Original source lines stay intact. Distinct lines sharing a short candidate's measure remain distinct. A selected interval with no anchor shows zero; no outside line is moved into it.

These are measure anchors, not inferred sung durations, generated lyrics or note assignments. The UI says note assignment is unallocated. Stress S/w means strong/weak; long patterns are visually abbreviated only. No MIDI or project lyrics/syllableAssignments write is introduced. Derived timelines are runtime Preview fields and are never persisted in the workspace.

Every original line is validated before filtering. Invalid/descending/outside measure, duplicate/descending line IDs, missing phrase slots, invalid syllable/stress counts/values, missing lines, line-count mismatch, incompatible Melody variant/family, invalid selection and invalid/unavailable ticks reject without MIDI, source, history or repository mutation. Direct individual Lyrics adoption also validates first, so rejecting Preview cannot be bypassed using its adoption button. Candidate outcomes/errors are now visible in the candidate tab.

## Validation

- Fresh #281 baseline node --test: 1109/1109 PASS, fail/skipped 0.
- Implementation node --test: 1139/1139 PASS, fail/skipped 0; 30 new regressions. Existing tests remain, including all Family transaction/range/metadata-only/project-section/rollback cases.
- New core/integration coverage: exact changing meter, partial/all/short/empty anchor selection, malformed excluded source, unavailable ticks, partial metadata Family Plan/Preflight/Apply/one Undo/Redo, direct adoption refusal, preservation of stored Lyrics/syllableAssignments, Save/Reopen/JSON export/import/Backup Restore, and legacy unverified candidate load/render write 0.
- All 127 tracked JavaScript node --check PASS; git diff --check PASS.
- Browser smoke retains all previous flows at 1440/820/390, adds Lyrics Family metadata Plan/Preflight/Cancel/Confirm/Undo/Redo/Save/Reopen and individual exact Preview/adopt/Save/Reopen plus invalid-range/malformed-source refusal. It checks no preview/rejection/load writes, retained project text/assignments, no persisted derived timeline, no horizontal overflow, console error/warn/pageerror and external requests.
- Initial checkpoint 12532dd9b05e1e1b24be3a37293faef09c96958c passed CI runs 37102614488/37102614489. Downloaded Chrome artifact 11265853914 matched that HEAD: 1440/820/390 PASS, 78 captures, all error/warning/pageerror/external arrays empty. 820/390 screenshots inspected. Visual inspection exposed the existing candidate-kind dropdown reset to Melody after Lyrics generation; the final refinement keeps the active kind through Preview/reopen, with UI/browser regression assertions.
- This workspace has no local Chrome executable. Final exact-HEAD real Google Chrome CI, artifacts and screenshots are recorded in the new Draft PR after completion.

## Remaining / physical acceptance

Actual lyric text and explicit note/syllable allocation, Arrangement instrument rendering, Section replacement/edit policy and Continuation policy remain distinct development units. No Live Provider/External AI/API key requests or auto-adoption policy.

Intel Mac/Chrome and M1 iPad/Safari: separate synthetic changing-meter project; Lyrics B Preview M2–3, exact line 2/3 windows and stress; invalid range refuses; Lyrics+Melody metadata-only Family Plan → Preflight → Cancel → Plan → Preflight → Confirm → Undo → Redo → Save → Reopen. Also recheck existing Project Section flow. Inspect Japanese text and iPad touch. Keystation Mini 32 MK3 recording/playback and earlier Intel Mac Audio-to-MIDI accuracy remain physical acceptance, never inferred PASS from Linux Chrome.

No main/existing PR/branch changes, real saved song/backup edits, data/feature deletion, schema change, automatic migration/load-time write, Ready/Merge/Auto Merge or force push.
