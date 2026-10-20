# Long Music production processing — 2026-10-20 JST

Base: Draft #478 / 3a7852f1ea498c3570ad658c35808b4b982444e1. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3. Retrieved 225 open PRs / 223 Drafts, each Draft metadata/head/base/mergeability and exact-head check runs. Local Git latest commit records accompany the start snapshot. #478 has 13 successful exact-head checks. No newer checkpoint was found.

Original Music Studio 最終機能仕様書 v1 (2026-09-30), Library libfile_fea4127fde5c81919fee8296d5c7647d, all five pages /166 lines re-read. All original 30 feature numbers remain A0/B0/C30: no whole-feature closure was established. The adjacent ledger retains each previous residual; it is not a claim that all 30 were independently reaccepted in this increment.

## Production implementation

- No.18/19/21/23: WAV decoding reads ahead at most 1 MiB encoded bytes while preserving requested bounded PCM output chunks, supported formats, alignment and every sample validation. Benefits long source reads, restoration validation, analysis and render/export without a storage format migration or whole-file PCM allocation.
- No.19: true-peak FIR history uses a doubled circular window, retaining the exact coefficient/sample accumulation order, phase calculation and tail flush. No quality stage, gate, tolerance or clipping check removed.
- No.18/19: Long Mix/Master use bounded repeated metadata comparison with mandatory exact comparison immediately before candidate publication. Cancellation/dirty state/repository/input guards remain immediate. Backwards-clock detection added to the shared comparison guard. Frozen-clock in-place mutation tests protect both publication paths.
- No.18/19/21: source SHA256 authentication now receives the production operation guard, allowing cancellation during bounded hashing rather than waiting for the entire original file. Every hash is still recomputed; there is no unsafe cross-operation audio cache.
- No.18/19/21: Mix measurement and its original WAV encoding share one raw stereo stream. Master acceptance measures the actual quantized PCM16 chunks as they are encoded, avoiding a separate Blob decode pass. It still includes output quantization, continuous linked compression, K weighting, FIR tail, absolute/relative gates, clipping rejection and up to three unchanged-source correction passes. Source audio, offsets, stems and Mix bytes remain intact.
- No.21: transient phase timings on the candidate identify source preparation, Mix encode/measurement, Master render/measurement and ZIP packaging. They are outside saved plans and audio manifests, so timing noise cannot alter exported data or saved settings.
- Host/standalone/cache assertions updated to 1.4.193.

This is a focused production processing change, not 20–30 separately completed improvements. No new listening sample, song or instrument comparison deliverable.

## Validation and measurement boundaries

Local Python audio pipeline: 509 tests, 504 passed /5 existing skips. Focused final Export: 31/31 passed. Focused WAV/storage before final additions: 168/168 passed. New frozen-clock publication regressions: 2/2 passed. Syntax: all 253 JS files pass node --check. Full final Node suite and exact-head CI results must be recorded after completion.

The CPU/Blob benchmark uses four technical 480.8-second regression sources in a memory repository, not IndexedDB/browser/acoustic assets. Original Mix/Master hashes and before/after metrics are identical. Preliminary runs overlapped other checks; their 91.087 s /95.862 s totals do not establish acceleration. They cannot be compared with #478's 478.15 s restored acoustic production result. No measured speedup percentage is claimed.

CI now runs immutable #478 and current production sequentially on the same runner with the identical existing licensed acoustic eight-minute fixture and same instrumented harness. It checks source and Master hashes, measured loudness/peaks, complete restore and ZIP equality, reopened playback, four viewport widths including 1180x820, Console/external requests zero, and records stages/memory. That final-head evidence is pending until observed. The baseline harness copy adds reporting only; baseline production code is unchanged.

Local Chromium and Swift are unavailable. Real ONNX/Sinsy, native builds, browser persistence and UI acceptance require final-head CI; prior-head results are not attributed to this change. Physical Mac/iPad remains Tia's acceptance.

## Remaining

No.18 general music-quality closure; No.19 independent standards conformance and full mastering requirements; No.21 complete distribution checks/formats; No.22 named checkpoints and version partial merge; No.23 complete dependency migration and approved Cloud Sync architecture/implementation; other original feature residuals in ledger. Storage transactions, archive format and original binary retention are unchanged. No new recovery durability or B promotion is asserted.

Next: use the same-runner acoustic phase evidence to target the remaining largest production bottleneck, then close a concrete original-spec residual in save/version/recovery. Draft only; no main/prior-PR changes, Ready/Merge, force push, Live Provider or deletion of original data/backups.
