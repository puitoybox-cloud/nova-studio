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

Four existing parameters retained: Gain -24…+6 dB, low/high -6…+6 dB, bypass 0/1, quantized to 0.01 dB, lock-free block snapshot, 20 ms smoothing including bypass. EQ remains a first-order parallel-band filter (180 Hz and 4 kHz); band settings do not equal flat shelf response at every frequency. Host immediate automation is supported; sample-accurate scheduled ramps are not advertised. Apply/Undo use one compare-exchange word containing values and a 23-bit write generation. Host writes returning to the same values also invalidate previews/Undo; generation wraps after 8,388,608 writes. A continuously recorded host automation audit is not implemented.

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

## Quality processing extension — 2026-10-24

Host IDs 0..3 and AU component identity remain unchanged. New IDs 4..16 are append-only:

| ID | Parameter | Range |
|---|---|---|
| 4 | Quality EQ / dynamics chain enable | 0 / 1 |
| 5 | Low Shelf frequency | 30–500 Hz |
| 6 | High Shelf frequency | 1–16 kHz |
| 7 | Peaking frequency | 100–12000 Hz |
| 8 | Peaking gain | ±12 dB, 0.25 dB steps |
| 9 | Peaking Q | 0.25–8 |
| 10 | Compressor enable | 0 / 1 |
| 11 | Threshold | −60–0 dBFS, 0.5 dB steps |
| 12 | Ratio | 1–16 |
| 13 | Attack | 0.1–100 ms |
| 14 | Release | 10–2000 ms |
| 15 | Knee | 0–15 dB |
| 16 | Makeup gain | 0–12 dB, 0.5 dB steps |

Frequency, Q and times have logarithmic quantization (63/31 intervals). The snapshot and AU GetParameter return the decoded effective setting, not an unachievable requested value. Frequencies are additionally capped to 0.45 × sample rate at coefficient design. Shelf Q is fixed at √0.5; peaking Q is adjustable. Shelves retain the original ±6 dB gain IDs 1 and 2. Default and restored v1 states use the **original first-order processing**; audio-derived approval enables the new chain. No silent change to old preset sound is intended. v2 ClassInfo stores advanced controls and grouped old/new Undo words. v1 two-array Undo rows migrate with legacy advanced defaults. New states cannot be opened by the old binary.

The quality chain uses double-state RBJ biquads (Low Shelf → Peaking → High Shelf), then a stereo-linked feed-forward peak compressor (maximum absolute L/R). Soft-knee transfer precedes separate attack/release smoothing of gain reduction in dB. A displayed attack/release value is the one-pole time constant, not a look-ahead or an RMS detector. The common gain preserves L/R balance. Makeup is explicit; automatic makeup is off. Parameters smooth with the existing 20-ms time constant; coefficient updates use a fixed 16-frame quantum independent of render block boundaries. The existing ±0.98 emergency hard ceiling is retained and **is not a transparent limiter**. It can distort excess signals. Musical listening and more demanding modulation/aliasing acceptance remain necessary.

Advanced parameters publish in one 62-bit atomic word. A nonblocking writer reservation and sequence protect publication together with the original generation word. Render reads once and retains the previous coherent pair on overlap; it never spins, locks, allocates or runs FFT/LUFS/file/network code. Concurrent writers may receive CannotDoInCurrentContext and must retry as a new action. Any advanced automation increments the original generation, invalidating pending adoption and Undo. Generation retains the existing 23-bit wrap limit. Multiple controls should be set while stopped when using a generic host editor; a group of separate host automation writes is not an atomic user gesture.

### Measured Mix and excerpt Mastering

Japanese requests now also include ピアノを温かく自然にして / ベースが強すぎるので調整して / ドラムをもう少し力強くして / 全体の音量バランスを整えて. Spectrum fractions, measured RMS/Peak/crest, explicit role and target kind determine the settings. A/B/C are deterministic conservative/intermediate/stronger rule proposals, **not a learned model**. The analysis cannot identify masking, a particular instrument, artistic quality, or full-song balance from two seconds. Explicit role never establishes automatic source recognition. Processing values, reasons and grouped Undo persist with evidence. The custom AU view shows all effective values and reduction; all 17 host parameters are public.

