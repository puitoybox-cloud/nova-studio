# Candidate audition — 2026-10-16 JST

Base: PR #430 `7fc43cb97dad2cf71457248424d548108c87feea`.
Fresh main: `552d56eafddfd192970c09f7d6278696cf8775c3`.
All 175 prior Open Draft HEAD/base/mergeability, latest commits, changed filenames and exact-head workflow lists were fetched. No newer saved checkpoint found. Old PRs and main are unchanged. See start JSON. REST rate limits during an initial supplementary read were resolved using connector reads; the final snapshot uses these complete results.

## Production changes

- A/B/C MIDI Preview now offers Listen and Stop, using the current Track's actual sample/multisample sound.
- Audition applies the exact candidate to a disposable session through the existing adoption checks; live MIDI, selection and Undo are unchanged.
- Partial range audition uses the adoption range and clips playback at its exact boundaries. Tempo maps and sample bindings pass through the actual scheduler.
- Stale note/range/instrument/source and locked candidate checks are reused from adoption. Missing or unmapped samples stop the audition and report failure.
- A separate Web Audio synth isolates audition resources. Stop, normal transport, replacement audition, Preview/Apply/Cancel/Reject and tab changes release it.
- Pending audio unlock is cancelled after Stop, edits, project/session changes or recording starts. MIDI and vocal busy states refuse audition.
- Bounded audition: at most 4096 notes and 120 seconds; users select a shorter range when exceeding these limits.
- Continuation now honors low/mid/high register for both generated additions and changes to existing notes. Previously its materializer hard-coded mid despite the saved recipe.
- Standalone and host cache versions advance together; compact bilingual controls stay inside existing candidate cards.

These are scoped working improvements, not 20–30 independent completed production features. No model inference or singing synthesis was fabricated.

## Validation

- Node: 2304/2304 PASS, 0 failures/skips (includes 9 new tests).
- All tracked JavaScript plus the new test: syntax PASS. Base diff whitespace PASS.
- Python Helper suite: 509 run, 504 PASS / 5 existing dependency-unavailable skips.
- Local Chrome absent. Browser installation failed in this environment. No local browser PASS claim.
- Existing multisample browser fixture now exercises real Listen -> scheduled sample notes -> Stop -> Apply equality at 1440/820/390/1180×820, preserving original MIDI before adoption and existing IndexedDB/backup restore checks. Await exact-head CI for actual browser results.
- Browser fixtures block external requests and assert zero console errors/warnings/pageerrors. Physical iPad Safari, Intel/MIDI and microphone remain unverified.

## Remaining and 30 major features

Model composition runtime/weights, Japanese singing runtime/voicebank, verified licenses and a complete distributed sound pack remain unavailable in the inspected production implementation. This change adds no third-party model/material/dependency and makes no license or runtime-ready claim. Existing source/package inventory documents do not establish actual model inference.

Conservatively retain the specification mapping in `verification/music-multisample-30-features-20261016.json`: No.1–30 C; A0/B0/C30. This scoped change does not certify the whole 30-feature specification. B requires only physical acceptance remaining, which has not been established for any complete major feature. Completion percentage cannot be confirmed.

Saved recipe/candidate/Track/PCM compatibility and PR #427–#430 regression tests are retained. No main mutation, force push, Ready, Merge, Auto Merge or Live Provider API request.
