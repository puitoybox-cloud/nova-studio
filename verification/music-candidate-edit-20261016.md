# Candidate editing production continuation — 2026-10-16 JST

Recovered #431 exact 4ffa0919627c303d72df00dead1179b6a10a7bdc. Fresh GitHub snapshots cover 178 Open PRs (draft flags in companion JSON), HEAD/base, mergeability, latest commit, filenames and exact-head workflows. No newer checkpoint found. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3. Existing PRs are untouched.

## Implemented

MIDI candidates expose compact bilingual Edit controls in a closed details element. Transpose (-24..24 semitones), velocity delta (-64..64), and note length (25..200%) transform actual proposed MIDI before preview, audition and adoption. Preview uses a disposable session and normal locked/stale/range validation before saving the settings. Reset returns to generated values. A/B/C settings remain separate; source MIDI and Undo are unchanged until Apply. Existing saved candidates without edits retain their behavior.

Edits are stored inside the existing candidate value and production workspace save/reopen/full backup restore. Existing note updates and new notes use the same transformation. Reject invalid values, MIDI overflow, range overflow and instrument octave/velocity remapping instead of silently altering requested values. Apply retains ordinary Undo and partial-range protections. Family apply preflight is cleared after edits. Standalone and integrated script versions are updated together.

## Validation

Seven added Node regressions cover actual note transformation, audition/Apply equality, Undo, strict validation, panel rejection/reset, source isolation, saved candidate and MIDI roundtrip, partial/stale protection, instrument boundary rejection and existing note editing. Full Node and Python runs plus JS syntax and git diff --check are performed locally; exact results belong to final PR description.

The existing real Chrome multisample fixture now operates Edit controls, listens, compares actual scheduled/adopted pitches and verifies saved/restored edits at 1440/820/390/1180x820. Local browser executable is absent; local browser execution failed at launch. Browser and Swift/native evidence must come from exact-head CI, not from this attempted local run. Physical iPad Safari/Intel MIDI/microphone remain unverified.

## Models and voice material — checked 2026-10-16

No model weights or voicebank found in repository (onnx/pt/pth/ckpt/safetensors/tflite scan). Existing requirements contain Demucs/Basic Pitch audio-analysis dependencies, not a composition or Japanese singing runtime. No fake inference or voice waveform is added.

Primary sources checked:
- https://github.com/magenta/magenta-js — Apache-2.0 source, TensorFlow.js music inference library. Source license alone is not independent confirmation of every weight/voice/material license.
- https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md — hosted/local checkpoint instructions and MusicRNN/MusicVAE model inventory. Actual runtime/checkpoints are not installed or executed here. Model-specific redistribution scope is unconfirmed.
- https://nnsvs.github.io/notebooks/Demos.html — published example pretrained NIT-song070 models are restricted to research use. They are not adopted as a commercial production voicebank.

Production model composition and AI/Japanese singing remain incomplete: actual approved runtime, model bytes, voice materials, compatible deployment and real inference acceptance are missing. This change improves candidate editing and does not implement model inference. Twenty to thirty independent production items were not completed.

## Formal status

Conservatively inherit verification/music-multisample-30-features-20261016.json: No.1–30 C, A0/B0/C30. No new full-feature certification or completion percentage. This carried-forward ledger is not a newly exhaustive specification acceptance audit.

Draft only. No main change, force push, Ready/Merge/Auto Merge, Live Provider API call or original screen/data deletion.
