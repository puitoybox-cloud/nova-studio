# Music Studio Family Apply transaction foundation — 2026-10-03 JST

This stacked Draft builds on #276 without changing #276, earlier Drafts, main, saved songs, or real backups.

## Added
- Family Apply Plan for one A/B/C family with explicit component, Track, range, candidate and metadata targets.
- Plan creation and Preflight are non-mutating.
- Preflight rejects family mismatch, missing dependency, stale Project revision, stale Track/role, stale range, stale workspace/candidate fingerprint, lock/protected-range failures, and candidate Apply failures before real commit.
- Melody and Chord/Bass changes are first simulated on a cloned Editor session.
- Metadata adoption is staged on a cloned AI workspace.
- The real Editor receives one validated atomic MIDI snapshot commit only after all simulation succeeds.
- The atomic Editor commit reuses existing change(), lock validation, exact meter metadata protections, and Undo/Redo.
- Family MIDI changes therefore become one Undo unit rather than one unit per Track.
- Partial Family Apply foundation accepts an explicit subset such as Melody-only; Melody and Continuation cannot be committed together in one plan.
- Family Apply UI is explicit: Family Preview -> Apply Plan -> Preflight -> Confirm Family Apply.
- Cancel Plan, Preview and Preflight change neither MIDI nor candidate adoption.

## Safety
- local deterministic/synthetic only
- no provider endpoint, credential, API key, fetch or external network path
- no main/Ready/Merge/Auto Merge/force push
- no load-time write or automatic migration
- protected notes/ranges and exact meter-change ticks remain governed by existing Editor/MeasureLocks validation
- real saved songs and real backups are not used in tests

## Required verification
- node --test
- all JavaScript node --check
- git diff --check
- real Chrome 1440 / 820 / 390
- console warning/error/pageerror 0
- external requests 0
- Family B: Preview -> Plan -> Preflight -> Confirm -> one Undo -> Redo -> Save using a synthetic Project
- failure paths must leave MIDI, workspace adoption and Undo history unchanged
