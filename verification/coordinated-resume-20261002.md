# 2026-10-02 resume checkpoint — incomplete coordinated browser integration

GitHub was read afresh before cloning. Main: 552d56eafddfd192970c09f7d6278696cf8775c3.

| PR | exact source HEAD |
| --- | --- |
| 262 | a857c27674d6949488ff8884948499966f9bca40 |
| 263 | 9c877b267a181b560332e07071b7f86539eb1cbf |
| 264 | c052f1614155f8ccd8e84235d6218e81ccc53758 |
| 265 | 7d2f0f49cdbc56e57fab6cef9a64681cc6168c8c |
| 266 | 0101b246e219e3307ef55836b372f36fa331fa48 |
| 267 | f06cf5ac29d2fa96857ce0dc623d6e1696f016a6 |

All six PRs remained Draft. PR267 CI run 36880714212 was completed/success. No existing PR or main was changed.

The previous unpublished 907-test prototype is absent from this workspace and was not recovered. This checkpoint was independently reconstructed by merging the six exact public source heads above. These source modules combined without textual conflict. This does not reproduce the old prototype's coordinated browser changes, nor establish that browser integration is conflict-free.

## Verified locally

* Fresh detached main: 774 total, 768 pass, 6 fail.
* Fresh detached PR267: 806 total, 800 pass, 6 fail. Failure identities exactly match main; new failures zero.
* Reconstructed PR262–267: 874 total, 874 pass, 0 fail.
* With recording adapter preparation: 880 total, 880 pass, 0 fail.
* All 105 JavaScript files, including the added test: node --check passed.
* git diff --check passed.
* The existing seven immutable meter scenarios, including 4/4, 3/4, 6/8, boundary/mid-bar/multiple/denominator changes, ran through the measure-lock tests. They cover legacy protection, exact additive partial releases, Undo/Redo and JSON reopen. Memory repository, JSON import/export, synthetic backup/restore and fake IndexedDB cases passed. No actual user songs or backups were used.

The baseline failures are: production entry cache keys select the Review-capable Editor assets; runtime markers expose only module versions and the Review API type; host shell cache-busts the current Music Studio loader; Music Studio dependencies load sequentially without querying detached scripts; Music Studio loads current iPad Piano Roll gesture assets; invalid Track IDs leave the complete session state unchanged. The combined PR262 verification source already resolves them; they were not disabled in this checkpoint.

## Newly implemented, independently tested preparation

music-studio-midi-input.js createRecorder accepts optional tempoMap and startTick. It calls the existing MusicStudioPlayback.tickAtSeconds service for both onset and release, returns relative ticks for the existing browser offset contract, freezes its map during a recording, and fails closed if the timing dependency is absent. The six added tests cover tempo changes from four origins, held-note Stop, event/map preservation and dependency failure. Existing fixed-tempo callers retain their behavior.

**This optional path is not yet connected by beginMidiRecording. Do not claim browser recording timing is fixed.** No meter or tempo source event is moved by this preparation.

## Confirmed remaining integration work

The existing Editor closure still contains scalar arithmetic in measureRangeToTicks, position, timeline extend/remove, measure-target operations, candidates and repair. Its change() commit does not invoke MusicStudioMeasureLocks.validateEdit. Importing the modules alone does not activate protection. Do not overwrite exports while leaving closure calculations scalar.

Audit every move, resize, delete, add, recording add, paste, repair apply, candidate apply, timeline resize, measure/range lock, partial unlock and Undo/Redo path. Preserve explicit lock commands and legacy aliases, propagate rejected nested transactions and verify atomic session/history rollback.

Browser ruler, CSS grid, snap, visible range, loop/timeline extent, tempo-change measure entry, recordingTickAt, loop Stop boundary and metronome still need coordinated A timeline/Tempo Map service integration. beginMidiRecording still invokes the fixed-tempo recorder path. Count-in and metronome scheduling must be distinguished from the recording origin; source event ticks must remain unchanged.

No automatic persistence migration was added. No actual device verification was performed.

## Browser blocker and publication gate

Playwright is installed but has no Chromium executable. Browser installation was attempted and failed with `End of central directory record signature not found` / truncated or non-ZIP downloads. Actual 1440/820/390 display and console error/warn checks are UNVERIFIED. No coordinated integration Draft PR was created, because implementation and browser checks are incomplete. This branch is a restart checkpoint, not a ready integration or device preview.

No Ready, Merge, Auto Merge, force push, provider/AI API call or destructive storage operation occurred. No new physical Mac/iPad action is needed for this environment blocker. Existing PR262 Intel Mac Audio-to-MIDI and device checks remain separate and pending.
