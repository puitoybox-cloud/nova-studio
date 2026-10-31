# Music Studio guarded candidate Preview / Apply — 2026-10-02 JST

This stacked Draft builds on #272 and keeps main, #271, #272, saved songs and real backups unchanged.

## Added behavior
- Melody A/B/C candidates can be materialized into a real Partial Edit Preview without changing MIDI.
- Empty Melody ranges generate deterministic local note proposals; existing editable notes receive pitch-only proposals while locked notes stay excluded.
- Chord candidates materialize as Bass root-motion previews on the existing Bass track and carry a companion arrangement plan.
- Continuation candidates materialize as local melodic continuation previews.
- Section / Arrangement / Lyrics Structure remain metadata-only previews.
- Lyrics Structure explicitly links A/B/C to the corresponding Melody candidate and creates phrase-slot metadata.
- Exact measure partial adoption narrows candidate Apply while retaining the original guarded Partial Edit request.
- Apply goes through MusicStudioEditor.applyPartialEditPreview, so existing lock/range/stale transaction checks remain authoritative.
- Undo remains the existing Editor Undo path.

## Safety
- no provider, endpoint, credential or fetch path
- Preview is non-mutating
- protected ranges fail closed on Apply
- existing saved projects are not migrated
- no main/Ready/Merge/Auto Merge/force push
- no production songs or real backups used by automated tests

## Required verification
- node --test
- all JavaScript node --check
- git diff --check
- real Chrome 1440 / 820 / 390
- console error/warn/pageerror 0
- external requests 0
- real browser chord B candidate: Preview leaves Bass unchanged, partial Apply writes only through guarded Editor path, save preserves AI adoption and MIDI
