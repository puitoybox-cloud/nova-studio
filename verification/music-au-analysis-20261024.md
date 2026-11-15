# NOVA Mix measured audio acceptance — 2026-10-24 JST

PR #503 is stacked on #502 / ec48b4470c9496a794a09454faf6915f722f7f40. main remains 552d56eafddfd192970c09f7d6278696cf8775c3. Existing PRs/main are untouched, Draft only. Exact final HEAD/check links are in the PR body; distinguish them from earlier checkpoints.

## Implemented production path

- Existing actual Intel AU input/output path extended, not replaced. Explicit acquisition consent, per-instance preallocated 6,144,000-byte bounded input/output capture. Render is independent of control mutex, JS, FFT, files and network. Input is copied before in-place DSP.
- Actual two-channel Peak/RMS/crest factor, clipped/nonfinite sample counts and 2048-point Hann FFT powers (1024 hop). Low 20–200, mid 200–4000, high 4000–Nyquist normalized fractions. Actual sample rate drives bins. Six rates × three buffer sizes tested portably; existing real AU rate/buffer matrix preserved.
- Silence/short/invalid/missing-spectrum/interrupted/reset/changed-target/changed-parameter conditions do not become successful analysis. Historical valid excerpts are not full-song or continuously updated analysis. UI exposes acquisition completion.
- Japanese requests plus actual signal measurements generate three bounded alternatives. Registered explicit bass/vocal roles affect neutral conservatism; names/presets do not establish source quality. No model inference.
- Explicit project/Track/instance/kind/source binding, current-parameter validation and approval before changes. Compare/export never changes live settings. Same AU parameters, smoothing, isolation and automation conflict guards retained.
- Output preflight for measured candidate, later excessive output latches mute, explicitly approved Undo restores prior parameters. This does not implement a transparent limiter.
- Same-source/start/length original/A/B/C WAVs and attenuation-only RMS matching. Manifest maps identities, settings and measurements. AU UI uses the same DSP offline; actual AU factory rendering independently verifies parameter effects in CI.
- ClassInfo persists parameters, source/role/target kind, last 32 measurement/proposal/adoption/Undo records and 32 grouped Undo pairs. No raw audio in state/JSON. Restore creates a fresh runtime instance and requires target re-confirmation. Pending proposals/capture are not revived; historical choices remain evidence. Separate exports retain audio comparisons.

## Actual PCM WAV measurements (first 2 seconds, 24 kHz)

These are repository development piano/strings/bass samples, **not Logic-rendered or user-owned instrument evidence**. Input files exist under assets/music-acoustic-v1 and their complete/selected hashes are generated into each manifest.

| Source | Sample Peak dBFS | RMS dBFS | Low % | Mid % | High % |
|---|---:|---:|---:|---:|---:|
| piano-60.wav | -24.129178 | -39.997682 | 0.799252 | 98.246236 | 0.954512 |
| strings-60.wav | -21.468816 | -33.476498 | 0.014836 | 99.941872 | 0.043293 |
| bass-24.wav | -18.302612 | -29.803426 | 99.840846 | 0.159068 | 0.000086 |

Same request 全体の音を自然に整えて, baseline Gain/Low/High/Bypass = 0/0/0/0:

| Source | A Low/High dB | B Low/High dB | C Low/High dB |
|---|---|---|---|
| Piano | -0.09 / -0.09 | -0.18 / -0.18 | -0.26 / -0.28 |
| Strings | -0.07 / -0.07 | -0.13 / -0.14 | -0.20 / -0.20 |
| Bass | -1.33 / -0.07 | -2.67 / -0.13 | -4.00 / -0.20 |

Gain remains 0 in these examples. Bass actual raw-render RMS: original 0.03234660533, A 0.02820788082, B 0.02469623042, C 0.02177694145. All three sets independently decode eight IEEE-float stereo WAVs, verify source length/file hashes and full-excerpt RMS matching within 1e-7. No listening-quality acceptance is inferred from numerical differences. Smaller piano/string EQ corrections may be subtle.

