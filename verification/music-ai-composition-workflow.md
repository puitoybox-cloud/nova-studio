# Music Studio local composition candidates — 2026-10-02 JST

This stacked Draft builds on #271 without changing #271, main, saved songs, or backups.

It replaces the placeholder A/B/C metadata fixtures with a deterministic local-only composition service. Candidate sets remain previews and do not directly write MIDI. The service derives the active key from the exact selected range's MIDI key-signature event when available, otherwise from project key metadata, and falls back to C major without rewriting the project.

Covered candidate kinds:
- Melody: contour, scale degrees, rhythm density, register and motif length.
- Chord: key-aware progression, scale degrees and harmonic rhythm.
- Section: structural shape metadata.
- Arrangement: track roles, register, density, dynamics and entry bar.
- Continuation: motif reuse/variation and cadence metadata.
- Lyrics structure: section, line/syllable/stress policy linked to Melody A/B/C.

No external provider, endpoint, credential or network call exists in this unit. Existing #271 Preview/Apply/Reject/partial-adoption and persistence paths remain the only adoption mechanism.
