# Music Studio AI workflow foundation

This independent foundation builds on Draft #269. It does not enable an external provider, change project schema, migrate saved songs, or load itself into the current UI.

It reuses the existing Partial Edit contract and guarded Editor commit path for explicit Track/range/note requests, immutable source snapshots, Preview, Apply, Reject, partial adoption, lock rejection and Undo/Redo. A local-only adapter boundary rejects URL, credential, fetch and network fields. The supplied deterministic adapter is test-only and performs no I/O.

The optional workspace carries provenance, decisions and A/B/C candidate sets for melody, chords, sections, arrangement, continuation and lyrics structure. Unsupported or stale workspace versions fail closed. New-song planning remains Preview-only until an explicit Confirm returns project input and empty MIDI data. It does not save or overwrite a project by itself.

No sales behavior, provider choice, automatic section adoption, musical-quality policy, chord inference, lyric generation, vocal generation or Nova Studio integration is decided here.
