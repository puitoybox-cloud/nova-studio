# Local harmony MIDI and real mastering — 2026-10-11 JST

Source: `Music_Studio_最終機能仕様書_v1.pdf`, fixed 2026-09-30; all five pages read from current file on 2026-10-11. DSP source: ITU-R BS.1770-5 (11/2023), https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf, Annex 1 Tables 1/2 and gated 400ms measurement, Annex 2 four-phase FIR table, consulted 2026-10-11. This implementation is not a certified meter. 48kHz mono/stereo only; other rates reject, rather than misusing coefficients. Peak estimate includes zero-padded FIR tail. This is dynamics-preserving gain with measured peak constraint, not a limiter or multiband mastering chain.

Fresh start: main `552d56eafddfd192970c09f7d6278696cf8775c3`; 145 Open/143 Draft public enumeration and every Draft metadata/HEAD/base/mergeability, changed-file listing and exact-head workflow response fetched. No Draft conflicts. Base #398 at `0fc8657918b0c29b053f0a9beebf85b411b5dde1`, Draft/Open/mergeable, five exact-head workflows SUCCESS. Start evidence is in the accompanying JSON. Historical workflows are observed without reruns or edits.

## Delivered production behaviors

1. Project's existing Mix screen exposes real Harmony and Mastering controls.
2. The working Mastering home card opens the selected project's processing screen.
3. Harmony accepts one explicitly selected melodic MIDI Track.
4. First/last note numbers select only the intended source range.
5. Exact IDs, valid pitches/ticks and monophonic selection are validated; drum/overlap/duplicate-ID sources reject.
6. Explicit tonic plus major/natural-minor scale drives diatonic candidates.
7. Upper/lower thirds and fifths produce actual MIDI pitches.
8. Explicit MIDI voice range uses octave fitting and rejects impossible ranges.
9. Out-of-key source notes reject instead of guessing accidentals.
10. Source note timing/velocity/extensions stay preserved in generated notes.
11. Before/After harmony audition synthesizes local confirmation tones.
12. Explicit tempoMap changes alter actual audition timing.
13. Harmony adoption creates a separate editable MIDI Track with fresh note IDs.
14. Original melody and other Tracks remain unchanged; provenance is saved.
15. Harmony survives reopen, project JSON and additive Backup/Restore, and enters existing MIDI editor/export routes.
16. Master measurement applies exact two-stage 48kHz K-weighting to real PCM.
17. Integrated LUFS uses complete 400ms blocks, 75% overlap, absolute -70 and relative -10 LU gates.
18. Independent streamed chunks retain filter, FIR and gate state.
19. Short/silent audio reports unavailable loudness and cannot create a fake master.
20. Sample peak/clipping counts and Annex 2 four-phase true-peak estimate are measured independently.
21. FIR tail is measured; intersample overshoot is covered by an independent quarter-rate signal regression.
22. Explicit target LUFS and true-peak ceiling determine real gain candidates.
23. Peak constraints take priority over loudness target and the shortfall is shown.
24. Actual candidate audio is PCM16-encoded, decoded and remeasured before publication.
25. Before/After audition uses distinct actual source/result audio, with Stop and cancellation closing the context.
26. Adoption retains original audio and stores a new actual Master PCM asset with measured provenance.
27. Saved Master reopens, uses existing WAV download, project JSON and additive Backup/Restore with actual samples.
28. Atomic compare-and-put, dirty/recording guards, modified/stale candidate rejection, storage conflict and quota failure protect publication; failed save allows retry.
29. Cancellation invalidates processing/adoption; overlapping archive/publication is refused.
30. UI escapes imported identifiers/names, host/standalone cache versions are aligned, and new exact-head real Chrome production verification is wired into existing CI.

These are small behaviors within No.14/19/21/22/23/25. They are not 30 completed major features. Harmony is a deterministic local diatonic MIDI operation. Its sine-tone audition is not an AI singer. Single saved Master assets can use existing Gain/EQ/Compression workflows afterwards.

## AI vocal inspection and limits

Current production Python requirements list Demucs, Basic Pitch, mido, librosa, soundfile and numpy; source inspection shows stem extraction and audio-to-MIDI, not a singing-synthesis engine. No confirmed singing model, model bytes, license closure, phoneme front end or executable singing runtime was found. A usable AI vocal generation path cannot be verified. No invented model/provider, network call, fake synthesized lyric voice or successful-generation claim is introduced. Existing exact lyrics-note assignment remains intact; actual model inference/output retention/cancellation/retry is an open production requirement.

## Verification and formal major-feature status

Final results are recorded in the Draft PR after exact-head verification. Local Python: 509 run = 504 PASS / 5 existing skips. Final local full Node: 2088 PASS / 0 fail/skip; all 187 JavaScript syntax checks and git diff --check PASS. Thirty added focused regressions plus one home-route check include parameter retention and pending IndexedDB transaction cancellation. Independent reference tests include ITU's 997Hz calibration (-23.01 LKFS at amplitude 0.1), +3.0103 LU stereo, intersample peak, silence gates, arbitrary chunk boundaries, actual quantized output, preserved MIDI, quota/stale/dirty rejection and additive recovery. Existing tests are not removed/skipped/weakened; only cache expectations are updated.

Local Swift/Xcode absent. Local Playwright Chrome install failed; no local browser pass is claimed. Exact-head CI must verify real Chrome chooser/forms/audition/adoption/reload/additive recovery/WAV at 1440/820/390, empty console/external-request arrays, Swift and unsigned macOS/iPad Simulator builds. Japanese/touch and physical-device acceptance remains separate.

All formal major features **No.1–30 remain C**: A0 / B0 / C30. No item receives B simply from this subset or CI. A percentage and total software residual count cannot be verified from current requirement evidence.

Software before physical acceptance: actual singing model/runtime/assets/rights and lyric phonemes; harmony chord-aware voicing/audio double/chorus and integrated AI assistant natural-language edits; long-WAV/master multi-candidate selection and supported arbitrary-rate LUFS/true peak, meter conformance corpus, true-peak limiting and whole-song final mix; package/batch Master/Instrumental/Stem/MIDI export; full vocal recording/edit/comp/check path; models/runtime/licenses/independent native distribution and migration/update closure; Cloud Sync architecture and all-30 evidence mapping. Mastering is limited to current short PCM asset capacity, not long stored WAV mastering.

Mac acceptance: actual Keystation Stop/save/quit/relaunch/play/edit; native persistent store migration and app Cmd-Q/red close; Helper/signing/accuracy; Logic harmony MIDI and Master WAV round trip; Intel performance/real singing quality when runtime exists. iPad: picker permissions, touch/Japanese layout, stereo audition/routing, suspension/termination/reopen, quota. No saved user songs/backups, main, unrelated PR, Ready/Merge/Auto Merge/force push or Live Provider communication.

Initial exact-head browser run passed candidate creation/audition/adoption/reopen but its recovery lookup incorrectly required an unchanged project name; additive Restore intentionally appends （復元）. The harness now selects the newly created project identity and additionally asserts the original project is byte-for-byte unchanged. Production forms also retain actual selected range/key/targets on preview instead of resetting visible input values. Initial native CI passed; final-head native and UI results are reported separately in the Draft PR.

Screenshot QA found inherited white candidate-card backgrounds. The candidate section now reuses the existing dark settings-panel style; real Chrome checks minimum 4.5:1 heading/body/label contrast at all three widths. This is a scoped candidate-panel fix.
