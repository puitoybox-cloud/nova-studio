# MIDI output candidate integration — 2026-10-16 JST

Parent: Draft #435 / 22fa885d0b955ca74bab2dbcad7745fc1681006b.
Parent exact-head workflow 38875421819 SUCCESS; verify and vocal-layout both SUCCESS. No parent CI failures remained.

## Production behavior

Read 1–3 actual user-selected SMF files into independent A/B/C melody candidates. Retain source beat offsets (including leading rests), pitches, polyphony and velocities; convert source PPQ to current project PPQ by rounded endpoints. Place at selected measure start. Reject collapsed notes or output exceeding the exact changing-meter range. Keep project tempo, meter and instruments. Preserve original notes; imported candidate adoption is additive.

Reuse existing candidate adjustment (transpose/velocity/duration), Preview, sample instrument fitting, real audio audition, partial measure adoption, locks, Undo/Redo, project save/reopen, JSON and complete backup restore. Candidate MIDI and unverified origin metadata persist in aiWorkspace. All files preflight before candidate workspace mutation. Stale project/session/track/range/MIDI/workspace or superseding file reads discard old results.

File limits: three files, 1 MiB each, 4096 notes per file. Require one melodic track/channel. Reject drums, control changes, pitch bends, unsupported events, unfinished notes, orphan offs, invalid metadata, post-EOT data, size mismatches, malformed files and unsupported timing. Larger/multi-track performance imports remain available through existing MIDI Import. The UI explicitly states that this imports outputs and does not execute a model or verify its license.

## Validation

Node full suite 2330/2330 PASS, no skips. 14 new executable tests include actual MIDI bytes, timing/velocity, imported preview/edit/audition-plan/partial-adoption/Undo, async stale results, atomic import and repository save/complete backup restore/reopen.
All changed JS syntax and base diff whitespace checked. New real-browser script covers file picker → A/B/C → edit → actual PCM audition → partial Apply → toolbar Undo/Redo → IndexedDB save → complete backup restore at 1440/820/390/1180x820. Local Chrome executable absent; local browser run could not execute. Exact-head CI pending at commit time. Do not infer browser success from Node.

## Model/runtime/license evidence

2026-10-16 inspection: no .onnx/.pth/.pt/.ckpt/.safetensors assets in repository. Python torch, nnsvs, onnxruntime and tensorflow absent. No models/voicebanks were downloaded or executed. No real model output is asserted for test MIDI/PCM fixtures.

Primary sources checked 2026-10-16:
- https://github.com/magenta/magenta-js — source Apache-2.0; checkpoint availability does not independently establish every model's redistribution terms.
- https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md — pretrained checkpoints and local downloader documented. Local runtime/weights installation, compatibility and individual model license acceptance remain unverified.
- https://nnsvs.github.io/notebooks/Demos.html — provided pretrained voices restricted to research; not adopted for production.

Actual model composition, Japanese neural singing, distributable voicebank/model licenses and runtime/packaging remain incomplete. Recording and physical iPad/Safari/Mac/MIDI/microphone acceptance are not newly certified. No 20–30 independent production completions claimed. Existing formal ledger verification/music-multisample-30-features-20261016.json retained conservatively: No.1–30 C; A0/B0/C30, no newly certified completion percentage.

New Draft only. No main/existing PR mutation, Force push, Ready/Merge/Auto Merge, data deletion or Live Provider API.