The Master candidate button requires a confirmed Stereo Out, a numeric target −36..−5 LUFS, and valid 48-kHz capture. It renders EQ/dynamics candidates, measures each actual processed excerpt, then adjusts static final gain towards target−2 / target−1 / target LUFS, capped by the 4× estimated True Peak at −1.5 dBTP and the existing Gain range. Approval re-renders and rejects estimated True Peak above −1 dBTP. This margin is not a guaranteed intersample ceiling or a limiter. Output may not reach target; compare the reported result. No loudness maximization guarantee or whole-song mastering completion claim is made.

The control-thread meter ports the existing No.19 **48-kHz stereo** K-weighting, 400-ms/75%-overlap integrated gates (−70 absolute / −10 relative), and Annex 2 4× FIR estimate. `integratedLufsExcerpt` describes only the captured interval. `momentaryLufsLast400ms` is the last 400-ms window. Short-Term requires three seconds and is explicitly unmeasured for the current two-second AU capture. Other sample rates retain DSP/FFT/Peak/RMS, but AU LUFS/True Peak are explicitly unmeasured and Master candidates are rejected. No hidden 48-kHz coefficients on 44.1/96 kHz, unvalidated resampling, oversampled limiter, lookahead latency, or standards certification. FIR history is flushed at excerpt end and sample peak is a lower bound. Raw and attenuation-only RMS-matched comparisons retain identical start, duration, source IDs and per-candidate advanced settings. RMS matching does not equalize perceived loudness and never changes adoption values.

### Host control boundaries (official sources checked 2026-10-24)

- RBJ formulas: https://www.w3.org/TR/audio-eq-cookbook/ (W3C Working Group Note, 2021-06-08).
- Logic Smart Controls can map channel-strip and plug-in parameters: https://support.apple.com/guide/logicpro/lgcp7e59f24b/mac
- User-configured Controller Assignments: https://support.apple.com/guide/logicpro/ctls71c31487/mac
- Mastering Assistant's documented UI controls: https://support.apple.com/108294 and https://support.apple.com/guide/logicpro/lgcpa4b810ba/mac
- AU public host API: https://developer.apple.com/documentation/audiotoolbox/audiounitgetparameter and https://developer.apple.com/documentation/audiotoolbox/audiounitsetparameter

Successful NOVA AU control proves only host access to that instance. A sibling NOVA AU cannot discover or mutate Logic's internal EQ/Compressor/Mastering Assistant instances through this interface. The documented Smart Control / Controller Assignment path requires a user-selected mapping in Logic; no automatic assignment has been validated. Mastering Assistant internal automation/remote read-write is **unverified**. Its documented manual controls are not evidence of an external API.

No commercial products are installed, licensed, scanned internally, or controlled. Product name/version/component triplet/parameter IDs and ranges must be inventoried on an expressly approved installed instance. Public AU parameters must be accessed by the owner host or an approved host bridge; vendor-internal state is not inferred. Version changes require renewed inventory and mapping. All commercial EQ/Compressor/Reverb/Limiter support remains **unverified/manual**. Generic parameter control is not product compatibility evidence. No Accessibility permission, private Logic project mutation, external provider call, Apple signing identity or license activation is used.

Music Studio backups cover its own project data/handoff metadata. Logic .logicx projects, plugin binaries/licenses, and Logic's host state are outside that backup; save and back up Logic separately. Commercial signing/notarization, license review, physical Intel Logic recognition/playback/save/reopen, third-party mappings, full-song 44.1/96-kHz metering and musical quality acceptance remain open.

`tests/apple-host-control.mm --approved-ci-fixture` is a restricted standalone host probe for the OS-supplied Apple LowPass AU (the actual component constants and returned triplet/version are written to JSON). It enumerates public parameter IDs/ranges, records the old value, changes one writable value in its **own instance**, reads it back and restores the old value. The CI artifact records the actual product/version/triplet. This does not address a Logic-hosted instance, does not establish Logic Channel EQ/Compressor/Mastering Assistant support, and is not a commercial product compatibility result. It does not install any plugin.

