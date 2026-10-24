# NOVA Mix AU — measured audio path, 2026-10-24 JST

Actual AUv2 stereo effect: `aufx / NvMx / NvSt`, `studio.nova.audio.NovaMix`, NovaMixFactory, Intel x86_64/macOS 12 minimum build target. PR #503 extends #502 without rebuilding the Music Studio application. Physical Logic/version and older macOS compatibility remain unverified.

## Use and consent

Build on macOS: `tools/nova-au/build.sh /absolute/output`. The script uses the pinned vendored Apple SDK and ad-hoc development sealing; it neither installs on a user machine nor uses a signing identity/notarization. Disposable Intel CI installs its own bundle for auval.

1. Manually load NOVA Mix on the intended Track/Bus/Stereo Out. Import #501 handoff JSON if available. Check the actual sounding instrument/preset, project and Track IDs. Explicitly choose destination kind and enter the actual source description. Names do not prove identity. Handoff role metadata is retained; unsupported roles remain unspecified.
2. Confirm the target. Click **2秒音声取得に同意** and play at least two seconds. Input and processed output stereo are retained in local RAM only. No provider/network/file I/O happens in render. An interrupted/reset capture is incomplete, never audioAnalyzed:true. A new capture replaces the previous RAM selection.
3. The next control-thread snapshot performs actual FFT/Peak/RMS analysis. Silence, <0.5 seconds, nonfinite input, changed settings/target and missing spectrum are separate failures. UI capture state 0=unused, 1=armed, 2=incomplete acquisition, 3=complete, 4=interrupted/reset. No timeout fabricates success. If playback stops early, resume to complete, or reset/reinitialize and capture again.
4. Enter a supported Japanese instruction and preview A/B/C. Measured candidates display actual Gain/Low/High/Bypass values and input/output metrics. Click **比較WAVを保存** and explicitly select an output directory to export a fresh comparison folder. Preview/export changes no live parameters. Listen to original/A/B/C or their RMS-matched versions. Only the selected explicit approval changes this AU.
5. After applying, capture again to measure the actual output. Compare the retained before/after history. Undo requires approval and unchanged parameters. An over-level measured application latches output mute; explicit Undo releases it. This is a coarse safety stop, not a transparent limiter.

Old Japanese Gain/EQ preview remains available only before any capture has been attempted and is explicitly audioAnalyzed:false. Failed/incomplete captures cannot silently fall back to successful measured proposals. No machine-learning model is used: these are signal measurements and deterministic bounded rules, not AI-model inference.

## Measurement and real-time boundary

Capture owns a preallocated 384000-frame × four-float buffer (6,144,000 bytes per instance). Render publishes a single bounded two-second input/output selection using lock-free atomics. Control reads only a release/acquire-published complete buffer. There is no render allocation, mutex, Objective-C, inference, file I/O or networking. In-place hosts are supported by copying input before processing. Initialization/reset follows the host lifecycle and invalidates unfinished acquisition. Excess frames beyond the selection are not retained.

Peak is maximum absolute **sample** amplitude, RMS uses both channels/all selected frames; crest factor is Peak/RMS in dB. dBFS zero handling displays a -160 dB floor, not a measured noise floor. FFT: 2048-point Hann window, 1024-frame hop, separate channel powers summed; normalized power fractions for 20–200 Hz, 200–4000 Hz, 4000 Hz–Nyquist. These are coarse spectral statistics, not source separation, psychoacoustic quality, integrated loudness or True Peak. Sub-20 Hz/DC is excluded from band ratios but included in sample Peak/RMS. Supported rates 22050–192000 Hz use actual frequency bins; no assumption of 48 kHz.

Every acquisition has a fresh capture UUID and explicit project/Track/AU binding. FNV sample fingerprints only verify local buffer correspondence and are not cryptographic identities. Offline WAV manifests additionally record full-source and selected-PCM SHA256. A sampled two-second excerpt does not establish the whole song's balance. Compare real Logic renders/recordings before accepting musical quality.

## Proposals and rendering

Instructions: ピアノをもっと温かくして / ピアノを柔らかくして / ストリングスの高音を柔らかくして / 高音を少し抑えて / ボーカルをもう少し前に出して / 低音が強すぎるので調整して / 全体の音を自然に整えて. Each uses measured band fractions and/or Peak/RMS and headroom. A/B/C apply 1/3, 2/3 and full bounded correction. Explicit bass/vocal role metadata adjusts neutral high-band conservatism; no instrument quality is inferred from preset/name. Vocal Gain cannot isolate vocals in a mixed signal or guarantee presence. Already high-level inputs may prevent any vocal boost.

All comparison renders use the exact same captured input frame zero, length, rate and zero initial filter state. Files are original.wav, A/B/C.wav and four -rms-matched.wav versions. Matching only attenuates to the quietest measured RMS; it is **not LUFS matching** and cannot guarantee equal perceived loudness. Manifest maps settings, measurements, identities and files. Comparison data is not adopted as the original song. AU UI exports run the same NOVA DSP offline; CI additionally renders all alternatives through the actual AU factory. Neither proves Logic host operation. Partial export failures are surfaced; an incomplete folder is not a successful comparison.

