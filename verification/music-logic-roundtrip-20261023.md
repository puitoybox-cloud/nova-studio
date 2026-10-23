# Music production checkpoint — 2026-10-23 JST

Base: PR #494, e89e8f62c3253f6ede77f8db650cb024a51b838c. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3.

Production changes:
- Logic return UI accepts multiple WAVs with explicit stable MIDI track selection. No filename inference. One batch supports 1–32 unique tracks; frame count, rate, channels, encoding and bit depth must match. All files start at zero (export from song start in Logic).
- Bounded streaming decode and SHA256 precede one strict durable atomic fork containing all metadata and binaries. Source revision, MIDI, AI workspaces, history and original audio are preserved. Capacity/cancel/missing dependencies/concurrent edits/corrupt inputs fail safely.
- Returned asset `midiRender.trackIds`/`stemTrackId` feed existing final-package correspondence. Per-file return history includes batch, stable track ID/name/part, source revision and PCM format. Full archive remaps asset IDs without altering MIDI identities.
- Short new-song ONNX range processing previously used absolute zero as its stop/crop origin, so a model-generated leading silence beyond one bar could stop before any audible note survived cropping. For <=1920 ticks only, range now anchors to the first actual sampled note and postprocessing explicitly rebases that leading silence. No notes are invented. Source-conditioned and longer-range behavior are unchanged. Actual generated token rows/seed per attempt are recorded. Bounded three-attempt sampling remains.

Validation at initial commit: multi-Stem focused regressions 8/8 pass, generation-budget 7/7 and audible-sampling 4/4 pass. Full Node and exact-head CI pending. The first test draft incorrectly supplied 8kHz / 0.1-second PCM to final mastering; production correctly rejected those fixtures. Corrected regression supplies 48kHz / 1-second PCM and succeeds; no production guard weakened.

Original specification `Music_Studio_最終機能仕様書_v1.pdf` (2026-09-30, Library ID libfile_fea4127fde5c81919fee8296d5c7647d) read in full, all 5 pages/166 lines on 2026-10-23 JST. All 30 required-content entries compared with the inherited ledger; A0/B0/C30 retained. Remaining full-function requirements are listed in music-logic-roundtrip-30-features-20261023.json. No completion percentage or physical acceptance inferred.

Still open: full product-level update/crash migration acceptance; Logic application operation and physical hardware acceptance; automatic matching across changed MIDI identities; end-to-end returned Stem native lifecycle acceptance; source/license closure for GCC/LGPL dependencies, Developer ID/Hardened Runtime/notarization/stapling. No credentials used and internal package is not sale/publication eligible. Logic remains optional.

Main/old PRs protected; Draft only. No Ready/Merge, force push, Live Provider, new models/sounds, demo songs or original-data deletion.

Follow-up acceptance: native CI now renders two actual existing-fixture instrument parts, exports timeline-aligned Stems, atomically returns the mapped batch, backs it up to a third independent WebKit store, re-exports, fully quits, reopens, edits and saves again. Six app launches; result pending. Short-range real inference also parses, edits, saves and reopens every returned A/B/C MIDI for each 1/2/4-bar new/source request. Local full Node 2581/2581 PASS; Python local 79 run / 3 failures / 3 errors (OS subprocess cleanup), not PASS. CI platforms remain authoritative for package/native acceptance.

Restore correspondence repair: archive restore now preallocates a complete old-to-new project identity map and rebinds Logic sourceProjectId alongside assetId, including retained version snapshots. originalSourceProjectId preserves immutable original provenance across repeated independent restores. A two-generation archive regression verifies that every restored source pointer resolves in its destination while original IDs and MIDI track identities remain.
