# Music Studio linked candidate-family Preview — 2026-10-02 JST

This stacked Draft builds on #275 without changing #275, #274, earlier Drafts, main, saved songs, or real backups.

## Added
- One explicit **Family A/B/Cを生成** action creates Melody, Chord, Section, Arrangement, Continuation, and Lyrics Structure candidate sets from one shared deterministic musical context.
- **Family A / B / C Preview** groups the matching variant across all six candidate kinds by the existing candidateFamily ID.
- The family preview summarizes Section shape, Arrangement Tracks, Chord progression, Melody↔Chord review count, and Lyrics phrase-slot count.
- MIDI-capable family components are materialized only as existing non-mutating candidate previews; no family-wide Apply path is added.
- Missing family members are reported rather than invented.
- A family-ID mismatch is surfaced as an incomplete/mismatched preview rather than silently combining unrelated candidates.
- Canonical Melody is used for Melody/Continuation preview context even when another Track is selected.

## Safety
- local deterministic/synthetic only
- no provider, endpoint, credential, API key, fetch, or external network path
- Family Preview never commits MIDI
- no multi-Track atomic Apply is introduced in this unit
- actual edits still require the existing explicit candidate Apply path from #275
- exact partial-adoption, protected-range, stale-track, stale-range, Undo/Redo, save/reopen and migration rules remain unchanged

## Required CI
- node --test
- all JavaScript node --check
- git diff --check
- real Chrome 1440 / 820 / 390
- console warning/error/pageerror 0
- external request 0
- browser Family B Preview must leave MIDI byte-equivalent before later explicit candidate Apply
