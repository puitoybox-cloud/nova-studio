# Logic instrument handoff continuation — 2026-10-24 JST

Base: PR #500, 99d394ba382a3a145e3ba3d4e643e4aab841c7a4. Main observed: 552d56eafddfd192970c09f7d6278696cf8775c3. Latest open PR search returned #500, #499, #498; #500 remains Draft. Existing registry, expression planner, approval, repository and backup paths are reused. No formal feature added or removed; No.5/8/20 partial progress only, No.18/19 not completed.

## Connected implementation

1. Logic page exports one ZIP using the existing bounded ZIP writer.
2. Actual Type 1 approved-song.mid uses the existing MIDI writer and inspector.
3. Independent Track MIDI files retain their original start ticks (no shift to first note).
4. Tempo and meter maps use the existing writer's validated path.
5. Track IDs remain unchanged in the manifest.
6. Duplicate Track names do not determine identity.
7. File tokens are numeric and safe even for Unicode/path-like Track IDs.
8. MIDI channels, ranges, roles and velocity ranges remain in the manifest.
9. Muted Tracks stay in the manifest with no individual MIDI file.
10. Empty Tracks remain metadata-only.
11. Unassigned Tracks are marked explicitly; no substitute is chosen.
12. Adopted instrument, version, preset and reference are recorded per Track.
13. Manual Patch/channel strip/template/preset instructions are generated per Track.
14. README and manifest distinguish Music Studio backups from Logic project and Patch bytes.
15. Full original MIDI snapshot (including original Program values) is in JSON.
16. GM Program Change is intentionally suppressed in handoff MIDI: it is not a Logic Patch selector.
17. Registry and adopted comparison/history records accompany the MIDI.
18. Same approved MIDI is identified for manual A/B/C sound comparison, with volume-matching guidance.
19. Expected per-Track Logic WAV filenames establish a proposed future audio correspondence, not an actual rendered asset binding.
20. Export rejects source changes while the ZIP is being built.
21. Purchased-only selection requires the explicit purchased:true registry assertion; older records default false.
22. Soft-string tags, A/B/C comparison and previous-settings Japanese intents are recognized.
23. All-Track request uses confirmed assignment family or explicit family role/part, never guesses piano from a melody/name.
24. Unknown families and missing compatible instruments are listed without changes.
25. Multi-Track preview shows each selected preset before explicit approval.
26. Batch approval is guarded against stale source and tampering; expression remains unchanged.
27. Batch Undo restores the whole adopted batch and rejects manual conflicts without partial writes.
28. Locked Tracks reject assignment plans; existing note/measure expression safeguards remain.
29. Optional componentVersion records the raw AudioComponentGetVersion value separately from human product version.
30. Read-only Intel inventory JSON upload checks FourCC identity, absence, ambiguity, raw version, unknown version and machine mismatch.
31. Inventory does not register a product, assert Logic validation or infer presets.
32. Logic internal instruments explicitly return logic-internal-not-enumerated.
33. Assignment audit reports changed preset/reference/component identity as well as missing/version mismatch.
34. Existing project persistence/reopen/backup paths retain the extended registry and assignment history.
35. Browser CI now exercises ZIP download, actual SMF entries, manifest binding, batch approval, Undo and existing independent restore across all four viewports.

## Verification and limits

Local focused Node: 159/159 PASS after batch Undo changes. Python audio-pipeline suite: 512 run, 507 PASS, 5 SKIP; existing ResourceWarnings observed. Full Node and all tracked JS syntax are run separately; exact-head CI must be read from the new PR. Local Chromium absent; attempted download failed. Local viewport/Console pass is not claimed. Existing CI covers Chrome 1440/820/390 and 1180x820; the read-only Intel helper is compiled there. No Swift/Apple SDK or Logic is available locally. No AU plugin was added; therefore an AU plugin build/host acceptance is not claimed. The existing inventory executable is not an AU.

Remaining: real Logic standard piano Patch registration, Patch/channel strip/template load and audible playback; a genuinely owned or authorized free AU on Intel; Logic project save/reopen; raw inventory-to-Logic validation; per-plugin CC/keyswitch dictionaries; host parameter adapters; actual Logic Track binding and rendered WAV identity import. No real Apple preset name is fabricated, no commercial ownership presumed. Registration requires the user's real confirmed values; a factory piano preset is not preseeded.

Japanese routing is deterministic, not a language model. '全部' uses a conservative explicit-family subset; it may leave all Tracks unchanged where families are unknown. A/B/C request displays the comparison limitation and the user can preview up to three registry candidates; it does not audition audio. Pending, unadopted candidate persistence and independent reusable cross-song assignment templates remain open. Actual preset bytes, licenses, proprietary settings and Logic projects are external, not backed up in the ZIP. The existing MIDI writer's supported subset applies; JSON preserves the source, but this is not a universal lossless SMF event export. No unsupported CC or keyswitch is generated. Batch Undo is one group; single-track Undo retains prior behavior.

## Apple primary sources checked 2026-10-24 JST

- Logic 10.7 patches overview: https://support.apple.com/en-ie/guide/logicpro/lgcp2bc4b02f/10.7/mac/11.0 — software-instrument patches contain instruments and effects, not just MIDI. Intel-era documentation is not a claim about every current Logic version.
- Channel strip settings: https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcp35966da6.html — loading/saving channel strips is a host workflow. No arbitrary remote Track API is inferred.
- Save custom patches: https://support.apple.com/en-mt/guide/logicpro/lgcpe0e71c76/mac — manual save through Logic.
- AUAudioUnit.parameterTree: https://developer.apple.com/documentation/audiotoolbox/auaudiounit/parametertree — a host can discover a unit's exposed parameters; this does not establish sibling Track control from an AU.
- AUAudioUnit.fullState: https://developer.apple.com/documentation/audiotoolbox/auaudiounit/fullstate — host save/restore of an AU state, not an interface for editing Logic projects.
- MIDI CC events: https://support.apple.com/el-cy/guide/logicpro/lgcp2158ecea/10.7/mac/11.0 — controller information reaches instruments; no proprietary preset selection is inferred.

Smart Controls/Controller Assignments require an explicit Logic-side mapping and per-plugin verification; this change does not create them. No GUI automation, Accessibility permission request, license operation, purchase, plugin installation, signing identity usage, Live Provider request, Ready, merge or force push.

## Physical Intel acceptance before completion

Save a copy of Logic project; use a real registered piano Patch; export ZIP; match each token/ID/channel/range to a software-instrument Track manually; import regions at the original song start; load the exact saved reference; confirm audible notes/velocity/timing/length; keep same MIDI and processing conditions for candidate comparison; match loudness and save actual WAVs; repeat with owned AU and independent same-plugin Tracks; stop on missing/version/preset mismatch; save/reopen Logic separately; restore Music Studio to independent storage and compare metadata. Record Logic/macOS/plugin versions and evidence WAV hashes. None of these physical steps is certified by synthetic tests or CI.
