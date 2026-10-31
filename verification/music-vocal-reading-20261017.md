# Japanese reading and measure-scoped singing — 2026-10-17 JST

Base #447 b1435718371b5232bf428498014c4cafc2524567; main 552d56eafddfd192970c09f7d6278696cf8775c3. All 192 open Draft metadata, HEAD/base, conflicts, latest commits and same-HEAD workflows retrieved. Snapshot in music-vocal-reading-start-20261017.json. Bulk retrieval completed after initial edits, not before. Parent workflows finally 3/3 success.

Production changes:
- Preview table edits each note's reading directly, including multiple kana and ~ continuation. Validates the complete mapping, first-syllable rule and current project snapshot before changing preview. Explicit Apply/Save uses the existing durable assignment path; MIDI is unchanged by reading edits.
- Kana splitter normalizes half-width/decomposed kana. Sinsy request normalizes katakana to hiragana on an isolated copy and rejects unresolved kanji/Latin readings before dispatch. No guessed kanji readings, accent prediction, or new model.
- Saved assignment UI selects first/last measure and generates a separate take containing only fully selected lyric notes. Absolute score ticks, leading rests, meter and tempo are preserved. Empty ranges, cut notes, cut multi-note syllables and stale full bindings reject before generation. Existing full-record generation remains available.
- Generated WAV uses existing score-zero import and retains original takes. Its source retains selected measure range, exact normalized MusicXML, engine and voice. Existing take edit, selection, mix publishing and complete audio archive remain available. This is not in-place replacement or automatic comp adoption.
- Runtime cache keys updated in both entrypoints. English/Japanese labels explain the separate-take behavior and limits.

Local verification: full Node 2376/2376 PASS, failure/skip 0; targeted 98/98 PASS. node --check for changed JS and git diff --check PASS. Earlier cache-version assertions failed and were updated; final run is green. Browser install failed because the downloaded archive was invalid. No local browser, real model, real voice or listening-quality success is asserted. CI scripts exercise per-note reading edit/download/save/reopen, and selected-measure real Sinsy generation, normalized/excluded lyrics, WAV import and archive byte equality on Linux/Intel. Four browser sizes: 1440/820/390/1180x820. CI results must be read from the published exact HEAD; pending is not success.

Not complete: in-place region replacement, transition crossfade, candidate audition/adoption Undo/Redo as one regeneration transaction, phoneme onset/duration controls, naturalness/accuracy of sokuon/long-vowel/nasal singing, arbitrary long-WAV region synthesis (existing 120s import limit, leading rests count), signed distribution and physical Mac/iPad Safari acceptance. No claim of 20–30 independent items completed or 100% readiness.

Formal 30-feature status conservatively inherited: No.1–30 C, A0/B0/C30. No newly audited whole-feature A/B certification. No Ready/Merge/force push/Live Provider API/unlicensed assets/data deletion.
