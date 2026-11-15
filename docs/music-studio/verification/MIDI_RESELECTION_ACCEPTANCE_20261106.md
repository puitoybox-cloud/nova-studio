# MIDI reselection and acceptance review — 2026-11-06 JST

Baseline: PR #592, c14001f8eba623739ea3b15a150ba5a72f244733. GitHub API confirmed all 13 workflows successful. New independent Draft PR #593; existing PRs/main unchanged.

## Production change

On secure-context browsers, SHA-256 of the actual MIDI bytes and the import mode/confirmed track choices/source snapshot creates a stable receipt identity. After a fresh process, selecting the same bytes (including a renamed file) reconnects to the existing receipt/project. Later project edits remain intact. Missing project or missing receipt-linked production provenance rejects without writes. Different bytes with identical filename and size remain distinct. Duplicate-source revisions/confirmed mappings identify a different deliberate import context. The receipt is added in the same transaction as the project: concurrent attempts cannot commit two projects with the same receipt. Same-preview uncertain completion still retains its original identity and conflict protection.

Legacy imports without stable receipts and environments without Web Crypto retain the prior behavior; these cannot be retrospectively deduplicated by guessing filename/size. No original MIDI file bytes or absolute paths are stored for this identity.

## Acceptance classification

Before review: 73 open = 0 implementation gaps + 10 validation gaps + 63 specification/model/license-dependent requirements.

MS22-A02 is reclassified as an implementation gap: checkpoint capture, comparison, partial adoption and restoration exist, but no checkpoint audible A/B playback entry is connected. MS19-A03 stays open: an exploratory mono 48 kHz comparison with FFmpeg ebur128 found approximately 0.5–0.6 dB difference for a 12 kHz phase-offset sine. Agreement/calibration of the production FIR estimate remains unresolved; no tolerance was invented to declare acceptance.

MS13-A04 is newly verified: variable-tempo note/lyric timing, saved waveform and exact original WAV bytes survive invalid-input rejection, quota failure/retry, a fresh application/repository instance and additive Full WAV Archive restoration with remapped identities. This is software acceptance; hardware/listening remains separate.

After acceptance: 63/135 verified, 72 open, 46.67%. Open classification: 1 implementation gap, 8 validation gaps, 63 specification/model/license-dependent requirements. Multiple new verified requirements were not established in this batch.

## MS22-A04 / MS30-A02 remaining entry coverage

The 51 lexical publication sites and grouped public entries in SAVE_ENTRANCE_CONTEXT_20261105.md remain the reference inventory. New/duplicate MIDI now cover lost completion/read failure, same-preview retry, durable fresh-selection identity, orphan provenance and source preservation. GitHub real Chromium additionally executes atomic rollback, SIGKILL, persistent-profile restart and fresh file reselection through the public action.

Full public-entry acceptance is still missing for checkpoint adopt/Undo/Redo, score-WAV import, lyric assignment, PCM edits/import, attachment retention/repair, Archive restore, recording save/recovery/replacement/Comp, AI/instrument commits, editor snapshots, form/test/import creation, settings, JSON/automatic backup restore/publication, manual save, MIDI rendering, final export/delivery and material forms. Existing focused successes do not prove every interruption and session/day-history combination. New/duplicate MIDI still need the complete matrix of concurrent source/choice changes, cancellation and session association at each public boundary. No remaining-entrance count is claimed from lexical site counts.

## Evidence

Runtime tree 57fb6af71e0abebbc6f2c376ab7d43c2656ad10c exactly matches the API-published runtime commit 2851aa616320a1821d87b469cd3e6c04ce8198e0.

GitHub IndexedDB workflow 42142140345, job 127644783240: persistent restart step 6 and extended atomic MIDI/SIGKILL/reselection step 7 succeeded. Checkpoint workflow 42142140400, job 127644783184: browser UI/restart/recovery step 7 succeeded. Full workflow/final HEAD conclusions are reported separately.

Local browser executable was unavailable and Playwright download failed; no local browser success is claimed. Targeted MIDI suite: 167 passed. Synchronization/correction suite: 23 passed. Auto-Finish helper: 22 passed.

Complete local Node regression: 2,891 passed, zero failed/cancelled/skipped (216,200 ms). Source/runtime hashes and executed case names are recorded in verification/music-macless-node-summary.json.