The native loudness port is compared against existing Music Studio No.19 using the same float32 997-Hz, gated-silence, intersample-overshoot and unequal-channel noise fixtures. This verifies shared meter semantics rather than independence from the existing implementation. A separate local FFmpeg reference checks one calibrated sine. Full standards conformance and physical audio quality remain unverified.

## Whole-song offline extension — 2026-10-24 JST

The existing live AU capture remains two seconds at 48 kHz for excerpt LUFS. Full-song work is a **separate offline companion**, using the same `Quality` RBJ EQ and linked compressor. It never runs file decoding, FFT, metering, lookahead or subprocesses in the audio callback. The original AU IDs/component identity/state formats are unchanged. The companion is built x86_64 into the development bundle; its orchestration requires **Python 3**, not yet a self-contained commercial runtime. The AU's **全曲結果を照合** opens a completed companion manifest, verifies its files' SHA256 in a background queue, checks confirmed project/Track/position, and displays measurements read-only. It cannot apply the offline limiter or claim an equivalent live Logic sound.

```
g++ -std=c++20 -O2 tools/nova-au/whole-song.cpp -o /tmp/nova-whole-song
python3 tools/nova-au/whole-song.py Logic-Stereo.wav \
  --engine /tmp/nova-whole-song --output NEW_FOLDER \
  --project EXPLICIT_PROJECT_ID --track EXPLICIT_TRACK_ID --version AUDIO_REVISION \
  --source logic-render --kind stereo-out --confirm-source \
  --target-lufs -14 --ceiling-dbtp -1
```

`--kind track|bus|stereo-out` is mandatory; LUFS target normalization applies only to Stereo Out. `--role piano|strings|bass|drums|vocal|unspecified` and existing supported `--instruction` select the existing deterministic measured proposals. There is no learned inference/automatic artistic acceptance. Full-song band fractions and crest factor replace the two-second excerpt in those proposals. A/B/C retain conservative/balanced/stronger settings and target−2/target−1/target LUFS. Values and reasons are stored alongside their full-song measurements. The source never changes. Original/A/B/C and separately attenuated LUFS-matched WAVs have identical start/frame count/rate; matching does not alter adoption settings. All output WAVs are independently decoded and re-metered before complete=true. Comparison labels are never accepted merely on metadata.

Input is strictly validated RIFF PCM16/24/32 or IEEE float32, mono/stereo, **44.1/48/96 kHz**, 0.4 seconds to two hours, including bounded WAVEFORMATEXTENSIBLE PCM/float layouts. Unsupported RF64/compression/channel maps/partial-valid-bits are rejected. Mono is duplicated explicitly; it is not a multichannel loudness measurement. Source and decoded PCM hashes, project/Track/audio revision, rate/frames/channels, engine/pipeline identity and target settings are retained. Entire source SHA256 is checked before and after processing. Large files stream in 4096-frame chunks; input, six candidate intermediates and WAVs consume disk rather than unbounded RAM. Two hours at 96 kHz can require many GiB; disk-full fails incomplete. Data must fit RIFF's 32-bit size; no implicit format conversion or resampling.

K-weighting uses rate-specific bilinear BS.1770 pre-filter coefficients; 48 kHz retains the prior exact coefficients. Integrated loudness uses 400 ms windows, 100 ms hop and −70 LUFS absolute/−10 LU relative gates. Momentary is the final400ms, Short-Term the final3s; neither equals Integrated. Heads/tails and silence remain in the source; gates determine their Integrated contribution. Silence never generates an adoptable Master plan. `shortTermPercentileSpreadDb` is a descriptive 10th/95th percentile of above−70 full-song Short-Term blocks, **not EBU LRA**. Peak/RMS/crest and coarse 20–200/200–4000/4000–Nyquist Hann FFT power fractions remain distinct measurements.

True Peak is independently computed with the existing four-phase Annex2 FIR plus sample-peak floor and flushed tail. It is an **estimate**, not standards certification; FFmpeg `ebur128=peak=true` is an independent reference. Tests require <0.15 LU and <0.5 dBTP difference on specified mixed/gated fixtures across 30s/4min/8min and each rate. These fixture tolerances are not a universal error guarantee or a relaxed definition of conformance. Wider pathological signals, independent certified meter corpora, listening and codec tests remain necessary.