## Validation and reproducibility

- Full local Node checkpoint: 2612/2612 PASS before the added explicit Japanese-route regression. Final CI reruns full Node on final HEAD; use that log for final counts. All tracked JS node --check and git diff --check are required on final tree.
- Portable DSP tests and six-rate actual FFT/capture/proposal/RMS-matching tests pass on Linux. Existing stereo identity, extreme/nonfinite input and parameter smoothing regressions retained. Producer/control publication has a separate thread exercise.
- Initial #503 checkpoint 658554fef7bd91b118911658373fd036a71d70e5: 3 active checks SUCCESS (Intel actual AU, instrument core, Intel inventory). Real x86_64 build, host input analysis, actual Gain/EQ apply/re-measure/Undo, comparison WAV export, auval and existing Swift/browser regressions passed. Final HEAD reruns these plus persisted measured Undo, excessive-output stop and WAV byte verification; earlier green is not final-head certification.
- Performance is a synthetic capacity benchmark, not a Logic real-time scheduling guarantee. Local 120 simulated seconds: 0.264085 s wall, 0.220071% capacity ratio; fixed capture 6,144,000 bytes/instance. Intel CI writes its own render-performance.txt. A separate portable-analysis process observed 26456 KiB maximum RSS; this includes test vectors and is not plugin-only memory.
- Address/UndefinedBehavior sanitizer executable initially failed at LeakSanitizer teardown because /proc task inspection is unavailable in the container. A separate ASan/UBSan run with leak detection disabled completed; **leak detection is unverified**, not reported as passing. No production/test assertion was relaxed. /usr/bin/time was unavailable; Python time/resource were used for the separate process observation.
- Independent WAV byte decoder checks frames, channels, sample rate, finite audio, hashes and RMS matching. WAV decoding is not physical speaker playback/listening.
- Browser acceptance is inherited Music Studio instrument/handoff coverage at 1440/820/390/1180×820. The native Cocoa AU view requires physical host UI acceptance; Chrome coverage is not Cocoa coverage.

## Dynamics, mastering and remaining work

Existing 20 ms smoothing and first-order parallel EQ remain. Hard ±0.98 wet ceiling is still distortion-producing; new preflight/mute is safety only. No new compressor/Threshold/Ratio/Attack/Release or transparent limiter. True Peak/LUFS are explicitly unmeasured in the AU. Existing Music Studio mixMeasure/masterMeasure and 48 kHz BS.1770/gating/4× FIR estimate remain separate. No.19 is not declared complete.

Physical Intel Logic Audio FX/Bus/Stereo Out, actual Logic/owned instruments/recorded vocals, target association, custom UI, host automation, project save/reopen and listening remain unverified. Host Track IDs are not auto-discovered. Music Studio history association uses exported IDs; bidirectional project-history synchronization is still open. Logic projects are not included in Music Studio backups. Two-second excerpt selection, PCM input format limitations and state/history caps are documented in tools/nova-au/README.md.

No.5/8/18/20 gain bounded implementation/acceptance evidence; no formal A/B upgrade. No.19 gains a compatible measurement boundary only; full mastering completion is not established. Formal 30-feature completion/percentages remain unchanged. No 31st feature, models, provider calls, commercial preset/binary access, signature identity, Ready/Merge or force push. Signing/notarization, redistribution review, full-song analysis, refined EQ/dynamics/limiter, real-world quality and physical Logic acceptance remain production requirements.

## Artifacts

Exact-head Intel CI uploads nova-au-intel-development: development component, auval/host logs, actual-analysis.json, actual-A/B/C/original WAVs and matched versions, piano/strings/bass comparison folders with manifests, sample/hash evidence, portable analysis and render-performance logs. No uploaded illustration is used as audio evidence. See README for the explicit WAV CLI and AU capture/export procedure.
