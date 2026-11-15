# NOVA Logic instrument assistant — 2026-10-24 JST

Scope: formal No.5 / No.8 / No.20. No formal feature removed or renumbered. Formal completion is not certified.

## Implemented

- Project-local explicit registry: Logic internal vs AU, component FourCC identity, user-confirmed version, machine ID, installed assertion, confirmation date, Patch/channel strip/template/preset reference, family, role tags and pitch range. No prepopulated or presumed installed commercial product.
- Selected MIDI Track ID analysis, channel, note count, pitch/velocity range. Roles are read when present; unknown roles are displayed as unconfirmed rather than invented.
- Deterministic Japanese rule parsing (not an AI model or Live Provider call): warm piano, strings, acoustic bass, owned instruments, compare, return. Ranking uses only explicit registry tags/roles and full pitch-range compatibility. Up to three registered choices; no fabricated candidates.
- Preview creates immutable-proof-bound MIDI Velocity, timing and note-length plans. User-specified values only, no unsupported CC/keyswitch/parameter messages. Note locks retained; any saved measure lock blocks nonidentity expression edits conservatively.
- Explicit candidate approval writes only the selected Track's notes and project assignment metadata through existing guarded atomic project commit. Preview is invalidated by project changes or tampering. Original assignment and MIDI are retained in history; Undo refuses manual-edit conflicts. Source Logic project is never accessed.
- Adopted history includes instruction, recommendation comparison set, context, exact before/after notes and entry/version. Registry, assignment and history survive normalization, repository reopen and project backup restore.
- Logic handoff JSON includes IDs, names, channels, song settings, assignments, missing/version diagnostics and manual Patch/template steps. Unknown/new Mac does not substitute instruments.
- Logic page UI and native resource staging include the new module. Existing Type 1 MIDI Export writes the adopted MIDI; handoff JSON is a separate explicit download.
- Read-only Swift component enumeration source uses AudioComponentFindNext/GetDescription/CopyName/GetVersion. It does not instantiate plugins, enumerate internal presets, touch licenses, scan user files, or infer Logic validation. Intel compile/run workflow added.

## Important limits / unfinished requirements

This is a bounded local prototype, NOT automatic instrument assignment in Logic.

No real Logic standard piano Patch was available here. Synthetic tests demonstrate a user-confirmed registry record and MIDI path only, not Apple patch audibility or actual Logic application. No purchased or free third-party AU was installed/tested in Logic. Detection output is not directly imported as preset registry entries: a user must confirm Logic validation, presets, range, tags and machine information.

No AU plugin/UI or host control bridge is built. The helper is a read-only command-line inventory, not a Logic AU and not a shipping integrated helper. AU detection and factory preset enumeration are different capabilities. A future opt-in preset adapter must handle per-plugin limits outside real-time rendering. Keyswitch/CC dictionaries, automatic articulation optimization, audio A/B audition, native Logic Track identity binding, automatic assignment and Logic project-state restoration remain unimplemented. Track role inference and tonal/dynamic musical analysis beyond ranges/tags remain unfinished. BPM/Key are retained context but do not alter ranking. No universal proprietary preset-format parser is claimed.

Manual route: save a separate Logic project copy → import Music Studio Type 1 MIDI → verify Track names/channels/ranges against JSON → select each corresponding software-instrument Track → load the explicitly registered Patch/channel strip or use the saved template → audition and save as a new Logic project. Patch/template bytes are external references; Music Studio backup does not restore Logic's own project or plugin internal state.

Future Mix/Master: assignment records can expose role, instrument, preset, version and Track ID. Actual Logic-rendered audio, external control capabilities, effect parameter mappings and user approval require separate implementation/verification. Existing Mix/Master processing is unchanged.

## Sources (checked 2026-10-24 JST)

- Apple, Logic Pro 10.7 Plug-in Manager: https://support.apple.com/nl-nl/guide/logicpro/lgcp9e26ef17/10.7/mac/11.0 — internal Logic plugins and installed AU entries are distinct; Logic validates AU compatibility.
- Apple, Logic Pro 10.1 Patches overview: https://help.apple.com/logicpro/mac/10.1/en.lproj/lgcp2bc4b02f.html — patches contain instrument/effects/routing settings. Older official documentation is used for existing Intel-era workflow, not minimum version guarantees.
- Apple, Save custom patches: https://support.apple.com/en-mt/guide/logicpro/lgcpe0e71c76/mac — users save customized patches through Logic.
- Apple Audio Components: https://developer.apple.com/documentation/audiotoolbox/audio-components — component enumeration APIs.
- Apple AUAudioUnit.factoryPresets: https://developer.apple.com/documentation/audiotoolbox/auaudiounit/factorypresets — optional AU-owned preset collection, not all proprietary browser contents or host Track control.

The lack of an implemented/verified automatic host operation is an implementation limit, not a claim that every possible Apple integration is impossible.

## Verification

Core safety, Japanese intent and MIDI tests plus repository reopen/backup integration tests are in tests/music-logic-instruments.test.js and tests/music-studio-logic-pro.test.js. Browser acceptance script covers 1440/820/390 and 1180x820, explicit registration/approval, IndexedDB reload, backup, Undo, console warnings/errors and blocked external requests. GitHub jobs check exact PR HEAD; read final job results rather than treating workflow existence as success. Local browser launch failed due to absent Chromium; browser download returned an invalid ZIP. Local Swift/Apple SDK are unavailable. No physical Logic acceptance is claimed.

Physical Intel Mac checklist: run inventory without granting license access; compare Plug-in Manager; register a real standard piano Patch; approve MIDI plan; export and manually load Patch into a copy; confirm audible velocity/timing/length; repeat with owned AU and saved preset/template; verify same-plugin separate Tracks; rename/reorder/missing/version diagnostics; undo manual changes safely; reopen both applications and restore backups independently.
