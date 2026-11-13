# True Peak and PCM publication context — 2026-11-06 JST

Baseline: Draft PR #594, `aac729150426449b7b3156aa830fd18391dedf7a`, tree `5e7020be6b00b92d6e549f261b929ca9e837bc54`. PR #593's original head and all existing branches/main are preserved. Work is isolated in Draft PR #595.

## Production changes

The streaming peak meter now uses four normalized phases of a 32-tap Hann-windowed sinc filter rather than the former 12-tap estimate. A bounded reflected-start guard handles the first 16 frames; the raw sample-peak floor, clipping count and zero-extended tail remain. The filter retains 32 leading frames and fixed per-channel delay buffers, independently of input chunk boundaries. Repeated finish is stable and pushing after finish is rejected internally. K-weighting, loudness gates, original PCM and saved WAV bytes are unchanged. This is an independently checked peak estimate, not an ITU laboratory certification or hardware/listening acceptance.

The original hard-onset 12 kHz fixture measured -0.8325013528 dBTP against -0.3 dBTP. The corrected estimate is -0.2841529192 dBTP, an absolute difference of 0.0158470808 dB. All 23 original/additional reference signals stay within the existing 0.2 dB bound; the largest measured absolute difference is 0.1732765583 dB. Original reference values and tolerances are unchanged. The formerly expected disagreement test now requires agreement; abrupt inputs are no longer excluded from the original reference assertions.

Ten additional FFmpeg fixtures cover abrupt 50/997/10000/12000/19000 Hz, distinct phases, asymmetric stereo, clipping, and first/late impulses. Their exact float32 bytes and generation source are hash-bound. They include 64 explicit zero samples after the one-second signal: FFmpeg ebur128 otherwise omits buffered resampler tail, which experimentally underreported an unpadded final impulse. The app is separately required to retain the true final sample peak without padding. This padding makes the independent reference observe the actual zero-extended tail; it does not enlarge a tolerance or change the original 13 fixtures. Every added case is also split into 35 initial one-frame chunks and later 7,919-frame chunks to exercise filter history.

PCM editing and WAV import had a separate post-commit context bug. After the storage transaction completed, a replaced repository, newer view or changed editor could be overwritten by the old completion result. They now return an explicit committed/refreshPending receipt and preserve the replacement view. The original repository retains the committed edit/import, its original audio bytes and edit history. The test reproduces replacement-view corruption against the unmodified baseline and passes on the fix, for both entry types and all three context changes. No completed transaction is retried or rolled back by guessing.

## Acceptance and remaining work

New target: MS19-A03, true peakとclipping検査. MS22-A02 remains inherited from PR #594 and is not counted again. The final ledger is updated only after the complete final-source regression and registered execution evidence pass.

MS22-A04/MS30-A02 remain open. The real Chromium interrupted-publication matrix now additionally exercises PCM gain adoption and WAV binary import: SIGKILL while the real IndexedDB transaction is kept active, fresh process restart, exact prior project/backup equality, successful retry, retained original PCM/WAV bytes, exactly one edit-history addition and Session/daily-record preservation. Existing checkpoint adopt/Undo/Redo, journal, Archive, backup, MIDI and special-save checks remain.

| Remaining ID | Specific missing full acceptance |
| --- | --- |
| MS12-A02 | All long-duration recording modes and every recovery/replacement/Comp entrance are not covered by the complete interruption/history matrix. |
| MS18-A02 | Whole-song mixing has not been accepted for every material format/combination and offset/failure/restart boundary. |
| MS22-A04 | Public-entry inventory still includes score-WAV, lyric assignment, attachment, recording replacement/Comp, instrument/editor/form/settings/export entrances lacking the complete failure/restart/retry matrix. Added PCM/WAV cases do not certify those entrances. |
| MS28-A02 | Every editing state × work-mode transition is not covered by real UI acceptance. |
| MS28-A04 | Full keyboard/focus/announcement accessibility acceptance across every route/control remains incomplete. |
| MS30-A02 | Remaining special save/publication entrances have not all been checked for uncertain completion, retry and Session/day links. |
| MS30-A03 | Every public mutation/publication entrance has not been verified against frozen finished snapshots. |

All 63 decision-dependent A requirements and their 18 C contracts were reconciled against the unchanged ledger. No model, license, cloud target, provider-price or Logic protocol decision was inferred. Common PCM/WAV publication isolation was improved without making those decisions; it does not satisfy the dependent model-quality or deployment contracts. The full mapping from C contracts to all 63 A IDs remains in `CHECKPOINT_AUDITION_ACCEPTANCE_20261106.md`.

## Evidence scope

Focused meter/mastering suite: 63 passed. PCM/WAV context regression: two tests, six context-change cases; both fail against the unmodified baseline because the replacement view is overwritten. Auto-Finish helper: 22 passed. Full final-source Node result, hash-bound ledger evidence and exact-runtime CI references are recorded below when available. Local Chromium was already demonstrated to be unavailable under the socket restriction; no local browser success is claimed.

Final local Node regression: 2,908 passed, zero failed/cancelled/skipped, 219,107.919269 ms. Final Checkpoint/meter/mastering focused run: 96 passed. Auto-Finish helper: 22 passed. Published runtime commit `9d1269ba4fc7458bb7fceb46da6d69e83bf54d3d`, tree `3139d124de53ae2bb055ecc26216abb41bc137a3`, exactly matches the locally staged runtime tree.

Exact-runtime GitHub Actions run 42180452401 / job 127768584716 passed helper step 4 and the complete 2,908-test Node step 5. Its ledger step 6 rejected the old browser evidence runtime hash, as expected before the new browser runs are registered; no failed production test was hidden by regenerating evidence. Final ledger validation follows actual matching-source browser results.

The acoustic comparison workflow retains exact source-byte and completed-Master-byte equality, and exact loudness/sample-peak/clipping/format equality. Only the deliberately corrected estimator's method/truePeak/truePeakDb metadata fields are removed from comparison with the old inaccurate meter; the corrected output must still satisfy the existing ceiling check. This change does not waive audio equality or substitute a looser True Peak tolerance.

Exact-runtime browser evidence: IndexedDB run 42180452486 / job 127768585678 passed all steps 6–9, including the extended PCM/WAV interruption cases. Audible comparison run 42180452426 / job 127768584505 passed step 5; artifact 13486306089 binds the actual runtime and source hashes. Checkpoint recovery run 42180452259 / job 127768585430 passed steps 7–9, including PCM/encoded journals and Archive recovery. Evidence JSON files were refreshed only after these successes.

Final acceptance: newly verified MS19-A03; inherited MS22-A02 is not counted again. 65/135 verified, 70 open, 48.15%. Remaining: seven validation gaps plus 63 C-dependent A requirements; hardware B=30 and decisions C=18 remain separately open.
