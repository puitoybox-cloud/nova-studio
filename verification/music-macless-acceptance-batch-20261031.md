# Macless acceptance batch — 2026-10-31 JST

Baseline: Draft #554, `459f13243d3c2754dc2f3b4b8b1020376ac55d5c`. New branch only. No Mac, listening, paid API, protected branch/PR update, merge, Ready or force push.

## Production changes

`music-studio.js`: menu/project/history/hash/popstate/host setView navigation now shares protections for vocal/MIDI recording, pending MIDI/lyric/AI input, audio/archive/checkpoint/export operations and saves. History rejection restores the original hash before any destination repaint. A second navigation while a restoration event is pending is checked again. Internal navigation records its accepted origin. No song, PCM, MIDI, take, saved history or backup format changes.

The 16 navigation regression tests fail on unchanged #554 and pass after the fix. They execute application code in a VM; actual browser focus, screen-reader behavior and rendering remain unverified. Chromium installation returned an invalid/truncated archive, so no browser result is claimed.

## Acceptance review of the original 20 gaps

| ID | Result | Evidence / remaining acceptance |
|---|---|---|
| MS02-A03 | verified | `music-studio-midi-variable-roundtrip.test.js`: actual recorder note-on/off across 120→60 BPM and 4/4→3/4, exact ticks, save/reopen/JSON/Backup and parsed SMF. Synthetic MIDI/audio environment; no physical input claim. |
| MS06-A02 | open | Domain-wide selective audio Undo and competing subsequent edits not established by generic MIDI Undo tests. |
| MS06-A03 | open | Domain-wide selective lyric Undo and conflict behavior not established. |
| MS06-A04 | open | Complete cross-domain persistent transaction continuation not established. |
| MS12-A02 | open | Journal/restore suites execute, but all long recording storage entrances and real-browser process termination matrix incomplete. |
| MS12-A03 | verified | Existing vocal suite: scheduled punch boundaries; two cycle takes atomic save→fresh VM→WAV/Comp→archive exact bytes; quota stops repeat; gapless journal reopen restores exact Take boundaries and order. VM IndexedDB and synthetic Worklet evidence only. Physical capture remains B. |
| MS12-A04 | open | Lyric auto-scroll synchronization needs real DOM/transport observation. |
| MS13-A04 | open | Saved/reopened waveform+lyrics+notes simultaneous visual synchronization not executed. |
| MS18-A02 | open | Existing PCM/stem paths do not prove every accepted source format in whole-song mixing. |
| MS19-A02 | verified | 13 independent FFmpeg ebur128 fixtures, float32 PCM SHA-256, mono/stereo, frequency weighting, absolute/relative gates, silence, clipping, whole/chunk equality. Finite LUFS within 0.11 LU of FFmpeg output rounded to 0.1. Full standards certification is not claimed. |
| MS19-A03 | open | Steady signals within 0.2 dB of FFmpeg TP; hard-onset 12 kHz result differs by approximately 0.53 dB. Do not loosen acceptance to hide it. Need official Annex-2 transient/phase/bandwidth reference and agreed accuracy scope. Clipping sample counts match independent raw-sample counts. |
| MS22-A02 | open | Checkpoint comparison metadata and PCM tests do not prove complete audible A/B integration. |
| MS22-A03 | open | All dependency-range composition and competing changes not exhaustively accepted. |
| MS22-A04 | open | Every save entrance under real-browser process kill/reopen remains unexecuted here. |
| MS24-A04 | open | New repair tests: absent explicit file, wrong hash, quota, initial/mid-hash cancellation, competing source; unchanged data then successful fresh VM retry and exact bytes. Actual crash/consent UI matrix still not executed. |
| MS28-A02 | open | Production navigation bug fixed, VM state matrix and existing focused-tab tests pass. Full editing-state DOM/browser transitions remain unverified. |
| MS28-A04 | open | No browser keyboard/focus/accessibility execution available locally. |
| MS30-A02 | open | Every special save entry has not been traced to automatic production history. |
| MS30-A03 | open | Fixed finished snapshots have tests; all mutation entrances are not proven. |
| MS30-A04 | verified | New test preserves session/day/checkpoint links, fresh VM continuation, JSON/Backup/full archive migration, sorted timeline, absent legacy optional fields and quota rollback. Archive IDs are intentionally rebound and all other event data is compared. |

Only these four IDs change status. Original IDs/wording/categories/dependencies/135 denominator remain unchanged. Remaining existing gaps: 16. C-dependent A: 63 open. B: 30 open. Decisions C: 18 open.

## Independent reference provenance

Generated with `node scripts/music-meter-independent-reference.js`. This generator never imports the application meter. See `tests/fixtures/music-meter-ffmpeg-reference.json` for FFmpeg build, invocation, raw summaries and PCM hashes, and `music-meter-signals.js` for redistributable generated input. FFmpeg's documented ebur128 analyzer: https://ffmpeg.org/ffmpeg-filters.html#ebur128 (consulted 2026-10-31). No third-party recorded music or fixtures are redistributed. Production currently labels the 4x FIR an estimate and states conformance tests incomplete; the transient disagreement remains a blocker for MS19-A03.

## Validation

Final counts and hash-bound accepted cases are in `music-macless-node-summary.json`; helper results in `music-macless-helper-summary.json`. Navigation baseline comparison: 0/16 passed on #554; 16/16 on this change. Focused acceptance suites: 148 passed, 0 failed/cancelled/skipped. Real browser install failed; no screenshots or physical/audio-quality claims.

Decision source inventory is `music-macless-decision-evidence-20261031.json`. It records repository evidence, not external license approval or model quality. Next: official true-peak transient references; real-browser repair crash/resume and state/accessibility matrix; remaining cross-domain acceptance; exact distribution/evaluation manifests for C-dependent features.
