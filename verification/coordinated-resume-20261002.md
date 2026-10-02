# Music Studio coordinated A timeline — verification record

Verified 2026-10-02 JST. This independent checkpoint reconstructs the actual GitHub PR262–267 sources and connects their modules to the browser and the Editor's internal closures. The former unpublished 907-test prototype was not available and was not treated as published source.

## Fresh source verification

| Source | HEAD |
| --- | --- |
| main | 552d56eafddfd192970c09f7d6278696cf8775c3 |
| PR262 | a857c27674d6949488ff8884948499966f9bca40 |
| PR263 | 9c877b267a181b560332e07071b7f86539eb1cbf |
| PR264 | c052f1614155f8ccd8e84235d6218e81ccc53758 |
| PR265 | 7d2f0f49cdbc56e57fab6cef9a64681cc6168c8c |
| PR266 | 0101b246e219e3307ef55836b372f36fa331fa48 |
| PR267 | f06cf5ac29d2fa96857ce0dc623d6e1696f016a6 |

These heads were retrieved afresh at the start and rechecked at completion. All six existing PRs remain Draft. PR267 CI [36880714212](https://github.com/puitoybox-cloud/nova-studio/actions/runs/36880714212) completed SUCCESS. Main and PR256–267 were not modified.

The six exact source heads were combined without textual conflicts. This is a new reconstruction; it does not claim to reproduce the earlier local prototype with four conflict files.

## Implemented behavior

- Browser loaders activate coordinated sessions and require meter/lock dependencies with TRANSACTION_REVISION 1. Missing or stale dependencies fail closed.
- Internal Editor range/position, timeline size, measure targets, quantize, correction, candidates and repair use the A meter timeline. Export replacement alone is not the implementation.
- A new bar begins at the exact meter-change tick, including a change inside a bar. Earlier bar is truncated. Source meter and tempo event ticks are preserved.
- Whole-command and internal change transactions validate protection. Failed commands restore session, Undo/Redo, selections and previews. Rejected nested mutations cannot be swallowed.
- Covered commit paths: move, resize, delete, add, recording add, paste, repair apply, candidate apply, timeline resize, measure/range lock, partial unlock and Undo/Redo. Corrupt historical lock state is rejected without consuming Undo.
- Existing lockedMeasures aliases and legacyRanges retain legacy tick protection, including different alias values. Additive range locks and releaseRanges coexist; partial unlock releases only the exact selected interval. Explicit note-lock commands remain supported.
- Ruler, segmented repeating grid, snap, visible range, pointer resize, measure add sequence and candidate ends use exact ticks, including truncated bars. Grid complexity is bounded by meter segments.
- Recording receives a frozen tempo map and recording origin; onset, release, playhead and loop Stop use existing Playback timing services. Metronome closure schedules exact meter beats through tickDurationSeconds, with accents at new bar starts. Count-in remains a static local bar.
- View initialization does not persist on load. Explicit edits or view interaction permit normal persistence. No saved-song migration or actual-user-data modification was performed.

## Tests and baseline

| Tree | Total | PASS | FAIL |
| --- | ---: | ---: | ---: |
| unchanged main | 774 | 768 | 6 |
| unchanged PR267 | 806 | 800 | 6 |
| exact-source synthetic PR262–267 | 874 | 874 | 0 |
| final coordinated reconstruction | 903 | 903 | 0 |

PR267's six failures exactly match main. New failures zero. Combined PR262 sources already resolve these six baseline failures; none were disabled or skipped. Exact asset-version assertions were updated with the corresponding loader versions.

Baseline identities: production entry Review-capable Editor asset keys; runtime version/Review API markers; host Music Studio cache key; sequential dependency loading without detached-script queries; current iPad gesture assets; invalid Track IDs preserving the entire session.

Final suite adds 29 tests: 6 recording timing, 16 coordinated Editor, 4 actual browser-closure timing/loading, 3 coordinated persistence. All 109 JavaScript files pass node --check. git diff --check passes.

The immutable seven scenarios PASS: 4/4, 3/4, 6/8, bar-boundary change, mid-bar change, multiple changes and denominator change. They verify legacy ticks, exact new ranges, additive partial releases, JSON reopen and Undo/Redo. A separate temporary invocation of the same seven scenarios through createCoordinatedSession also PASS.

Coordinated persistence tests use synthetic projects and memory repositories for save/reopen, actual JSON export/import and Backup/Restore. They verify source nonmutation, legacy/new/release coexistence and original event positions. Existing fake IndexedDB tests also PASS. Native IndexedDB is additionally checked in the real Chrome harness. No actual saved songs or backups were used.

## Real browser evidence

Local Chromium installation failed due to truncated ZIP downloads. The independent checkpoint workflow subsequently used runner-installed Google Chrome 154 and actual standalone Music Studio UI, rather than claiming VM tests establish browser rendering.

Verified source commit: ccae589316961596a92e39c0a310ab5ab8b84594.
[Successful real Chrome + full Node workflow 36969120620](https://github.com/puitoybox-cloud/nova-studio/actions/runs/36969120620).
This run tests 900/900; the final three added persistence tests are recorded separately above and included in the subsequent exact-head checkpoint workflow.

| Viewport | Functional harness | Console error/warn/pageerror | External requests | Writes on load | Document width |
| --- | --- | ---: | ---: | ---: | ---: |
| 1440px | PASS | 0 | 0 | 0 | 1440px |
| 820px | PASS | 0 | 0 | 0 | 820px |
| 390px | PASS | 0 | 0 | 0 | 390px |

Each fresh browser context verifies:
- actual coordinated session and bar 2 range [1000,1720);
- ruler position 1000 / 9400, allowing only browser CSS decimal serialization;
- protected core edit, DOM-dispatched move and resize rejected; editable pointer move accepted;
- legacy partial release [100,200), new range [8500,9000), explicit edit/save/reopen;
- native IndexedDB roundtrip retaining protection;
- unchanged meter event tick 1000 and tempo event tick 777;
- no console warning/error/pageerror, no attempted provider/external request.

The screenshots were downloaded and visually inspected at all three widths. No horizontal document overflow occurs. Short A bars produce crowded ruler labels at 390px (also small adjacent labels at 820px); narrow track controls are compressed. This is a recorded display limitation, not a claim of flawless mobile layout. Linux runner lacks Japanese fonts and shows Japanese glyph placeholders; Japanese-language rendering on the target devices remains to be checked. DOM event dispatch tests editor handlers; it is not physical touch/pencil verification.

Earlier harness failures were resolved: CSS decimal precision expectation, a real load-time save fixed in source, and an editable test note accidentally dragged into its synthetic new protection range. The guard correctly rejected that last edit; the fixture moved its new lock outside the edited note. Final assertions preserve strict console and protection checks.

## Remaining limits and device-only checks

- Actual Mac/iPad/iPhone browser rendering, physical pointer/touch/pencil gestures and Japanese fonts.
- Real MIDI device permission/connect/disconnect and recording across tempo/meter changes; audible metronome accents and audio/MIDI latency cannot be established by headless timer tests.
- Intel Mac Audio-to-MIDI helper/device checks from PR262 remain a separate task. No claim of those checks completing.
- 390px narrow controls and short-bar ruler label density remain a display issue for review.
- No production deployment, Ready, Merge, Auto Merge or force push. No Live Provider or External AI API traffic.
- The integration is for independent Draft review only; existing PRs retain their original purposes.

The checkpoint branch was explicitly authorized for unfinished work and verification records. A separate integration Draft PR may only be created after the final source checks and real-browser evidence pass.
