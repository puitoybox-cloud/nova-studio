# Offline six-note acceptance foundation

Date: 2026-10-04 JST. Independent branch from #289 `418dc57429f91ffcef6b578a7edfda36012576fd`.

Master audit and unified order: `docs/music-studio/COMPLETION_MASTER_PLAN_V1.md`. Start GitHub inventory including existing PR HEADs, Draft base HEADs/mergeability and returned Actions: `verification/music-completion-start-20261004.json`.

The previous real-conversion verifier could PASS six correct pitches at incorrect times and silently omit malformed MIDI events. The new read-only checker reuses the production SMF parser, validates the exact existing synthetic WAV SHA-256, and grades actual MIDI bytes. It checks 6 Vocals pitches, note count/onsets (existing 0.05s regression threshold), positive duration/end/overlap, Type1/7 tracks/6 unique named stems, EOT/unfinished/orphan notes/trailing bytes and conflicting same-tick tempo. These are fixture verification rules, not musical generation or persistence policy. It records source/output/helper digests and automatically observed host platform/architecture. `physicalVerification` always remains `pending`.

The checker never converts or repairs notes, changes input bytes, grades unrelated audio, writes songs/backups, or calls a network/provider. `verify_real_conversion.py` consumes this byte result and no longer relies on pitch/count alone for PASS. The actual model workflow receives Node 22; this request does not run Demucs/Basic Pitch or download models. A new PR-triggered offline workflow runs full tests, syntax, whitespace and the existing comprehensive real Chrome harness. Production UI/storage/algorithm remain untouched.

Local verification:
- node --test: 1314/1314 PASS; FAIL 0; skipped 0. Existing 1292 regressions retained, 22 new tests.
- All 134 JavaScript files node --check PASS; Python verifier py_compile PASS; git diff --check PASS.
- Exact #289 baseline with only the new test file: FAIL (module unavailable, 1 suite-load failure); final new tests 22 PASS. This proves the API is absent on baseline, not 22 separately runnable baseline case failures.
- Real September captured MIDI is rejected for wrong pitch/extra notes, bytes unchanged. A constructed correct six-note Type1 MIDI passes; this is not a real model conversion result or physical accuracy proof.
- No local Chrome binary was present. Final-head browser evidence comes from the new workflow artifact, never reused #289 results.

Physical Intel Mac conversion, signed package installation, Japanese/touch Safari layout, audible timing/latency and Keystation acceptance remain pending in the consolidated master-plan batches. CI cannot complete those items.
