# Music Studio multisample production — 2026-10-16 JST

Parent: PR #428 b488548d6e8a24d85aa503f8f8e6d30f71abc8bc. Main 552d56eafddfd192970c09f7d6278696cf8775c3. All 175 Open Draft HEAD/base/mergeability, latest commit metadata, changed paths and exact-head check runs re-read. Latest saved checkpoint was #428; eight active jobs / six workflows SUCCESS. Old conflicts #10/#35 untouched. Local uncommitted #428 tree preserved in the old working directory; this change uses a separate worktree from the saved immutable HEAD.

## Resulting behavior

A Track can use a validated v2 instrument containing up to 32 sample regions. Existing single-sample bindings retain their identity and behavior. Each region selects an original saved PCM asset and maps MIDI key/velocity ranges; overlapping matches use the nearest declared root, with stable order for ties. Root pitch, gain, fine tuning, trim, attack/release and one-shot mode reach real Web Audio BufferSource scheduling. Stop and all-notes-off clean up one-shot MIDI voices even after note-off. Unmapped, missing and naturally ended notes remain distinguishable. Sources are still short user-imported PCM, not a supplied acoustic sample pack.

Sound remains inside the existing MIDI input popup. Add/edit/remove a region (retaining all source PCM), audition/stop, save as a new named preset, reuse a preset, rename a source, inspect usage/missing dependencies, or open Mix after saving MIDI to import another WAV. Preset publication and source rename use compare-and-put with repository/project/editor guards. No source deletion or destructive overwrite. Presets are new snapshots; raw PCM/history remains unchanged.

Sample preparation follows project identity and avoids rebuilding the sample bank on repeated MIDI messages for one immutable saved project. Normal MIDI save/reopen and JSON backup restore retain the region definitions, preset snapshots and PCM. The new shared runtime is loaded before Editor in both host and standalone; native staging includes tracked root JS automatically and is checked.

The existing deterministic local composition candidate materializer now fits octave and velocity into an explicitly selected v2 instrument, retains pitch class/timing/identity, displays the adjustment in Preview and rejects Apply after the instrument changes. It does not perform model-backed composition or vocal synthesis. No approved composition/vocal model/runtime is supplied by this change; no provider chosen or contacted.

## Evidence and limits

Eleven dedicated Node regressions pass: backward compatibility, malformed zones, actual BufferSource rates/gain/trim/envelopes, one-shot cleanup, missing/unmapped/ended distinction, save/preset/reopen/restore, storage quota/concurrency, local candidate fit/staleness, project switching/cache, safe imported names/IDs and old long source identities. Related Node/source-stage tests passed. Full repository and exact-head CI results are recorded in the PR once complete.

Local Chrome unavailable; attempted download failed. Actual browser controls at 1440/820/390/1180, multi-region edits, Undo/Redo, preset selection, IndexedDB save, sample scheduling, complete inline PCM restore, scrolling and console/network checks are added to the existing CI. Pending at initial publication. Browser fixtures do not certify physical iPad/Safari, Intel/Keystation, microphone timing, sample-pack musical quality or installed native/model runtime acceptance.

Formal specification re-read from current Library Music_Studio_最終機能仕様書_v1.pdf (2026-09-30), all five pages / 166 lines, on 2026-10-16 JST. No.1–30 remain C (A0/B0/C30). Full production generation, the final instrument library, native distribution/runtime and physical acceptance remain incomplete. No completion percentage is asserted. Sub-controls here are not counted as independent completed major features, and 20–30 fully independent production work items are not claimed.

No main/old PR modification, force push, Ready/Merge/Auto Merge, Live Provider API calls, original-data deletion or non-vocal raw recording.
