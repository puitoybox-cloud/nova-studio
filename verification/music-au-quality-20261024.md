# NOVA AU quality checkpoint — 2026-10-24 JST

Base: PR #503, `9792921d937664abf1d77cb0e5f50b68333db83d`. main and existing PR branches are not modified. This extension addresses formal No.5/8/18/19/20 only; no formal completion upgrade is justified before required production and physical acceptance.

Implemented production path: approved measured proposal → append-only AU parameters → actual stereo RBJ EQ / linked soft-knee compressor → original emergency ceiling → Gain/Bypass → bounded capture → control-thread loudness/FFT → same-source WAV comparison → full state/Undo. See tools/nova-au/README.md for ranges, quantization, actual scope and limits.

Local portable checks:
- Original DSP and measured analysis tests pass unchanged, with modern proposals using the new processing.
- Shelf ±6 dB response measured at 30 Hz / 0.4×sample rate within 0.08 / 0.12 dB; peaking ±12 dB at 1 kHz, Q .25/1/8 within .002 dB, for 22050/44100/48000/96000/192000 Hz.
- Compressor threshold −24 dBFS, ratio4, hard knee, DC inputs −36/−18/−6 dBFS: 0/4.5/13.5 dB steady reduction. Unequal L/R inputs retain 4:1 amplitude ratio.
- Attack10ms reduction step fraction .632121; Release150ms decay fraction .367879. These verify the stated dB-domain detector convention.
- Deterministic parameter-extreme modulation, unusual 1..257-frame slices and NaN inputs produce finite bounded output. More extensive click/perceptual acceptance remains open.
- 48-kHz stereo 1-kHz sine, amplitude .1, two seconds: −19.9933 LUFS / −19.9933 dBTP estimate. Independent local FFmpeg ebur128 reports −20.0 LUFS and −20.0 dBFS true peak (rounded). This fixture agreement is not standards certification.
- Requested −18 LUFS, same input: A/B/C −20.0037 / −19.0040 / −18.0043 LUFS, estimated True Peak −19.9968 / −18.9912 / −17.9848 dBTP, no clipped samples. These are deterministic DSP fixture measurements, not a Logic instrument or musical acceptance.
- Two-second capture does not measure three-second Short-Term. Other rates reject AU Mastering/LUFS/TP rather than misusing fixed coefficients.
- Local full Node: 2613/2613 PASS. New native host acceptance and exact-head Intel CI results are recorded in the PR after execution; do not infer their success from local C++ tests.

Remaining essential gaps: physical Intel Logic, musical listening, whole-song analysis and mastering, rate-correct metering beyond 48 kHz, transparent oversampled peak limiting, finer parameter resolution if listening demands it, host automation scheduling/gesture/grouping quality, Logic and product-specific approved host bridge mappings, commercial signing/notarization/license review. No claim that every commercial plug-in is controllable. Ready/Merge/force push prohibited.
