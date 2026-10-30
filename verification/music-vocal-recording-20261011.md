# Vocal production capture and durable recovery — 2026-10-11 JST

Base checkpoint #400: f522db43e63858c2ae0d8043136af0985f309f26, Draft/Open/mergeable, exact-head five workflows SUCCESS freshly retrieved. Main 552d56eafddfd192970c09f7d6278696cf8775c3. All 147 Open/145 Draft enumerated; every Draft HEAD/base/mergeability/CI fetched, local matching commit objects read for latest commits/changed files. 21 failed historical exact-head job logs read, without changes/reruns.

This change implements a connected subset of No.12/13/18/19/22/23. Current residual ledger is the specification mapping available in this checkout; original PDF was not newly reread and no complete specification certification is claimed.

## Connected production behaviors (24)

1. Vocal-only Record controls in the saved project UI; no non-vocal recording added.
2. Explicit microphone permission request; rejection reports failure without writes.
3. Microphone device selection after enumeration; video capture excluded.
4. Pending permission cancellation releases a late-arriving stream.
5. Web Audio context unlock on the user's Record action.
6. Primary AudioWorklet mono PCM capture with 4096-frame transfers and final partial-block acknowledgement; silent graph output prevents microphone feedback.
7. Noncompressed PCM16 WAV for primary capture; explicit MediaRecorder fallback is compressed capture converted to WAV, and the capture format is displayed.
8. Recording status with elapsed PCM frames and observed clipping count.
9. Stop awaits flush, actual captured bytes, decode, WAV conversion, hashing and durable transaction.
10. One-take 120-second and 64-MiB encoded-byte boundaries; decoded duration/format/finite sample checks.
11. Mic disconnect and document suspension request Stop and save acquired samples; termination durability is not claimed.
12. All microphone tracks/context/resources released after completion or cancellation.
13. Source Blob and take metadata committed atomically in existing IndexedDB v6 stores.
14. Dirty editor/concurrent repository/changed project guards and compare-and-put conflicts protect existing songs.
15. Save/quota failure retains the decoded take in memory for Retry Save or explicit discard; no false save acknowledgement.
16. Native orderly close awaits Stop/save; unresolved permission or failed persistence prevents successful close acknowledgement.
17. Fresh repository/document reopen authenticates retained source bytes before use.
18. Recorded waveform, duration/rate/channels/capture format/clipping and separate take cards.
19. Non-destructive trim boundaries and gain edits saved as take history, leaving original bytes unchanged.
20. Undo/Redo persist and survive reopen and full recovery.
21. Explicit MIDI tick placement with project tempo-map conversion, trim offset and manual latency setting; shared Web Audio clock for recorded-vocal/MIDI playback. No auto latency measurement or live backing recording claimed.
22. Edited vocal WAV export, with clipping refusal rather than concealed clipping.
23. Edited WAV publication as a separate authenticated asset for existing Gain/EQ/Compression/Master workflows, preserving the original take and MIDI.
24. Full WAV Archive retains audio/take edits/waveform/provenance and additive Restore regenerates identical rendered bytes, preserving the existing song.

## Limits and outstanding software

120-second individual takes; no continuous multihour capture. PCM16 quantization is explicit; primary Worklet capture is noncompressed, but fallback MediaRecorder input can be lossy. Decoding a completed take and duet audition use whole-take PCM within the duration bound; capture transfers and long-WAV Mix use chunked processing. Backup audio uses Full WAV Archive; ordinary project JSON cannot be represented as a complete binary backup.

Retained failed-save take is memory-only until retry succeeds and is lost on forced process termination. Browser background Stop is best effort; actual OS suspension/kill, storage quota, device permissions and audio routing require device tests. Native microphone usage descriptions are present for both targets; main-frame/configured-origin microphone requests prompt via WebKit, cameras/untrusted frames denied. File-origin WebKit microphone/Worklet execution is not proven by build success.

Remaining software: live monitoring/input meters/punch/cycle/comp/lyric scroll; automatic latency calibration; full pitch/formant/timing/length/crossfade/breath/vibrato correction; synchronized lyric-note-waveform editor; AI singing runtime/model/vocoder/Japanese phonemes/rights closure; audio harmony/double/chorus; whole-song mix and multi/batch/stem final delivery; native file-origin production acceptance and complete standalone distribution/migration/model evidence. There is no claim that this patch completes all vocal requirements.

A0/B0/C30: No.1–30 remain C. B requires all software requirements closed with only physical acceptance remaining. Current all-feature ledger and vocal residuals do not support promotion or a completion percentage. See music-vocal-30-feature-status-20261011.json.

## Validation

Final exact-head test/CI/artifact results are recorded in the Draft PR. Local Node/Python, all JS syntax and whitespace checked. Swift/Xcode unavailable locally. Local Chrome installation failed (invalid downloaded ZIP); browser evidence must come from exact-head CI, not a local pass. Chromium synthetic microphone exercises the production UI/capture/Stop/save/document close/reopen/trim/Undo/Redo/playback/duet/full archive/additive restore/identical WAV/Mix publication at 1440/820/390; synthetic input is not a physical microphone test.

Physical: Intel Mac microphone permission/device/input quality, clipping/noise/latency, orderly app quit/relaunch, offline file-origin Worklet, real vocal/Logic WAV round trip and performance; M1 iPad Safari/native permission/routing/Japanese/touch/suspension/termination/reopen/quota. No Ready/Merge/Auto Merge/force push/main/user song/backup/unrelated PR edits or Live Provider calls.

Apple delegate reference (checked 2026-10-11): https://developer.apple.com/documentation/webkit/wkuidelegate/webview(_:requestmediacapturepermissionfor:initiatedbyframe:type:decisionhandler:)
