# Measure lock compatibility — 2026-10-01 JST

This is an opt-in Editor API foundation, not an enabled browser feature. It implements
Tia's exact-tick A policy for new lock operations when supplied with #265's meter API.
No existing song or backup is migrated or written automatically.

## Existing contracts and connection points

| Path | Current behavior | Required integration |
| --- | --- | --- |
| Editor trackState / partState | Track ID state, then core part, then Melody legacy root | Capture those exact existing locks before reinterpreting bar numbers |
| measureRangeToTicks / position | Initial scalar meter only | Use #265 for new numbered ranges and position display |
| savePartState / snapshot / restore | MIDI data cloned; track/part states reconstructed | Store explicit protection under editor.measureLocks, outside reconstructed scopes |
| scoped repair preview / apply | Initial-meter numbered locks | Guard both source and destination tick overlaps at apply |
| note mutation / candidate apply | Several paths only check note.locked or replace notes | Route every committing mutation through the transactional protection guard |
| ruler / visible bars / timeline length | Uniform bar widths and scalar measure count | Coordinate A positions, labels and configured end tick before enabling new locks |
| snap / loop / Tempo change UI | Scalar bar length or whole-note fraction grids | Use exact measure starts for bar snap; never move existing events on load |
| timeline resize | Scalar bar length; trims numbered lock arrays | Refuse removal of protected empty space as well as protected notes |

Files needed for enabled integration (music-studio-editor.js, music-studio.js,
app.js, music-studio.html) overlap #259/#261/#262. This Draft changes none of them.
Do not replace only exported range methods: internal Editor closures would still
calculate legacy ranges and the uniform ruler would label different positions.

## Serializable additive state

editor.measureLocks version 1 contains the normalized legacy scalar PPQ/meter,
Track IDs, original legacy measure numbers and their exact half-open tick ranges,
and separately recorded new rangeLocks. Existing lockedMeasures arrays remain
unchanged. The existing project's schemaVersion is unchanged.

The old ranges come from the actual Editor's measureTicks, with the same Track ID
precedence. createSession checks raw lock arrays before the old normalizer filters
them. Missing legacy timing uses the existing Editor's documented code defaults in
its working copy, not a guessed rewrite of the source. Invalid lock numbers,
duplicate Track IDs, unknown state versions and stale/corrupt contexts fail closed.

For PPQ480 and 4/4 -> 3/4 at tick960, old lock 1 stays [0,1920). A new lock for
measure 2 is [960,2400). One does not overwrite or enlarge the other's stored range.
Changing the meter map does not recompute recorded protection. Changing scalar
PPQ/meter requires a separately reviewed operation; this guard rejects it.

addMeasureLock composes the real #265 meter API with the existing Editor Undo
transaction. edit runs synchronous existing Editor operations on a working copy,
then validates both sides of every protected note, new notes entering protected
space, lock state, metadata and timeline shrink before committing the session.
Exceptions, stale contexts and rejected operations leave the original session and
Undo/Redo unchanged. It does not itself persist any data.

## Storage and backward compatibility boundary

Existing makeProject, JSON import, IndexedDB repository, saveMidiEditor and
Backup/Restore copy MIDI data without stripping editor.measureLocks. Existing
Editor normalize/save/Undo/Redo preserve this top-level field. These routes have
synthetic regression tests using only fake or memory repositories.

Older Editor code preserves the new field but does not enforce its new rangeLocks.
Therefore browser adoption/downgrade editing is NOT approved by this unit. Before
enabling it, all committing paths must use the guard and the UI must display exact
old/new tick protection, including partial overlaps. There is no automatic unlock,
old-number reinterpretation, fallback quantization, or automatic migration here.

## Immutable dependency and verification

The CI fetches #265 commit 7d2f0f49cdbc56e57fab6cef9a64681cc6168c8c solely to read its
meter module into RUNNER_TEMP. The integration script uses that real module, not a
stub or copied implementation. It verifies normal 4/4 and 3/4, boundary and off-bar
changes, multiple changes, denominator changes, 7,000 individual legacy ticks per
case, new lock boundaries, unchanged notes/events, JSON reopen and Undo/Redo.

The full-suite guard separately compares this main-based Draft against main. Known
baseline failures remain failures; no tests or validation are weakened.

No UI/console or Mac/iPad real-device result is claimed. No remote integration
branch, Ready, Merge, Auto Merge, force push or external Provider/AI call is used.

## Explicit partial unlock (2026-10-01 Tia decision)

An explicit range unlock subtracts only its half-open tick interval from effective protection. Version 1 accepts optional additive `releaseRanges` per track; legacy numbered locks and captured legacy ranges remain unchanged. Relocking removes only the overlapping release interval. No release is created at load time. Note-level locks are independent. Legacy range capture uses initial scalar meter directly, never the integrated Editor's shortened A bar.

Regression-first validation: seven new tests failed before implementation, then all 32 focused tests passed. Seven immutable #265 cases, including 6/8, scan 7,000 ticks each after partial unlock, and exercise Undo/Redo and JSON reopen. Synthetic IndexedDB/save, actual JSON import, and Backup/Restore preserve partial releases without modifying sources. Browser integration is still a separate coordinated unit; this module alone does not activate A UI or bypass legacy closures.
