# Exact candidate partial adoption — 2026-10-02 JST

Fresh GitHub source: main 552d56eafddfd192970c09f7d6278696cf8775c3; latest related Draft #274 cde821afe4a7f115c670b5b7f822520771d57eac, CI 37002368391 SUCCESS. #269 has advanced to 98b7067bbdf0a967c6d4c69b9be8721d688e7e52 since the previous Work report. #270–#274 are stacked on that updated source. No previous unpublished prototype is assumed present.

## Reproduced failure and correction

Selecting measure 1 for partial adoption in an A timeline changing at tick 1000 originally selected proposals only by start tick. A generated note could sound beyond 1000; changing or deleting an existing note starting in measure 1 could also change its sound in measure 2.

Two regression tests failed on the retrieved source before the correction. The corrected bridge shortens only newly added proposals to the selected exact end tick. Existing notes are indivisible: updates and deletions must keep both original and destination entirely inside the adopted interval, otherwise candidate-selection-boundary is raised before entering the Editor transaction. It does not split or rewrite existing notes, and it does not alter unselected proposals or the original Preview bundle.

All musical commits still use the existing guarded Partial Edit path. Full adoption behavior, candidate families, explicit note/range protection, stale checks and Undo/Redo are retained. Host and standalone candidate asset cache keys advance from 1.0.0 to 1.0.1; Assistant panel from 1.0.2 to 1.0.3.

The real Chrome checkpoint exposed a further UI failure: MIDI Preview rebuilt the range fields from the full candidate range, discarding the user's narrower choice. The panel now retains that selection in transient UI state and clears it when generating a new candidate set. Invalid numeric selections raise a caught rejection rather than falling back to full adoption. This transient state is not added to saved projects.

## Local verification

- Fresh detached #274: 993/993 PASS, FAIL 0, skipped 0.
- Corrected source: 1000/1000 PASS, FAIL 0, skipped 0; seven new regressions.
- All 123 JavaScript files: node --check PASS.
- git diff --check PASS.
- Original seven meter/lock scenarios PASS.
- Focused candidate and panel integration suites: 26/26 PASS.
- Additions ending at a truncated bar, indivisible crossing-note pitch/length/delete rejection, original Preview nonmutation, Undo/Redo, and legacy/new/additive-release coexistence are checked.

The browser harness adds actual UI generation → MIDI Preview → selected measure Apply at tick 1000, save/reopen and Undo/Redo, plus atomic crossing-note rejection at each of 1440/820/390. Console warning/error/pageerror and external requests remain strict zero assertions. Only synthetic memory projects are used. Initial render must perform zero writes.

Real Chrome 154 verification completed SUCCESS on checkpoint HEAD bbc847960a2d7697982f5be020186d2effd5ac3e: [run 37018351490](https://github.com/puitoybox-cloud/nova-studio/actions/runs/37018351490). All three widths PASS, with Console warning/error/pageerror and external requests empty. Initial render writes are zero; explicit saves and New Song creation write only synthetic repositories. Screenshots were downloaded and inspected. The corrected range remains 1–1 after Preview, new notes stop at tick 1000, crossing-note Apply is rejected without consuming Undo or marking adoption, and invalid input is rejected by the UI. Original Chord/Continuation/New Song flows also PASS.

Fresh main baseline remains 774 total / 768 PASS / identical 6 FAIL (cache-version and invalid Track ID baseline). Fresh #274 is 993/993 PASS; corrected source is 1000/1000 PASS, new FAIL 0. This correction does not disable any baseline test. Machine-readable browser evidence is saved in music-ai-exact-adoption-browser.json.

The first added browser attempt exposed the Preview range reset and correctly rejected an unintended full-range edit into protection. Both that UI failure and invalid-range fallback were fixed, rather than weakening the protected-range assertion. Remaining Linux screenshot font placeholders reflect missing Japanese fonts on the runner; physical-device Japanese rendering remains unverified. No existing PR or main is changed. No real saved songs, real backups, automatic migration, Live Provider, External AI API, Ready, Merge, Auto Merge or force push.

## Remaining device-only checks

Physical Intel Mac Chrome / Keystation recording, audible metronome and latency, iPad Safari touch/Pencil and device Japanese rendering remain hardware checks. Existing Intel Mac Audio-to-MIDI accuracy remains separately pending; these changes do not claim to fix it.
