# Score vocal WAV preflight and atomic initial edits

2026-10-16 JST. Parent PR #440 / 362bbdf817f30eccfb2852e16872e0b4d97ff71e. Main read from origin: 552d56eafddfd192970c09f7d6278696cf8775c3; unchanged.

Production changes:
- Saved lyric assignments offer WAV preflight without writing a project or binary asset. It decodes actual selected PCM and reports duration, sample rate, channels, full-scale frames, exact all-zero silence, selected duration and shortfall against the exported score timeline. These values do not establish engine identity, correct pronunciation or musical quality.
- Import accepts explicit trim start/end in seconds, gain and manual latency correction. The trimmed range begins at the explicitly chosen score origin. Default behavior remains unchanged. Invalid bounds reject before a storage commit.
- Initial editing and the immutable original WAV commit together in the existing revision-checked IndexedDB transaction. Original audio is retained. Changed settings create a second history entry so Undo returns to the complete original take and Redo reapplies the import choices.
- Import controls survive download/status repaints. Editing inputs invalidates the displayed preflight report; changing input, project or detaching the form during decoding rejects stale results.
- Linked takes expose the existing actual-PCM render-to-Mix action directly, retaining source audio and timeline placement.
- Advanced settings are collapsed by default, with Japanese/English labels. Core asset cache updated to 1.4.171 in host and standalone.

Validation: focused score return tests 13/13 PASS, including actual binary archive restoration, initial edit Undo/Redo, invalid edits, stale preflight and Mix-render byte equality. Full Node 2356/2356 PASS, fail/skip 0; changed-JS syntax and base-to-working-tree diff checks PASS. Browser fixture updated to exercise the visible preflight button, retained gain control and actual imported edit at 1440/820/390/1180x820. Local browser executable is absent; browser installation failed with an invalid ZIP download. No local browser or physical-device PASS is claimed. Native web staging is packaging only, not native build acceptance.

Start audit: 187 open PRs / 185 Drafts, each HEAD/base/mergeability/commit count/change count and exact-head workflow run results re-read with zero connector errors. Existing conflicts #10 and #35 remain. Newest checkpoint was #440. Snapshot: music-vocal-import-edit-start-20261016.json.

Unfinished: real Japanese singing-engine invocation, tested engine MusicXML compatibility, automatic engine output return, approved model/voicebank/runtime installation, neural AI composition inference, all-editor iPad one-screen acceptance, and physical Intel Mac/iPad Safari/MIDI/microphone acceptance. Local Python probe found torch, onnxruntime, tensorflow and nnsvs absent. No model/voicebank was introduced and no Live Provider API was called. This increment does not complete 20–30 independent production features.

30-feature judgment: No.1–30 C, A0/B0/C30, conservatively inherited from music-score-vocal-return-30-features-20261016.json. The prior ledger is not a new full-feature certification or proof that all existing features are broken. No feature is promoted to B without evidence that only physical acceptance remains. Exact remaining-item count and completion percentage cannot be confirmed. The actual-engine and model prerequisites remain before the requested fully prepared physical-test milestone.

Sources: music-studio.js, tests/music-studio-score-vocal-return.test.js, scripts/music-score-vocal-return-browser.js and GitHub snapshots, inspected 2026-10-16 JST. Existing PRs, main, data and prior runtime paths retained; no Ready/Merge/Auto Merge/force push.
