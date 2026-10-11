# Vocal correction, Comp and lyric synchronization — 2026-10-11 JST

Base: PR #401 / 5f9a0409271db30fa946a7095e339a9123afa3e2. Main: 552d56eafddfd192970c09f7d6278696cf8775c3.
Start audit re-fetched all 148 Open PRs, including every 146 Draft HEAD/base/mergeability, latest head commit and changed filenames, exact-head workflow lists; 22 historical failed job logs were retrieved separately. #401 remains the newest all-six-success checkpoint. No historical PR was altered.

## Connected production behaviors (29)

1. Decode authenticated saved vocal PCM for editing.
2. Detect monophonic F0 from actual PCM, with RMS/confidence and silence rejection.
3. Analyze a selected source range, with cooperative cancellation.
4. Create correction targets from the project major/minor Key.
5. Create correction targets from an explicitly selected monophonic MIDI track.
6. Offer bounded MIDI note-duration corrections.
7. Change actual audio pitch with phase-aligned overlapping grains.
8. Stretch actual audio independently of pitch.
9. Enter a manual region pitch correction.
10. Enter a manual region duration ratio.
11. Select/deselect individual correction candidates.
12. Audition Before and After audio before saving.
13. Adopt selected candidates or cancel the proposal without a project write.
14. Persist non-destructive region edits in the original take's history.
15. Undo/Redo corrections through the existing durable take history.
16. Render corrected WAV with the actual processed frame count.
17. Publish corrected audio into the existing Mix/Master asset path.
18. Select source waveform ranges using mouse/touch pointer capture and numeric fields.
19. Display note/lyric overlays on the original waveform and highlight the selection.
20. Display lyrics, notes and vocal source seconds through the project tempo map.
21. Select a source range by note ID.
22. Save track-qualified per-note lyric timing offsets, independent of MIDI/legacy assignment records.
23. Feed lyric offsets into note-target pitch/duration correction and waveform selection.
24. Add ordered ranges from multiple saved takes to a Comp recipe, including a snapshot of adopted audio edits.
25. Render actual boundary crossfades, with configurable 0–100 ms and stereo preservation.
26. Persist Comp recipe edits and Undo/Redo; remove selected parts without deleting source audio.
27. Audition a Comp and atomically save it as a new editable WAV take.
28. Reopen and Full WAV Archive/additive Restore retain source PCM, correction histories, track-qualified offsets, Comp recipes and rendered WAV bytes.
29. Optional punch end tick bounds one recording window through the existing capture/Stop/atomic save path. It is a new take placed at the selected start tick, not an in-place replacement or transport-scheduled punch-in.

## Limits and remaining software

This is deterministic local monophonic audio editing, not a licensed singing model or formant-preserving tuner. Grain processing can change timbre and create artifacts; human singing quality remains unverified. ±12 semitones and 0.5–2 duration ratio, 512 regions/candidates, 128 Comp ranges, 100 history states, 12,000,000 decoded/output samples and 125 seconds bound this editing path. Larger sources fail explicitly; original WAV is retained. Comp requires equal sample rate/channel count, resolves source hashes after additive identity remapping, and snapshots source corrections so subsequent source Undo cannot change the recipe. Crossfades overlap adjacent clips, reducing output duration by overlap frames.

MIDI duration proposals stretch detected voiced regions and shift following source material; full onset/phoneme landmark warping is not complete. Manual placement/latency and region duration are available. Lyrics overlays use source waveform coordinates; they do not claim automatic phoneme recognition or regenerate the original MIDI/assignment records. Chordal/drum or duplicate-note references are rejected. Automatic cycle recording, transport-scheduled punch-in/out, live monitoring/meters and measured device latency remain software work. Long voice quality/formant preservation, final batch/stem distribution, approved singing runtime/models/licenses and full native offline/restart/storage acceptance remain open.

The authoritative Music_Studio_最終機能仕様書_v1.pdf (confirmed 2026-09-30, Library file file_0000000031f08206a4e07311429c99b4) was retrieved and all five pages / 166 extracted lines reread on 2026-10-11 JST. No.12 includes monitoring, input checks, Punch/Cycle/Take/Comp and lyric scrolling; No.13 additionally requires Breath/Vibrato; No.15 requires guide-vocal/Take comparison and completion decision support. These complete feature scopes remain open despite this connected subset. The per-feature matrix names match the original PDF and retains inherited unresolved production/physical obligations for other features. No feature is promoted solely by this implementation or simulator checks. A0 / B0 / C30 remains the conservative current matrix; 100% completion is not claimed. Source specification is read-only and not copied into the public repository.

## Validation

New deterministic DSP tests check measured audio pitch, duration, unchanged out-of-range PCM, stereo seam steps, edited Comp snapshots, byte-identical reopen/archive/additive restore, persistent Undo/Redo, source retention, Key/MIDI proposals, tempo-map lyrics and duplicate note identity, cancellation, bounds, missing sources, quota failure and processed frame metadata. New Chrome UI scenario exercises candidate audition/partial adoption, actual PCM region save, note/lyric fields, pointer waveform ranges, Comp Undo/Redo/audition/save, close/reopen, WAV output and full archive identical recovery at 1440/820/390.

Exact-head evidence is reported in the Draft PR after Actions complete. Local Swift/Xcode/Chrome executables are unavailable; Swift/native/browser evidence must come from exact-head CI. Local Python: 504 PASS / 5 existing skips (509 discovered). A synthetic microphone and sine/constant PCM do not establish physical microphone or human singing acceptance.

## Physical Mac / iPad checks

Human voice pitch/timing/timbre and crossfade listening; Intel Mac microphone device selection, permission, audible MIDI/vocal alignment and real latency; iPad pointer/touch range selection and Japanese typography; WKWebView file-origin IndexedDB/audio capture, app suspension/process restart and storage pressure; real punch window timing under backgrounding. CI simulator/unsigned builds do not certify device installation or these behaviors.

Main, previous branches, existing user songs and backups are untouched. No Ready/Merge/Auto Merge/force push or live provider API.
