# Vocal transport and repeated-take production — 2026-10-12 JST

Based on actual Draft #403, HEAD bd11cf930eba7af2f1fb2cac6602189ff46fccc1, branch feature/music-vocal-production-next-v1. Main freshly read as 552d56eafddfd192970c09f7d6278696cf8775c3. All 148 existing Drafts were fetched independently for HEAD/base/mergeability, latest commit, first-page changed files and exact-head workflow runs; 150 total open PRs. First-page truncation flags are recorded in the source audit. #403 exact-head six workflows are successful. Historical unsuccessful reruns were enumerated; their logs were not all reviewed. No claim of exhaustive historical failure diagnosis.

## Connected production behavior

1. Audible 0–16-beat count-in is scheduled on the capture AudioContext.
2. MIDI transport preroll and punch-in use the same audio clock; worklet discards every pre-punch sample, including a partial audio block.
3. Punch-out preserves the exact configured number of PCM frames even without the document timer.
4. Recording-time MIDI accompaniment is scheduled from the chosen transport tick through the punch end, respecting the tempo map.
5. Finite 2–8-cycle recording commits each original WAV and metadata before requesting the next take. Save failures retain pending PCM and stop repetition. This is repeated-take recording with a storage gap, not gapless looping.
6. Takes receive stable group IDs, numbered filenames, order and total metadata; UI displays group/order and existing per-take playback provides comparison. Original recordings are retained.
7. Saved capture plans refill start/end/count-in/transport/cycle/accompaniment controls on fresh reopen and additive Full WAV Archive restore.
8. Explicit Stop/Discard, permission failure, suspension and microphone interruption stop further cycles; armed Stop saves no preroll. Shared synth disposal does not close the caller-owned recording context.

These are eight connected capabilities, not 20–30 completed items. Comp selection/render, vocal WAV export and authenticated additive Full WAV Archive are existing production paths now exercised with repeated takes; they are not counted as newly implemented features.

Physical microphone latency is unmeasured. No guessed input/output latency or automatic correction is introduced. Manual latency remains available. Synchronized capture requires PCM AudioWorklet; unsupported environments fail before microphone permission. Ordinary nontransport capture retains MediaRecorder fallback and Pause/Resume. Synchronized capture uses Stop instead of Pause because deleting paused samples would break MIDI placement.

## Validation before publishing

- Full local Node: 2149 PASS before the final shared-context ownership test; final full run/CI count must supersede this preliminary value.
- Local Python: 504 PASS / five preexisting dependency skips (509 executed). Existing subprocess/file ResourceWarnings are distinct from browser Console checks.
- Local JavaScript syntax: 193 files PASS; final touched files rechecked; git diff --check PASS.
- Focused tests cover sample-accurate scheduled gating, cancellation, tempo-map count-in/preroll, two actual PCM takes, ordered durable group metadata, fresh reopen, WAV export, Comp, byte-identical additive archive restore, quota rollback and preservation of existing MIDI.
- Chrome acquisition failed in this Linux environment (truncated download); no local browser pass is claimed. CI runs real Chrome at 1440/820/390, records screenshots, checks browser Console error/warning/pageerror and external request arrays, reopens stored plans, exports both takes, renders Comp, verifies archive bytes and cancels armed capture.
- Swift/Xcode are unavailable locally. Exact-head native CI must establish Swift tests and unsigned macOS/iPad Simulator builds; successful builds do not establish physical acceptance or model/distribution completeness.

## Thirty-feature status and remaining software

A0 / B0 / C30 is retained conservatively from the #403 feature ledger. No major feature is newly declared complete. The original specification PDF was not independently retrieved in this run; whole-spec current mapping and formal completion cannot be newly confirmed. The inherited per-feature ledger explicitly marks completeCurrentMappingVerified=false.

Remaining software includes automatic physical roundtrip calibration with reliable probe detection/device matching, separate input/output evidence, compensated accompaniment, gapless loop recording, lyric scrolling, formant-preserving processing/vibrato, approved Intel singing model/runtime/voicebank/phonemizer/vocoder/license assets, final whole-song Master/Instrumental/Stem/MIDI batch packages and export history, and remaining standalone production/distribution obligations. Existing edited vocal export is not a full-song batch export.

Physical-only acceptance: Intel Mac and iPad real microphones/headphones, audible latency and accompaniment alignment, human vocal quality, permission denial/device disconnection/sleep/background behavior, process restart and storage pressure, Japanese typography/touch, native file-origin permissions, Logic/Keystation import/playback, Gatekeeper/signing/notarization.

## Safety

New Draft branch only. No main, previous PR branch, existing song or backup overwrite; no Ready/Merge/Auto Merge/force push or Live Provider calls. Repeated recording is vocal-only. WAV/metadata publication uses existing authenticated atomic repository writes. Full WAV Archive restores additively. Previously saved takes survive later cycle cancellation/failure.