Offline real PCM WAV route, with no provider or automatic parameter changes:

```
g++ -std=c++20 -O2 tools/nova-au/analyze.cpp -o /tmp/nova-analyze
python3 tools/nova-au/analyze-wav.py INPUT.wav --engine /tmp/nova-analyze --output NEW_DIRECTORY --project EXPLICIT_PROJECT_ID --track EXPLICIT_TRACK_ID --source logic-render --instruction 全体の音を自然に整えて
```

Accepts PCM16/24/32 mono/stereo, 22050–192000 Hz; selects the first at most two seconds and records original length/start/hash. Mono is explicitly duplicated to stereo. IEEE-float WAV input is currently rejected; output is IEEE float32 stereo WAV. No automatic resampling or channel guessing. Choose development-fixture for repository tests; never label those Logic audio. `tests/verify-wavs.py` independently decodes exported samples, verifies hashes/length and matching.

## Parameter, safety and persistence contract

Four existing parameters retained: Gain -24…+6 dB, low/high -6…+6 dB, bypass 0/1, quantized to 0.01 dB, lock-free block snapshot, 20 ms smoothing including bypass. EQ remains a first-order parallel-band filter (180 Hz and 4 kHz); band settings do not equal flat shelf response at every frequency. Host immediate automation is supported; sample-accurate scheduled ramps are not advertised. Apply/Undo use compare-exchange and reject current-value conflicts. A change away and back between checks is not a continuously recorded automation audit.

The existing ±0.98 wet hard ceiling remains a distortion-producing safety ceiling. Measured proposals conservatively bound Gain from input Peak and an EQ-response bound. Actual captured candidate output is preflight checked below 0.975 before approval can apply it. Later unexpected levels latch output mute. Silence is not mastering. Nonfinite input is sanitized for render but invalidates analysis. Compressor, transparent limiter and new Dynamics parameters are **not implemented**. Existing clipping ceiling, EQ phase limitations, CPU scheduling and listening quality still require acceptance.

ClassInfo saves parameters, project/Track/source/kind/role, last 32 measurement/proposal/adoption/Undo evidence records and up to 32 grouped Undo pairs. No raw audio is embedded. Fresh runtime instance IDs and explicit target reconfirmation are required on restoration/duplication. Pending proposals and current capture audio are not reactivated on reopen. Historical comparison choices remain evidence; recapture to produce a new live proposal. Music Studio and Logic project files are not changed by this AU. IDs/exports associate history, but live bidirectional Music Studio history synchronization is still open. Music Studio backups do not include Logic projects or AU host state.

## Mastering and external instruments

Music Studio's existing mixMeasure/masterMeasure and 48 kHz BS.1770 K-weighting/gated LUFS/4× FIR True Peak estimate are retained in music-studio.js. They are not connected to this AU capture, and this AU reports lufsMeasured:false/truePeakMeasured:false. Sample Peak/RMS/crest factor are not substitutes. No.19 is not complete.

Only this NOVA AU's own four parameters are controlled. No Logic instrument, internal Mastering Assistant, Patch or purchased third-party AU is discovered/inserted/modified automatically. Existing inventory is read-only. Exact product/version-specific authorized adapters, licensing, Developer ID signing/notarization and commercial distribution review remain open. No new models, commercial binaries or preset/license material are added.

## Primary sources (checked 2026-10-24 JST)

- Apple AudioUnitSDK, pinned `bd98b31feff57a15989fcfab4cd86dc63382b1ac`: https://github.com/apple/AudioUnitSDK — Apache-2.0, C++23, SDK minimum macOS 11.0. Included notice is retained; only trailing whitespace was removed from AUUtility.h.
- AudioComponent factory/interface: https://developer.apple.com/documentation/audiotoolbox/audiocomponentplugininterface and https://developer.apple.com/documentation/audiotoolbox/audiocomponentfactoryfunction
- AUv2 API: https://developer.apple.com/documentation/audiotoolbox/audio-unit-v2-c-api
- AU properties and state: https://developer.apple.com/documentation/audiotoolbox/general-audio-unit-properties and https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/AudioUnitProgrammingGuide/TheAudioUnit/TheAudioUnit.html
- Logic Controller Assignments: https://support.apple.com/en-mo/guide/logicpro/ctls71c30e80/mac
- Control surfaces and Smart Controls: https://support.apple.com/en-ae/guide/logicpro-css/ctls036b3e21/mac

## Verification boundary

See verification/music-au-analysis-20261024.md and exact-head CI on PR #503. Synthetic signals establish numerical behavior; repository piano/bass/strings PCM establish real WAV decoding/rendering, not the user's Logic instruments. Physical Intel Logic discovery, Audio FX/Bus/Stereo Out use, actual source correspondence, host UI, automation behavior, save/reopen and listening acceptance remain unverified. No formal feature A/B upgrade or overall completion percentage is claimed. All existing 30 features and standalone Music Studio paths remain.
