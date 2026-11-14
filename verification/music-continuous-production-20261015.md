# Music production continuation — 2026-10-15 JST

Base: Draft #426 `e1d4c67e40d7c9c1dbed32df46b2bce1fa6134f7`.
Main: `552d56eafddfd192970c09f7d6278696cf8775c3`.
All 171 open Draft PRs were re-read for HEAD/base, mergeability and exact-head workflow runs. No later Draft was present. All six #426 workflows eventually completed SUCCESS; no failed CI correction was needed. `music-continuous-start-20261015.json` records the initial per-PR snapshot and final parent CI.

## Resulting behavior

- Optional Continuous takes checkbox keeps one microphone stream, AudioContext and PCM recorder for all cycles. Existing per-take restart mode remains available.
- The audio-thread capture limit covers the entire continuous session; total is bounded to 120 seconds, up to eight takes. End tick and at least two cycles are required. Excess total is rejected before microphone permission.
- Integer sample-frame boundaries partition all acquired samples exactly once. Manual Stop includes the partial last take. Each take retains group/order, placement, latency, recording plan and its own waveform/WAV.
- MIDI accompaniment is scheduled on the shared audio clock at each take boundary. Lyric following repeats in the corresponding interval. Live status shows take number. These software schedules do not certify physical timing or actual instrument quality.
- Stop commits each take through the existing authenticated binary/metadata transaction. A failed save retains the failed take and remaining queue; Retry Save resumes without duplicating already committed takes. Discard clears remaining unsaved queue explicitly.
- Live measure emits a bounded low-level noise pulse and captures the selected physical microphone through AudioWorklet, three times on one microphone connection. Reference and captured PCM share the scheduled audio-frame origin. Correlation, clipping, ambiguity, polarity, rate and repeatability gates reuse the existing analyzer. Spread above 5 ms is rejected.
- The result is explicitly labeled speaker-to-microphone roundtrip: output latency and air propagation are included. Measurement cannot isolate input-only latency. No automatic adoption is performed. Apply changes the recording compensation form, disables a prior saved-profile override, and reuses existing input profile / recording / archive paths.
- Cancellation, input selection change, detached form, late permission, input mute/disconnect, context interruption and timeout reject the measurement and release the microphone. The calibration audio is never added to project assets or uploaded.
- English/Japanese controls live inside the existing bounded Recording settings disclosure. Asset version is synchronized across hosted/standalone entrypoints and existing checks.

## Verification and limits

Focused software tests cover continuous sample concatenation, one stream, partial Stop, sequential save conflict/retry, fresh reopen and complete archive source-byte equality. Live-microphone tests supply controlled captured samples to the real production recorder, decoder and correlation path; they cover three measurements, disagreement, silence, changed input and cancellation during delayed permission. These are test doubles, not physical microphone acceptance.

Local Python: 509 tests run, 504 passed and five existing unavailable-dependency skips. Existing ResourceWarnings occurred; no warning-free native claim. Local Chrome was absent and Playwright browser download failed with a truncated ZIP. Local visual/console, Swift, Xcode/macOS/iPad Simulator checks are therefore not claimed. GitHub exact-head CI must independently complete before being reported as PASS.

The new work improves the two prioritized recording paths. It does not meet the requested target of 20–30 substantive feature items. Real MIDI instrument assets/bindings, AI model/runtime/production functionality, unlimited streamed gapless capture, physical microphone accuracy and all-editor iPad/Safari acceptance remain incomplete. The existing formal 30-feature status is conservatively A0 / B0 / C30; no percentage is inferred.

No main/existing PR changes, Ready, Merge, force push or Live Provider API calls. Existing project/audio/MIDI data is preserved. Only disposable test projects were accessed.
