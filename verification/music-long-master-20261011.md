# Long-WAV production mastering — 2026-10-11 JST

Baseline: PR #399 `33cc706c7d1bc1e2451d967181ee3924127ce354`, Open/Draft/mergeable, all five exact-head workflows success. Fresh GitHub enumeration: 146 Open / 144 Draft, each Draft's HEAD/base/mergeability, filenames and exact-head runs fetched. No observed Draft conflicts. Main `552d56eafddfd192970c09f7d6278696cf8775c3`. Start evidence is `music-long-master-start-20261011.json`. No prior PR or branch is modified.

Authoritative scope: `Music_Studio_最終機能仕様書_v1.pdf`, fixed 2026-09-30, current five-page contents read 2026-10-11. This change addresses a subset of No.19/22/23; it does not complete all 30 major features.

## Production behavior delivered (24 small behaviors, one connected mastering workflow)

1. Existing long-WAV screen exposes a real mastering form.
2. User enters target LUFS and true-peak ceiling with validated limits.
3. IndexedDB original WAV is integrity checked before processing.
4. Existing saved Gain/EQ/Compression/spatial processing is the measurement source.
5. Continuous K-weighting/filter history spans bounded decoded chunks.
6. Integrated LUFS gates cover audio beyond the inline PCM sample limit.
7. Continuous four-phase true-peak FIR includes chunk boundaries and tail.
8. Silence/insufficient blocks refuse unavailable loudness.
9. Unsupported sample rates explicitly refuse rather than using wrong coefficients.
10. Actual gain candidate respects measured peak and existing gain bounds.
11. Saved EQ/compressor/spatial parameters remain unchanged: only gain is adopted.
12. Actual long PCM is processed and PCM16 WAV encoded incrementally.
13. Quantized output is decoded and remeasured before publication.
14. Clipping, ceiling or output format mismatch refuse publication.
15. Processing status updates by frames and yields between chunks.
16. Custom/-14/-18 LUFS candidates are measured separately for comparison.
17. Explicit selection uses checked candidate identity and source revision.
18. Source/result LUFS, dBTP, gain and peak-limited target shortfall are displayed.
19. Existing Original/A/B audition is connected to actual long WAV candidate bytes.
20. Atomic save stores chosen gain history plus measured mastering provenance; original binary/MIDI remain intact.
21. Undo/Redo and fresh repository reopen regenerate the saved PCM16 WAV.
22. Full WAV Archive preserves original binary, settings and measurements; Restore remaps the mastering source identity to the restored asset and exports identical processed bytes.
23. Cancel invalidates processing/choices/adoption, stops playback and frees retained comparison choices; failed processing permits retry.
24. Dirty edits, concurrent storage changes, quota, candidate tampering and stale selection reject unsafe writes. Cache versions align host/standalone.

These count new behavior or newly connected production paths, not independent major features. Saved long Master is non-destructive DSP settings plus original audio, not a separately retained rendered Master binary. Processed WAV materializes the result on export; full archive can faithfully regenerate it. JSON/ordinary backup deliberately cannot claim complete long-binary backup. Use Full WAV Archive.

## Limits and remaining software work

48kHz mono/stereo only. Gain mastering is not a true-peak limiter. Existing compressor is nonlinear, so target LUFS is not guaranteed; actual output is always measured and ceiling checked. Output binary Blob(s) remain in memory; PCM decoding/filter processing is bounded. Multiple candidates retain up to three encoded WAV Blobs, so full Intel memory/performance acceptance remains necessary. Meter conformance corpus, arbitrary-rate metering, limiter, whole-song mix and Master/Instrumental/Stem/MIDI batch package remain incomplete.

No new vocal recording or pitch/timing editor is claimed. Noncompressed vocal capture, Stop durable save/retry, take/comp/punch/cycle, latency/MIDI synchronization, waveform/lyrics-note editing and final vocal checks remain software work. No non-vocal live recording added.

## AI singing source inspection — 2026-10-11

Official OpenUtau DiffSinger documentation: https://openutau.com/DiffSinger-support/ — CPU rendering default, macOS 11+ and separately installed nsf_hifigan vocoder. OpenVPI engine repository https://github.com/openvpi/DiffSinger — Apache-2.0 engine license; this alone does not establish individual voicebank/vocoder redistribution or output rights. NNSVS official API https://nnsvs.github.io/modules/svs.html — real SPSVS runtime with CPU device option, requiring a model directory.

OpenUtau/DiffSinger CPU is an investigation candidate, not a selected or bundled Intel production runtime. An executable Intel installation plus approved Japanese model bytes, phonemizer, vocoder, dependencies and model-specific rights have not been verified in this environment. Existing app Python pipeline implements separation/transcription, not this singing engine. No model/provider calls, generated fake singing, dummy successful results or AI-vocal completion claim.

## Formal 30-major-feature status

No.1–30: C. A0/B0/C30 retained; no promotion follows merely from this mastering subset. A requires formal production and device acceptance; B requires all software requirements closed with only physical acceptance remaining. Full all-30 closure cannot be verified. Existing baseline report details unresolved production/native/runtime/license/inference/migration/model-switch/cloud-sync and all-feature evidence requirements.

Physical-only acceptance: Intel performance and peak memory on real songs; audio output/routing quality; native reopen/termination and migration; actual Keystation MIDI capture; Helper identity/accuracy and Logic round trip. iPad picker/permissions, Japanese/touch layout, audio routing, suspension/termination/reopen, real quota. Swift/Xcode unavailable locally: use exact-head native CI; local build passes must not be claimed.

## Validation

Final exact-head results and workflow links are recorded in the Draft PR. Browser harness now exercises >2M-sample long-WAV UI Preview/A-B/cancel/retry/save/reload/full archive/additive Restore/identical processed WAV at 1440/820/390, retains short mastering/harmony regressions, and asserts empty error/warning/external-request arrays. CI artifacts contain exact HEAD and screenshots.

Safety: main/user songs/backups/unrelated PRs untouched; no Ready/Merge/Auto Merge/force push or Live Provider calls.
