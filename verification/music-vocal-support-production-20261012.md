# Vocal input support and selected breath gain — 2026-10-12 JST

This patch adds ten substantive production capabilities to checkpoint #402:

1. Real microphone Peak/RMS/dBFS and clipping indication, sampled from the input analyser during capture.
2. Explicit headphone monitoring ON/OFF at -12 dB, muted by default, on an independent input-to-output gain path; recording bytes are unaffected.
3. Stop, discard, permission failure and microphone disconnect release meter timers, input graph and monitoring resources.
4. PCM punch-out is enforced by a bounded audio-thread frame limit, independent of document timer suspension; legacy 120-second maximum remains. Punch-in transport and automatic cycles remain open.
5. Selected breath/range gain (-60 to +12 dB), applied to actual PCM with short boundary fades; manual selection, no automatic breath detection.
6. Before/After audio candidates, partial candidate selection, cancellation and adoption reuse the actual vocal rendering path. Existing pitch/duration parameters within a breath selection are retained.
7. Source audio remains unchanged; durable gain edits use explicit v3 semantics, retain v1/v2 compatibility, support Undo/Redo and reopen.
8. Edited WAV, Mix publication, Comp snapshots and complete Full WAV Archive/additive Restore carry the gain processing and preserve identical regenerated output.
9. Explicit Pause/Resume preserves one take, omits paused samples, mutes monitoring and allows paused Stop/save; stale project/repository changes reject Resume.
10. Track mute and suspended audio context pause capture; user resumes explicitly. Process termination/native suspension recovery is not established.

Ten means ten connected capabilities, not ten completed major functions. The target of 20–30 new production items is not reached by this patch. No padded item count or 100% claim.

## Starting evidence

Main `552d56eafddfd192970c09f7d6278696cf8775c3` was fetched by git. Enumerated 147 open Draft PRs and two non-Drafts. Every Draft metadata/head/base/mergeability, latest head commit, changed filenames and exact-head workflow response was fetched independently; 22 historical unsuccessful runs and 21 failed-job logs were read. One unsuccessful run had no failure-conclusion job to fetch. Evidence: `music-vocal-support-start-audit-20261012.json`.

#402 actual branch is `feature/music-vocal-correction-comp-sync-v1`, HEAD `fc3f315547943eb83142a2c6751e2a9f2c3e179f`. Open/Draft/mergeable, six exact-head workflows success. User-supplied branch and PR-body historical HEAD are not the actual latest branch/head. This new patch is based on that verified commit; previous PR body is untouched.

## Validation

New focused DSP/capture suite: final count in PR evidence. Actual amplitude changes, unchanged outside-selection samples/source bytes, durable v3 reopen, Undo/Redo and byte-identical full restore tested. Monitor graph is exercised with an injected audio implementation; physical monitoring quality/latency is not established by this unit test. PCM worklet synthetic test proves exact 513-frame punch limit without document timer.

Local Python: 509 run, 504 PASS, five preexisting audio-dependency skips. Python emitted preexisting subprocess/file ResourceWarnings; these are not Chrome Console findings. Local all-JS syntax: 192 files PASS; final changed JS rechecked. git diff --check PASS.

Initial full Node run: 2137 PASS / 2 FAIL, both stale escaped cache-version expectations. Those expectations were updated to the new actual version; corrected full Node 2139 PASS before Pause/Resume follow-up; final full Node is rerun for the follow-up, see exact-head CI/PR final report for final results.

Local Playwright launcher could not find an installed browser executable. No local Chrome, Swift/Xcode, macOS/iPad build or physical-device pass is claimed. Updated CI browser scenario checks real Chromium synthetic microphone meter/monitor UI, gain UI preview/Before/After/adoption at 1440/820/390, save/reopen, archive, console and external requests. Native and full tests run against exact PR HEAD in Actions; consult final PR body for outcomes. Browser screenshots include the gain candidate controls.

## Formal 30-feature status and software remaining

A0/B0/C30 retained, every No.1–30 C. The previous repository ledger is the mapping source; original specification PDF was not reread in this environment. No feature promotion or formal full-scope re-certification is established.

Remaining software: formant-preserving pitch correction, explicit formant controls, vibrato analysis/adjustment, automatic microphone round-trip measurement, transport punch-in, cycle recording, lyric scrolling and capture accompaniment synchronization, native suspension/process-interruption recovery, approved local singing runtime/models/Japanese phonemizer/vocoder/license/bundling, final batch/Stem distribution and standalone production delivery obligations from the existing ledger. Existing correction/Comp/master paths are not counted as newly completed here.

AI singing source check (2026-10-12 JST): official OpenUtau Install/DiffSinger-support pages describe macOS/DiffSinger and voicebank-dependent settings; official NNSVS installation/SVS pages document PyTorch, models and HTS labels. These sources do not establish a licensed bundled Japanese Intel installation in Music Studio. No actual model, voicebank/vocoder closure, Intel execution or redistribution approval was verified; singing synthesis remains incomplete. Sources: https://github.com/openutau/OpenUtau/wiki/Install ; https://github.com/openutau/OpenUtau/wiki/DiffSinger-support ; https://nnsvs.github.io/installation.html ; https://nnsvs.github.io/modules/svs.html . No model downloads/provider calls.

Physical-only checks: Intel Mac/iPad microphone permissions, native file-origin capture, headphone output/feedback/latency and audible quality, synchronization, suspension and process restart, Gatekeeper/notarization, touch/Japanese fonts, real storage pressure and Logic/Keystation interoperability.

Safety: main and prior branches untouched; no user song/backups edited, destructive migration, force push, Ready/Merge/Auto Merge or Live Provider API. New Draft only.
