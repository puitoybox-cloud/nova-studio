# Production recovery — 2026-10-18 JST

Source: #452 exact HEAD 44689c5b12a53e886da746c3e7d6b9d325d7f1ce. Main 552d56eafddfd192970c09f7d6278696cf8775c3 unchanged. Latest inventory: 199 open PRs, 197 Draft; all HEAD/base/mergeability, paginated changed filenames, latest commit metadata, first-page PR workflow runs fetched. #452 newest. Seven parent workflows success. Historical failure logs were not exhaustively audited. Snapshot: music-production-recovery-start-20261018.json.

## Production changes

MIDI render uses the existing real Web Audio synth/sample scheduler with OfflineAudioContext. It renders saved non-muted tracks from zero, integrates tempo changes, retains note velocity and the current project sample instruments, and includes release/one-shot tails. Runtime Solo and loop do not affect the saved render. No provider API or new sound/model assets. Limit: MIDI timeline 120 seconds, 20,000 notes, extra sample tail <=10 seconds. Missing/unmapped samples, invalid notes, excessive capacity, clipping and unavailable OfflineAudioContext fail closed. This is the existing simple monitor sound, not a high-quality replacement sound library.

Export now offers MIDI Audio / Render-Save. PCM is encoded through bounded 16k-frame chunks into 48kHz stereo PCM16 WAV. Source MIDI and all previous WAVs remain. An authenticated binary + project metadata transaction publishes the render; dirty edits, cancellation, stale storage/repository and quota failures preserve originals. Render provenance includes source revision, track IDs and note count. Multiple renders remain separate; users explicitly choose Sources to avoid layering old and new renders. They can use the existing long-WAV Mix, Mastering, Export and Full WAV Archive paths. JSON-only backup never claims to include the generated binary.

Production tab clicks now await existing atomic MIDI/AI workspace save before switching. Save failure, new edits during save, repository/session/route changes and active recording prevent navigation. Undo/Redo history stays in the shared session. The original lower-level navigation guards remain. The render disclosure stays open during asynchronous work; render and source controls use the same dark background, contrast and compact spacing as Export.

## Verification

Local final baseline: Node 2394/2394 PASS (0 skipped), Python pipeline 509 run / 504 PASS / existing 5 skipped; constraints 6, transport 3, startup 4 PASS. Final small cancel-button wiring additionally covered by targeted tests. All tracked JS syntax/Python compile and git diff whitespace checked.

Node scheduler tests check tempo, zero origin, capacity, bad notes, muted-only projects, missing sample and cancellation. Transaction-model tests check real WAV bytes, final Instrumental/Master output, source MIDI preservation, archive restore byte equality, conflicts, clipping, quota and cancellation. These tests use a modeled audio output for persistence; actual sound synthesis is separately checked by scripts/music-midi-render-browser.js.

The new real Chrome script traverses dirty MIDI -> AI save -> Export Render-Save using the actual OfflineAudioContext, project sample plus synth bass/drums, verifies nonzero unclipped PCM, independent IndexedDB reopen, Mix/Master/Instrumental/MIDI package, full archive audio hash equality at 1440/1180/820/390, and console/error/external request zero. Existing eight-stage browser checks remain. CI runs this script plus existing real ONNX/Sinsy and native suites. The normal Playwright download yielded invalid ZIP. A temporary MIT-licensed packaged Chromium was then installed outside the repository; actual local Chromium passed render/archive and eight-tab tests at all four widths. New render WAV is 441644 bytes / 110400 stereo frames; restored SHA-256 ac3f815be42c400cfc5a20f5518ed20b3de5448299e0d596b5a77a0e04850be6. Console error/warn and external requests zero. At 1180x820 the tested Export document is 820px tall. Local fonts lack Japanese glyphs, so visual Japanese font acceptance remains the CI Noto CJK/physical-device check. Local Swift/Xcode and actual model assets are absent; no local success claims for those checks. Final results belong to exact-head CI and PR description.

## Major feature grades and remaining work

A0/B0/C30 retained. The repository transcription docs/music-studio/COMPLETION_MASTER_PLAN_V1.md identifies the 30 feature names and original 2026-09-30 five-page specification; original PDF was not available for fresh verification. This increment improves No.1/2/4/7 MIDI-to-audio workflow, No.18/19/21 audio delivery and No.22/23/28 continuity. It does not complete every subrequirement of these major features. Existing nonphysical gaps include advanced long vocal editing/recording, AI conversational/arrangement quality, complete HTTPS reconnect/packaging and signature/notarization/distribution requirements. No evidence supports a B promotion. No claim of 20–30 independent completed items or 100% readiness.

## Physical acceptance steps

1. MIDI/AI: record or generate notes; edit; switch AI/MIDI/Mix. Verify save before switch, retained Undo/Redo and saved notes after reopen.
2. Export: open MIDI Audio; Render/Save; open Sources; select the new render and saved vocal, exclude stale renders; Preview; listen Before/After; Save and export ZIP/WAV/MIDI.
3. Mix/Master: choose the MIDI render as long WAV source; preview EQ/compression/master, adopt, Undo/Redo, reopen and listen.
4. Backup: Full WAV Archive -> fresh browser/profile -> reopen, edit MIDI, compare render/vocal bytes and synchronization.
5. iPad 1180x820 Safari: verify touch, tab save, internal scrolling and download destination. Intel Mac: verify actual MIDI device/audio/model engine and HTTPS reconnect. Physical acceptance remains pending.

Draft only. No main/existing PR changes, Ready, Merge, force push, deleted data, Live Provider API calls or unlicensed assets.
