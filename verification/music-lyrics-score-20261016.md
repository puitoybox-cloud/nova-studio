# Saved Japanese lyric notes to a real MusicXML score

2026-10-16 JST. Based on #436 `9d7a6c65a7959313a66bc1fb9a163ee678843041`.

## Production behavior

The saved Lyrics / Notes assignment now has an Export score（歌声用MusicXML）download. Export only the selected saved assignment, preserving its absolute timeline (leading/inter-note rests), note pitch, exact durations, PPQ, tempo events including offsets inside measures, exact-tick meter changes, Japanese reading and melisma. Split bar-crossing notes with sounding and notation ties; truncated measures follow the existing A meter specification. Original projects, MIDI, workspace, recordings and backups are not modified.

Reject missing/duplicate/stale assignments, ambiguous tracks, drums, overlapping voices, malformed extension chains, invalid XML text, invalid tempo/PPQ, unsupported MusicXML octave -1, unsaved editing and active MIDI recording. Limit 4096 notes and 512 measures. No automatic phoneme inference. Key signatures/velocity are not included (absolute pitch is preserved). Generic MusicXML 4.0 output is not a claim of tested NEUTRINO or other engine interoperability.

The production #436 imported MIDI -> candidate Preview -> Apply -> Save -> Japanese lyric assignment -> Save -> MusicXML -> complete backup Restore path is executable in Node; restored score and original candidate workspace remain equal. A browser fixture exercises normal controls, actual download and DOM XML parsing plus IndexedDB/reload and full restore at 1440/820/390/1180x820; execution results must be checked in exact-head CI before calling them PASS. No all-editor one-screen or physical Safari acceptance is claimed.

## Sources and specification

Current Library `Music_Studio_最終機能仕様書_v1.pdf`, fixed 2026-09-30, re-read 2026-10-16 (5 pages / 166 lines). No feature excluded by that specification is added.

- W3C MusicXML 4.0, read 2026-10-16: https://www.w3.org/2021/06/musicxml40/tutorial/midi-compatible-part/ and https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/lyric/ . Exact durations, rests, ties, lyric text and extension elements follow these primary sources. A generated Japanese/melisma/rest score passed the official v4.0 XSD from https://github.com/w3c/musicxml/tree/v4.0/schema using lxml (schema imports resolved locally, no network during validation). The downloaded XSD is verification-only, not bundled into the app.
- NEUTRINO official MusicXML guide, read 2026-10-16: https://studio-neutrino.com/articles/neutrino-cli-musicxml/ . This documents a real score-input workflow. We export a score; we have not run that engine.
- NEUTRINO FAQ, read 2026-10-16: https://studio-neutrino.com/faq/ . Engine integration and bundled audio require separate consideration from normal music use. No NEUTRINO binary/model/voicebank is introduced here.
- Magenta checkpoints: https://github.com/magenta/magenta-js/blob/master/music/checkpoints/README.md . NNSVS: https://nnsvs.github.io/notebooks/Demos.html . No inference success, weight compatibility or production voice license is inferred from source-code availability.

## Starting GitHub evidence

Re-fetched main, all 183 Open PRs (181 Draft), each HEAD/base/mergeability, latest commit, changed filenames and exact-head workflow runs. Latest saved checkpoint remains #436; main `552d56eafddfd192970c09f7d6278696cf8775c3`. #436 two exact-head workflows completed SUCCESS. Full metadata summary: `music-lyrics-score-start-20261016.json`. Existing competing branches remain untouched.

## Verification and limits

Initial full local run exposed stale literal cache assertions and the host loader's old required version. Synchronized those checks and the host ASSET_VERSION predicate with the new production script. Focused score tests and MIDI-to-score end-to-end test pass; final totals and exact-head CI are recorded in the PR after completion. Local Chrome absent; Playwright download failed with truncated/non-ZIP bytes. Browser acceptance is delegated to the repository's existing CI, without substituting a simulated DOM for Chrome.

No Python torch / onnxruntime / tensorflow / nnsvs installation or model/voicebank weights found. Actual neural composition, Japanese synthesized singing, licensed production runtime/voicebank and physical Intel/iPad/microphone acceptance remain incomplete. Score export is a usable handoff feature, not synthesized singing. No fabricated voice/audio/model result is added. The target of 20–30 independently completed production items is not met in this change.

Formal No.1–30 remain C, A0/B0/C30, conservatively carried forward; this is not a new complete certification of all features. Completion percentage cannot be confirmed. No main/parent write, force push, Ready/Merge/Auto Merge, user-data deletion or Live Provider API calls.
