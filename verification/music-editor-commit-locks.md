# Editor commit protection — staged integration

This main-based Draft is the commit-boundary stage of the approved A/legacy compatibility work. It does not enable the meter timeline or locks in the production browser loader. Do not call this complete browser integration.

## Cause and implementation

The Editor's internal `change` closure previously committed notes without consulting exact range protection. The optional #267 transaction wrapper alone could be bypassed by direct move/resize/delete/add, candidate, repair and recording calls. When the actual #267 module is supplied, every internal commit validates original and destination protection on the resulting MIDI data before accepting it. Failure restores the entire session. Public command adapters return explicit rejection and restore state changed before entering `change`; a non-persistent WeakMap counter lets nested #267 transactions detect ignored rejections.

Explicit note flag lock/unlock is allowed without releasing range locks. Legacy numbered measure-lock changes fail closed under the guard; use #267's exact range/measure APIs to create new locks or additive releases. Undo/Redo intentionally restores the historical snapshot, including additive releases. No load-time migration or new persisted guard flag is introduced. Saved additive lock state without its enforcing dependency is rejected rather than opened for unprotected editing. Raw malformed legacy locks and duplicate Track IDs are rejected before normalization can discard their evidence.

The production loader still does not load #265/#267. `LOCK_COMMIT_REVISION:1` identifies this stage; it must not be mistaken for complete A numbering/ruler/snap/resize integration. Required dependencies: #265 `7d2f0f49cdbc56e57fab6cef9a64681cc6168c8c`; #267 `f06cf5ac29d2fa96857ce0dc623d6e1696f016a6` with `TRANSACTION_REVISION:1`.

## Verification

33 focused regressions: source/destination move/resize/delete/update/velocity, note and recording batch additions, paste, transpose, note length, correction, partial-edit apply, scoped repair, generated cleanup, candidates, quantize, empty-space timeline truncation, explicit flags, nested rejection, raw validation and missing-dependency rejection. Seven real #265 scenarios cover 4/4, 3/4, 6/8, boundary/off-bar/multiple changes and denominator changes. Exact releases retain legacy scalar tick ranges, original events, JSON equivalent reopen and Undo/Redo.

`MUSIC_LOCK_DEPENDENCY_DIR` supplies the immutable real modules to tests. They are not copied into the Draft implementation. Missing test dependencies fail the tests; no skips or stub implementations are used. Full Node suite: 807 tests / 801 PASS / 6 FAIL; main: 774 / 768 PASS / 6 FAIL, identical identities and zero additional failures. Known main failures belong to existing cache/selection work; they remain FAIL. All 96 project JavaScript files, including the baseline comparison tool, passed node --check; git diff --check passed. The same 33 focused tests on original main reproduced 25 failures and 8 passes before the correction.

Local-only synthetic #262–#267 plus this stage: 907/907 PASS, 105 JS syntax PASS, diff whitespace PASS. The core three-way merge applied with zero textual conflicts, preserving #262's cache versions, Track ID fix and song-transpose APIs. Existing #267 tests also exercise actual IndexedDB repository with fake IndexedDB, save/reopen, JSON import and memory Backup/Restore with the updated internal commit boundary. No real saved songs/backups, remote integration branch or protected PR were modified.

## Remaining coordinated browser work

Code audit confirms scalar computations remain in the Editor's measure range, position, timeline resize, candidate generation and scoped repair closures. Studio still uses equal-width ruler bars, initial-meter grid/snap/range/loop/tempo input/recording timing and legacy numbered lock labels. Those require a coordinated Editor/Studio/scoped-repair/host loader unit; switching only exported range/position APIs is prohibited. Recording/candidate UI callers also need to handle explicit rejected results before reporting success. Do not enable this stage through asset loading alone.

Scale guides/correction already implement Major/Minor/Pentatonic/Chromatic; #266 supplies explicit Key families and unadopted marker section candidates. Automatic section classification, adoption and marker export remain separate unfinished work. Source markers and inferred candidates must remain separate.

No UI files changed, no actual 1440/820/390 or Console checks claimed. Physical Intel Mac Helper identity/Audio-to-MIDI accuracy, recording/playback and physical iPad gestures remain pending separately in #262. No Ready, Merge, Auto Merge, force push, Provider/AI calls, main change or destructive migration.
