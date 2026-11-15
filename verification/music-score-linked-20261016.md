# Score-linked vocal production continuation

2026-10-16 JST. Parent #439, exact parent 3a57c15fe7a3b0ab39751b0cc22c24e14f8cb6dd. Main 552d56eafddfd192970c09f7d6278696cf8775c3 was read again and left unchanged.

Production changes:
- MusicXML tick-zero tempo now uses the project BPM, matching existing vocal timing and MIDI accompaniment playback. Stale MIDI tempo metadata no longer exports a different initial speed. Later tempo events retain their exact ticks.
- Score-return controls show first-note and last-note-end times using the same playback timeline.
- Saved lyric assignments list only their own imported vocal takes, matched by record and track IDs. Exact exported score snapshots distinguish current and previous scores after tempo, lyrics or MIDI changes.
- Each linked take offers MIDI-synchronized audition and direct selection/opening in the vocal editor. Selection uses the existing atomic, revision-checked persistent workspace operation.
- An explicit optional checkbox opens the vocal editor after successful WAV import. Failed imports retain their current workflow. Download/status repaint preserves this choice alongside the actual file node and origin selection.
- Host and standalone cache version updated to 1.4.170; existing version-contract checks updated.

Verification: focused score/import/touch suite 29/29 PASS, cache/host/import contract suite 70/70 PASS. Full-suite first run 2347/2351 PASS; four failures were old hard-coded cache versions, corrected before final full rerun. Syntax checks and git diff --check PASS. Native web staging copied 156 assets; this is not a native build. Local browser launch failed because the Chromium executable is absent; no local browser pass is claimed. Existing exact-head CI browser fixture now opens the specific linked take with a normal button click at 1440/820/390/1180 by 820, with full binary archive equality and console/network assertions. Exact-head CI must be checked separately.

Start audit: all 186 Open PRs, including 184 Drafts, were re-read with current HEAD/base, mergeability, changed-file counts and exact-head workflow results; errors 0, existing conflicts #10/#35. #439 remains Draft/Open/mergeable. Its exact head has 9 successful check jobs and skipped unrelated jobs; workflow and check-job counts are distinct. Latest commit and changed filenames were read through GitHub.

Unfinished: real Japanese singing-engine invocation and validated MusicXML engine compatibility; automatic synthesis/return; approved installed model/voicebank/native runtime; real neural composition; all-editor one-screen acceptance and physical Intel Mac/iPad Safari/MIDI/microphone acceptance. Runtime probe found torch/onnxruntime/tensorflow/nnsvs absent. No voicebank/model was downloaded or invented; no Live Provider API request occurred. This change does not implement 20–30 independent production functions and does not reach the only-physical-acceptance-remains milestone.

Formal 30-feature status: inherited parent ledger No.1–30 C, A0/B0/C30. This is a conservative carry-forward, not a new full specification audit. No feature is promoted to B without evidence that physical acceptance alone remains. Completion percentage and exhaustive remaining-item count cannot be confirmed.

Sources: repository runtime music-studio.js; tests/music-studio-score-vocal-return.test.js; scripts/music-score-vocal-return-browser.js; existing verification/music-score-vocal-return-30-features-20261016.json; GitHub start snapshot in music-score-linked-start-20261016.json. All inspected 2026-10-16 JST.
