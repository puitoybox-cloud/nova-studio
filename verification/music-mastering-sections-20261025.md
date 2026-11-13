# Whole-song section evaluation — 2026-10-25 JST

Base: Draft #510, 27bfc24a013fa5377821fc30791ea9270882bcc4. Its physical-test package is unchanged and remains the 2026-10-27 candidate. This branch does not select a replacement package.

## Implemented

A separate `nova-section-meter sections INPUT.f32 RATE` diagnostic executable measures aligned nonoverlapping three-second sections with the existing BS.1770 meter, FIR true-peak estimate, sample peak, RMS, crest, clipping and band-energy measurements. It preserves final partial sections and marks silence/<400ms loudness invalid. It does not alter production meter JSON, EQ, Compressor, Gain, lookahead, global true-peak attenuation, eight retained WAVs or cleanup/resume contracts.

`compare-sections.py` compares original/candidate section loudness gain, median section gain, deviation from that gain, gain variation and crest changes. Uniform amplification is distinguishable from changed section dynamics. No quality ranking, vocal isolation or intelligibility measurement is claimed. Three-second sections cannot resolve individual compressor attacks or assign instruments in mixed audio. These are diagnostics, not an automatic mastering policy or a UI-integrated assistant feature.

The full processing acceptance matrix now emits separate A/B/C section reports for 30-second/all-rate and 240/480-second/48kHz renders. Diagnostic PCM exists only in a private temporary directory, one decoded render at a time. Original/comparison WAVs and manifest remain read-only. Diagnostic time/disk are additional validation cost, not production processing benchmarks or peak system disk reductions.

The script and separate diagnostic executable are included and inventoried in the new development package. Existing package-only CI exercises it under the contained interpreter, isolated PATH and relocated bundle; actual outcome must be checked at the final commit.

## Validation and limits

Local PCM regression at 44.1/48/96kHz passes: silence, final 100ms invalid tail, uniform +6.020599913dB gain, >6dB variation for only quiet-section amplification, mismatched alignment rejection, unchanged source hashes. Existing Node 2613/2613 passes; all 262 tracked JS syntax checks pass. Full A/B/C/reference/save/resume/adopt/Undo and exact-head Intel/browser CI results are recorded in the PR after completion. Local Linux has no Swift or macOS AudioComponent/auval runtime.

Three requested Japanese wordings (natural piano / soften harsh highs / clean low end) now enter the existing measured A/B/C proposal path with exact canonical equivalence. This remains explicit keyword rules driven by FFT/Peak/RMS, not semantic AI or proof of vocal clarity. History midpoint and loudness/punch commands are explicitly regression-tested as unsupported rather than silently guessed. No automatic adoption is added. Existing role/track distinction, approval/adoption/Undo, Logic handoff and owned-instrument registration are retained without new semantic claims. External-AU direct control, recorded-vocal clarity, physical Logic automation/listening/save/reopen and commercial-instrument operation: unverified. Developer ID, notarization, minimum-macOS acceptance and redistribution closure remain unfinished.

Formal A0/B0/C30 is unchanged. The prior full ledger is `music-audio-integration-30-features-20261024.json`; its 30 requirements and unresolved obligations remain applicable. The original PDF was not re-read in this work; no formal feature promotion or physical-only completion claim is made.

Initial Intel CI at d5fabf2 exposed the native four-entry inventory contract after adding the diagnostic script as a fifth entry. The native controller now verifies the exact five required names and all five hashes, retaining exact-count rejection and no fallback. The failed run is not counted as success; the corrected commit requires a complete fresh Intel run.

Performance correction: two Linux full-subprocess 480s comparisons showed the initial inline diagnostic branch slower than #510 (87.202→91.891s, then reversed order current 96.294s vs #510 86.999s). CI vs #509 also showed only 21.54% reduction, not the prior 28.19%. Therefore section diagnostics were moved into a separately compiled/signed executable and whole-song.cpp restored byte-for-byte to #510. Native integrity checks require the exact six-file set and all hashes. New performance measurements and fresh complete CI are required; initial timing is retained rather than hidden.

After separation, local 480s complete-subprocess time was 85.449s (preceding #510 reverse-order baseline 86.999s); all eight WAV hashes and final render measurements match #510 exactly. This is one local observation, not a universal speed guarantee. The separate diagnostic regression passes all three rates.