Offline processing order: existing RBJ EQ → existing linked compressor → static Gain → **5ms linked sample-lookahead peak control / 100ms exponential release** → measured global attenuation if required. The lookahead buffers only5ms and flushes/trims its delay, preserving exact file alignment. Attack is instantaneous within the future window; release gain is bounded by that window's maximum. It is not an oversampled true-peak limiter; intersample control is established by whole-output FIR measurement plus a separate global attenuation correction. Trial and final limiting use a 0.5dB margin; residual correction targets 0.1dB below the requested estimate ceiling. Output WAV remeasurement must be within requested estimate ceiling and contain zero ≥1 samples. The old AU ±.98 emergency clip is not used by this offline chain and is never called a Mastering limiter. Maximum reduction, final gain, correction, target shortfall and measured dynamics are retained. A loudness shortfall is reported, never silently called successful target attainment. More gain does not imply quality.

Optional `--handoff nova-logic-instruments.json` verifies the project and exactly one Track, retaining instrument/preset assignment metadata read-only. Optional repeated `--stem vocal=Vocal.wav --stem piano=Piano.wav --confirm-stem-alignment` checks equal frames/rate, hashes every source and reports relative RMS and coarse spectral overlap. Alignment remains an explicit user confirmation. This **does not establish perceptual masking**, temporal overlap, automatic source recognition or musical superiority; single Track analysis never claims cross-Track masking.

SIGINT/SIGTERM marks cancelled/incomplete and stops the child. `--resume` with the same full invocation validates identities and all completed artifact hashes, then reuses completed stages only. Interrupted stages restart from zero: there is no unserialized filter state continuation or partial-file adoption. An exclusive workspace lock prevents simultaneous render/adoption. Changed source/version/options/engine/pipeline refuses resume. Completed and cancelled work is distinguishable; no partial capture/file is labelled whole-song complete.

Adoption is explicitly separate:

```
python3 tools/nova-au/select-whole-song.py OUTPUT_FOLDER \
  --project EXPLICIT_PROJECT_ID --track EXPLICIT_TRACK_ID --version AUDIO_REVISION \
  --source-wav Logic-Stereo.wav --choice B --approve
```

This verifies source/binding and every artifact, copies only the approved candidate to `adopted.wav`, and writes a before/after history. `--choice undo --approve` restores the prior selection. Undo to no selection retains the old exported copy as **inactive**; the manifest's adopted field is authoritative. Nonadopted alternatives are never deleted. Reopen uses the persisted manifest; re-adjustment uses the original source and a **new output directory**, preserving old candidates/history. No Logic project, live AU parameter, host automation, third-party AU or original MIDI/lyrics/audio is changed. Music Studio backups and Logic backups remain separate. Exporting the selected WAV is a file workflow, not a verified live parameter round trip.

`tests/whole-song.py --engine ENGINE --output NEW_DIR --long` runs the 3×3 rate/duration meter matrix, independent FFmpeg comparison, all-rate30s and48k4/8min full processing, output remeasurement, LUFS-matching, save/reopen hash-stability and approved adoption/Undo. `tests/whole-song-safety.py` covers corrupt/nonfinite/silent input, cancellation, changed-source refusal and intersample overshoot. Actual Intel AU factory tests additionally stream the live quality chain for the same3×3 duration/rate matrix. Those host tests establish real AU long rendering, not that the offline limiter runs inside the AU or that Logic itself was tested.

Resource reports distinguish CPU seconds, wall time, maximum individual process RSS and disk bytes; they are not Logic CPU utilization. The live AU has no new limiter latency and its two-second capture is not extended. Commercial runtime packaging, signing/notarization, native companion launch/cancel UX, physical Intel Logic play/save/reopen, purchased-instrument/vocal listening, verified third-party mappings, further transparent peak-control/oversampling design and independent meter conformance remain open. Formal No.5/18/19/20 A/B grades and total completion are not upgraded.

PHP/Pages audit boundary is retained: GitHub Pages does not execute server-side PHP. No PHP dependency, public setting or Live Provider API is added by this extension; the prior audit does not attest unknown external hosts.
