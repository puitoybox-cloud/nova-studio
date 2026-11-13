# Vocal timeline WAV and selected score origin

2026-10-16 JST. Parent: PR #441, 7cf643437e26e185ed92322cdf7f3df27a332015. main: 552d56eafddfd192970c09f7d6278696cf8775c3; no change.

Production behavior:
- A newly imported score take anchors the selected PCM range to the explicit score-zero or first-note origin. Previously, trimStartSeconds was also added to playback placement, contradicting the import form. New score provenance retains trimOriginFrame. Existing saved takes without the field retain their former timing. No migration or deletion occurs.
- The same source origin feeds MIDI playback placement, lyric-note sample ranges, pitch/timing analysis, rendered Mix placement and timeline WAV export. Manual latency compensation is retained. Undo restores the complete original audio; Redo restores the selected range. The saved origin remains stable across later trimming.
- Timeline WAV is available in linked lyric takes and the Vocal editor. It prepends measured silence to the edited PCM so an external DAW can place the file at song time zero. It retains gain, trim, sample rate, channel count and the existing region renderer. The raw edited-WAV action remains available.
- Silence is assembled from bounded 64 KiB chunks and the rendered payload is retained as a Blob slice. Output is limited to 64 MiB including header before silence construction. A stale project, repository switch, pending edits or cancellation rejects output. Export does not mutate projects or original audio.
- Core cache is 1.4.172 in host and standalone, with corresponding version checks.

Verification:
- Full Node: 2360/2360 PASS, fail/skip 0. Focused score return: 17/17 PASS. Cache/entry regression: 56/56 PASS. Changed runtime/browser JavaScript syntax and git diff --check PASS.
- New tests verify a real nonzero PCM signal, exact leading silence and edited payload bytes, 0.475 s placement with a 100 ms trim and 25 ms compensation, lyric sample range, legacy timing, Undo/Redo, size limits, dirty-state rejection, invalid provenance and byte-identical full archive restoration.
- Browser script extends the existing four-size fixture (1440/820/390/1180x820) to download Timeline WAV and verify header, silence and size. Local Playwright package exists but the browser executable is absent. No local browser or physical acceptance PASS is claimed; exact-head CI must supply browser evidence.
- Start snapshot: all 188 Open PRs (186 Drafts), HEAD/base, mergeability, commit/change counts and exact-head workflows retrieved with no connector errors; conflicts #10/#35 retained. Latest saved checkpoint was #441. At this read its workflows were 5/6 SUCCESS, one in progress, no failure. Workflow state is time-dependent.

Unfinished:
Real neural composition inference; real Japanese singing engine execution; verified engine MusicXML compatibility and automated generation return; licensed installed model/voicebank/native runtime; whole-editor iPad one-screen acceptance; Intel Mac/iPad Safari/MIDI/microphone physical acceptance. Python torch/onnxruntime/tensorflow/nnsvs were absent. No model/voicebank introduced and no Live Provider API used. This increment does not complete 20–30 independent production items.

30-feature judgment: No.1–30 C (A0/B0/C30), conservatively carried forward from music-score-vocal-return-30-features-20261016.json. This is not a fresh comprehensive certification. No feature is promoted to B without evidence that only physical testing remains. Completion percentage and exhaustive residual count cannot be confirmed. Sources: code, test output and current GitHub snapshots dated 2026-10-16 JST.
