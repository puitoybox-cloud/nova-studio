# Music Studio CI and keyboard repair — 2026-11-07 JST

Baseline: Draft PR #600, `e0e6c0eeacf564885f9ee13b4996291aab7411aa`.
Delivery: independent Draft PR #601; existing PR branches and main are unchanged.

## Cause and production changes

Actions run 42343504894, job 128316130757 failed at `music-instrument-browser.js:7`: the retained MIDI input popup's Close button intercepted a click on Undo for 30 seconds. The test depended on the former repaint accidentally closing disclosures. Instrument and multisample tests now explicitly close the containing MIDI input popup using its visible control before using Undo; no forced clicks or relaxed storage assertions.

Close now returns focus to the containing popup's summary. Escape closes that popup, including from an input and while an external track is selected. Enter and Space on native buttons, summaries and links are allowed to activate those controls instead of becoming editor transport commands. Existing disclosure preservation, MENU restoration and save guards remain in place.

The completed final-CSS baseline run 42343504922, artifact 13562478634 showed remaining expanded-panel contrast findings in Project, Mix and Mastering. Give nested project management, input profile, master recipe and production controls explicit dark backgrounds and readable foregrounds. Do not infer zero axe violations from a successful inventory job.

Expand the 14-route inventory with a PCM asset and explicit topbar keyboard opening, Escape, focus return and unchanged-note checks. Include axe failure summaries in output. Normalize already-open native disclosures before testing keyboard opening.

## Executed validation

- Full final production Node suite: 2,931 passed, 0 failed/cancelled/skipped; 100,986.544256 ms. Stored summary contains current source/runtime hashes and the log hash.
- Logic/editor keyboard suite: 169 passed, including native activation and popup dismissal/data preservation. External-track suite: 35 passed. Combined prior focused run: 203 passed before the additional native activation case.
- Recording adapter plus Logic/editor focused tests: 183 passed.
- Auto-Finish server: 22 passed.
- JavaScript syntax, whitespace and formal source-hashed ledger validation pass locally.
- Local Chromium launch is blocked by OS `socket() ... Operation not permitted`; browser execution uses GitHub-hosted Chrome.
- Core `music-studio.js` byte-identical to final at `40e90cf1f532389ca3f8f001933f3b75a978b507`: checkpoint/range, finished immutability and PCM/encoded crash recovery passed run 42361193948, job 128369756380; IndexedDB/restart/MIDI/deletion/history passed run 42361193931, job 128369756531; audible A/B passed run 42361193937, job 128369756528. Relevant browser sources were unchanged by later instrument/multisample test edits. The outer recording adapter was subsequently corrected; final browser execution after that adapter change is pending. Evidence JSON files identify these exact executions.
- Latest complete UI/keyboard execution and final-head all-green status are pending at report creation. See the PR checks for current results. Do not treat old-head failures as final-head results.

## Formal acceptance remains 66/135 (48.89%), 69 open

New verified IDs: none. Six verification gaps remain; 63 requirements still depend on the existing 18 specification/model/license decisions.

| ID | Concrete remaining acceptance gap |
| --- | --- |
| MS28-A04 | Complete the updated populated 14-route run, resolve every recorded violation, and cover all recording/AI/candidate/dialog conditional states and keyboard return paths. The inventory alone is not full acceptance. |
| MS28-A02 | Dirty MIDI, count-in/start/record/stop, PCM edits, Archive transfer and final output have not all been crossed with every workspace transition in Chromium. |
| MS12-A02 | Long recording duration × encoding × destination × interruption positions are not all mapped to retained samples, journal consumption, Archive bytes and history after restart/retry. |
| MS18-A02 | Every supported source format, placement and dependency condition lacks a complete independent whole-song reference mix comparison. |
| MS22-A04 | All save entrances lack a complete before/during/after commit, notification-loss, retry, destination-switch and fresh-restart matrix. Existing crash/recovery tests passed again; that does not close the uncovered entrances. |
| MS30-A02 | Special save entrances still need one-to-one session/day/edit/restore event-ID and no-duplication checks for normal, interrupted, uncertain and retried commits. |

No decision-dependent acceptance conditions were weakened. No model/license/provider/Cloud Sync policy was selected implicitly. Intel Mac, physical power loss and actual-song listening remain unverified.

Final local source tree and GitHub tree were compared by git object hashes. Large test/evidence transfers were repaired before final storage; the complete files match locally and remotely. The final-head Actions jobs were all queued at the last observation; final all-green, updated full 14-screen keyboard completion and zero-violation results cannot yet be confirmed.
