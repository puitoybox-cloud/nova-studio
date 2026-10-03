# Exact bounded Section timeline Preview

2026-10-03 JST. Independent Draft #280, branch `feature/music-ai-section-exact-preview-v1`, based on freshly fetched Draft #279 `c6a73c24706e31a95120201f1b552dbca43f6312`. Main and 24 pre-existing Drafts were freshly fetched; all were mergeable and returned successful workflow conclusions. Exact audit is in `music-ai-section-exact-preview-audit.json`.

## Confirmed unfinished behavior

Existing Section candidates describe labels/bar counts but did not show exact timeline intervals. The fresh #279 generator was reproduced with 1, 2 and 4 selected bars: A/B/C totals were respectively 2/3/2, 2/3/3 and 4/5/4. Short plans could claim bars beyond their own candidate range. No existing Family foundation was rebuilt.

New generation bounds every part within its original explicit range, reserves space for later names when enough bars exist, and omits parts only when fewer bars than names exist. Deterministic local-only behavior is retained. Saved candidates are never regenerated automatically.

Section candidate Preview, Family Preview and Family Apply Plan show exact measure/tick intervals resolved by the existing coordinated meter timeline. Partial selections clip Section labels to the selected interval and mark partial parts. Plan/preflight remain non-mutating. Section remains adoption metadata; project sections, timing maps and notes are not changed by Section-only Apply.

Invalid range/selection, blank label, empty/missing plan, nonpositive/fractional bar count, overflow and incomplete coverage fail closed before adoption/MIDI/history changes. Resolver errors also reject. Legacy invalid plans remain untouched on load/render and reject only on explicit Preview/Apply; generate a new candidate instead of migrating saved data. Timeline is derived, not a new stored schema or persisted preview field.

## Verification

- Fresh #279 baseline: node --test 1063/1063 PASS, FAIL/skipped 0.
- Initial checkpoint 9da640f07c949b3b569b9772fb31feabc1693b91: 1079/1079 PASS; all 127 JavaScript syntax checks PASS; whitespace checks PASS.
- Final refinement: 1082/1082 PASS, FAIL/skipped 0. Adds preserving named parts when space permits, exact timeline reconstruction after Save/Reopen/JSON/Backup-Restore, and legacy overflowing-candidate load/render write 0.
- Exact tick fixture: 4/4 -> 3/8 at tick 1000. Full B: A M1-2 [0,1720), B M3-3 [1720,2440), Lift M4-4 [2440,3160). Selection M2-3 gives A [1000,1720), B [1720,2440), without changing candidate or MIDI.
- Full suite retains Family Plan -> Preflight -> Cancel -> Plan -> Preflight -> Confirm -> Apply -> Undo -> Redo -> Save -> Reopen, atomic rollback, partial/component selection, exact ranges, boundary/metadata-only/dependency/conflict/fail-closed rules and persistence.
- Real Chrome smoke retains existing workflows at 1440/820/390 and adds exact Section Plan assertions and malformed Section rejection with zero mutation/writes. Final exact-HEAD CI results/artifacts are recorded in Draft #280 after completion. No local Chrome executable is available; GitHub Actions uses actual Google Chrome.
- Browser routes permit only loopback/data and capture attempted external requests plus console error/warning/pageerror. No provider or external AI path is added.

## Remaining and physical acceptance

Section/Arrangement/Lyrics remain adoption metadata. Project Section writing, new instrument rendering and Continuation dependency policy are separate future units.

Intel Mac/Chrome and M1 iPad/Safari: separate synthetic project, generate Family B for four bars, view Section measure/tick rows; select Section M2-3, Plan -> Preflight -> Confirm -> Undo -> Redo -> Save -> Reopen. Confirm MIDI unchanged. Check touch/Japanese labels on physical iPad. Check normal MIDI partial Apply playback and Keystation Mini 32 MK3 recording/playback separately. Linux Chrome does not establish physical-device acceptance. Intel Mac Audio-to-MIDI accuracy remains a separate pending check.

No main/pre-existing PR/branch mutation, real saved song/backup use, load-time write, migration, feature removal, Ready/Merge/Auto Merge, force push, Live Provider, External AI or API key communication.
