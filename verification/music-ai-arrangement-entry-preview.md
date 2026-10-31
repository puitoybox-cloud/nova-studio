# Exact Arrangement entry anchor previews — 2026-10-03 JST

## Source and selection

Fresh GitHub main, Open PRs, all 27 Draft details/latest HEAD/mergeability/workflow runs, Issue #255, #282 body/source, docs/music-studio/MS-00B_PROJECT_DATA_CONTRACT.md and existing verification/tests were read. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3; #282 remains b2075209428dedd91775de52ea45585ed9ba7bbd. Audit JSON records every Draft; all heads unchanged, mergeable clean and returned CI SUCCESS. Baseline node --test 1139/1139 PASS.

Arrangement already defines role names, an entry measure and Section/Chord references. Its companion previously only copied those fields; explicit individual partial Preview ignored selection. This existing metadata can safely be displayed as exact measure entry anchors without choosing instrument mapping, sounding duration, voice allocation or carry-in/sustain policy. Lyrics text/note allocation, instrument rendering, Section replacement and further Continuation policy lack a sufficiently specific existing contract for those decisions and remain separate work.

## Behavior

Individual Preview, Family Preview and selected Family Apply Plan expose exact entry measure/tick windows from the coordinated meter map. Entry anchors outside the partial selection show zero; they never move to the selected start or imply silence/sustain. Roles are planned roles, not resolved track IDs or instruments. UI explicitly says instrument rendering is unallocated.

Original entry, roles, register, density, dynamics, refs and unknown fields remain unchanged. Derived timelines stay outside stored workspace. Invalid source range, entry, role list, reference, selection and tick conversion fail closed at explicit Preview/adoption/Family Plan. Legacy malformed data loads/renders without repair, migration or writes. In particular, the existing one-bar B generator's entry falls outside its candidate range and explicit Preview rejects it; no inferred short-range generation policy was added.

The existing Family transaction supplies dependency/conflict rejection, stale-source checks, rollback, atomic adoption Undo/Redo and saving. No new schema or instrument project writes were introduced.

## Validation

Updated node --test: 1165/1165 PASS, FAIL 0, skipped 0. All 128 JavaScript node --check and git diff --check PASS.

26 added regressions: changing-meter entry tick 1000–1720; partial 0/1 anchors; malformed excluded source/reference/roles; missing/failing/fractional/overflow/inconsistent resolver; stale plans; Family refusal with MIDI/workspace/history unchanged; metadata-only atomic Undo/Redo; full Save/Reopen/JSON/Backup Restore; reconstructed timeline; legacy load/render write 0.

Chrome smoke adds partial/empty/invalid-ref/outside-range Arrangement cases at 1440/820/390, explicit adoption Save/Reopen, instrument unknown-field preservation, layout, zero console/pageerror and zero external requests. Existing Family normal/refusal/partial/atomic Undo/Redo, Project Section and Lyrics flows run in the same suite. Final GitHub Actions and screenshots are recorded in Draft PR #283; physical devices remain unverified.

## Preservation and physical acceptance

Independent branch feature/music-ai-arrangement-entry-preview-v1 based on #282. main and all existing PRs are untouched. No real song/backup edits, feature/data deletion, migration, external AI/provider/API-key calls, Ready/Merge/Auto Merge or force push.

Intel Mac/Chrome and M1 iPad/Safari: separate synthetic changing-meter project; Arrangement B Preview M2–3 shows one entry at M2/tick 1000–1720; M3 alone shows zero; invalid outside range refuses. Family Section+Chord+Arrangement metadata-only Plan → Preflight → Cancel → Plan → Preflight → Confirm → Undo → Redo → Save → Reopen. Check Japanese rendering/touch. Keystation recording/playback remains a physical-device regression check; Intel Mac Audio-to-MIDI accuracy is separate from this unit.
