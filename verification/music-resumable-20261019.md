# Resumable whole-song generation — 2026-10-19 JST

Parent: PR #464, exact 0c6e9b14fd03b34f6ad0b7c65415745ce0f5e80e. New independent Draft only. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3.

## User-visible implementation

- Pause retains only completed A/B/C bar responses. A partial job never enters the adoptable candidate list.
- Resume reconstructs and validates every saved MIDI response before making a new model request, then skips completed bars using the original per-bar seeds/ranges.
- Save checkpoint uses the existing project compare-and-put save path. Saved checkpoints survive reopen and complete JSON backup/restore. The normal UI automatically saves every completed bar and the completed candidate set through this same guarded path. A failed save stops before the next request; pending results remain in memory for explicit retry. A crash during the active bar may require retrying that bar.
- Source MIDI (including locks), selected track, musical settings, Section settings, chord review and generation recipe must match. Model revision must match all restored and new responses. Project save normalizes redundant BPM to MIDI tempo, so this normalization alone no longer invalidates resume.
- Interrupted and complete candidates are separate. Existing completed candidates and original tracks are preserved on failure/cancel; users explicitly discard a checkpoint before starting another job.
- UI shows completed/total/remaining bars and Pause/Resume/Save/Discard controls in English/Japanese. New asset versions invalidate both entry-point caches.
- Fetch cancellation stops client work. An authenticated same-origin cancellation endpoint also signals the host by a unique request ID, checked between model/token steps and candidates. A currently executing ONNX call or file hash is not forcibly interrupted.
- Bounded cancellation registry includes late-request tombstones, no reused IDs, 1024 retained slots/10-minute completed lifetime, no active eviction. Checkpoints are capped at 16 MiB UTF-8, with strict MIDI parsing on resume.
- Existing full-song comparison, instrument/range partial adoption, Undo/Redo, MIDI/audio/Mix/Master/Export paths remain. Instrument algorithms and sound sources are unchanged in this patch. Accompaniment remains explicit rule orchestration after model inference, not four independent model performances.

## Validation and limits

Focused Node whole-song tests: 20/20 PASS, including failure/pause/resume, stale source/settings/revision, malformed restored MIDI, save/reopen/full backup/resume, Bass adoption and exact Undo/Redo. These fixtures use fixed SMF bytes and are NOT real ONNX inference.

Python local-generation tests: 20/20 PASS, including real HTTPS authenticated cancel, active concurrent request cancellation/lock release using an explicitly mocked computation, late requests and registry bounds. This is not an ONNX cancellation performance measurement.

Python audio pipeline: 509 run, 504 PASS, 5 existing optional dependency skips (33.713 seconds). Existing subprocess ResourceWarnings and deliberate HTTP error logs remain.

Before automatic checkpoint increment, full Node2469/2469 PASS, fail/skip0 (87.431 seconds). Final same-source run: see PR final evidence. Changed JS node --check, changed Python py_compile and git diff --check PASS.

Real-browser CI fixture extended to interrupt after one real completed bar, save/reopen and resume the remaining three bars before existing A/B/C audition, partial adoption, Undo/Redo and MIDI→Mix/Master/Export. Four viewport sizes remain 1440/820/390/1180 by 820. New-head CI must succeed before claiming these checks passed. Local Chrome, Swift/Xcode, ONNX Runtime, model weights and Sinsy executable unavailable; no new assets or dependencies installed here.

8-minute real ONNX A/B/C: NOT RUN here. Actual duration/bars/notes/inference count/time/peak memory/storage for such a real-model run: unverified, no estimates. The inherited 144-bar/480-second fixed-SMF rule fixture is not this evidence. No human listening/physical acceptance, no claim of musical naturalness.

Original specification re-read: Music_Studio_最終機能仕様書_v1.pdf, current 2026-09-30 original, all 5 pages /166 lines, 2026-10-19. Formal A0/B0/C30; full UI/backend/runtime/storage/restore/policy closure not certified. 20–30 independent production work items are not all complete.

## Remaining production work

8-minute real inference acceptance and resource measurements; real-model cancellation latency and reconnect/re-pair acceptance; long rendered audio comparison; broader musical context/quality and listening; intra-bar chords/key/tempo; instrument quality; 30-feature runtime/backend/policy/distribution closure. Physical Mac/iPad and listening remain with Tia.

Before edits, all 209 Open Draft PR metadata/head/base/mergeable/latest commit/changed filenames and PR-triggered workflow first page were fetched. No newer Draft than #464. Full historical workflow pagination/logs are not audited. No main/old PR edits, force push, Ready/Merge, external Provider inference, or user song/backup deletion.
