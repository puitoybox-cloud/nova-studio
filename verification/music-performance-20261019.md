# Music Studio performance quality — 2026-10-19 JST

Parent #462 e8626fd7b22a5b132bdcba89d57daa1e72f93f86 / tree fa4854e0b5fd55ae0fb950af18345349b7c428eb. Parent's four PR workflows completed SUCCESS, including formerly pending overall verify (39174174628 / 117813302445). Main re-read as 552d56eafddfd192970c09f7d6278696cf8775c3.

## Product changes

- Piano/Strings choose ordered chord inversions by total semitone movement, retaining every required pitch class, avoiding voice crossing and penalizing spans above 19 semitones. Bounds continue to respect the existing melody register rule and complete-octave fallback.
- Strings retain full-span notes and get differentiated voice velocity. Cross-bar voice context uses the generated destination through the existing whole-song snapshot loop; no original notes are rewritten to join ties.
- Bass B alternates root/fifth even at normal density. Diminished chords use their actual diminished fifth rather than an incorrect perfect fifth. Quarter/eighth note grid, density and first root remain explicit rules.
- Piano base velocity reduced from 72 to 68; repeated onsets use alternating accents. C's reduced-voice pattern uses shorter 70% articulation; A/B retain 90% articulation. Existing block/arpeggio/reduced-voice choices remain.
- Drums share a fixed eighth pulse across densities, fixing sparse backbeat drift caused by tying kick/snare position to hat step count. Sparse hats use quarters; normal/rich hats use eighths with alternating accents. B adds rich syncopated kicks. Non-sparse sections get bounded final-beat tom fills only on their final bar; C uses a different tom.
- Preview shows each role's actual note count, MIDI pitch range, and maximum ordered onset-group voice movement where consecutive groups have equal size. Numbers are distribution proxies, not acoustic masking/harmony/perceptual quality verdicts. Replacement metrics include retained/protected notes inside the preview range. No overall quality score or AI ranking.
- Both standalone and Nova entry script URLs updated. Browser real-model fixture now asserts four role metric rows and auditions every whole-song A/B/C with all instruments before existing Bass partial adoption, Undo/Redo, save/reopen and MIDI→Mix/Master/Export.

All these orchestration/expression changes are deterministic rules following the existing model phrase generation. They are not independent four-instrument AI inference. No new model, samples or soundfont. Existing simple playback can verify note timing/register/velocity/routes; realistic strings bowing, piano timbre, articulation and listening quality need appropriate sound sources and human acceptance.

## Verification

Local full Node 2462/2462 PASS, fail/skip 0 (66.39s before entry URL/browser fixture update; final rerun recorded in PR). Focused quality + whole-song + landscape 18/18 PASS. Python audio pipeline 509 run / 504 PASS / five existing skips; fixture ResourceWarnings and deliberate abnormal HTTP logs present. Local generation constraints 8, transport 3, startup 4 PASS. node --check for changed JS and git diff --check PASS. Actual new-head ONNX/Sinsy, Swift and Chrome 1440/820/390/1180×820 must be checked from new exact-head CI, not inferred from parent's successful CI. Local Swift/Chrome/model assets unavailable.

New tests cover ordered inversions with complete pitch classes including low accidental chords, sparse kick/snare timing, section-end fill bounds/A-B-C differences, diminished bass harmony/accent variation, metrics and non-destructive partial adoption/Undo. Existing whole-song save/reopen/backup/cancellation/locks tests remain enabled.

207 Open Draft PRs #256–462 metadata, all changed filenames, latest commit and first-page PR workflow runs fetched with no request failures. Snapshots in music-performance-start-20261019.json. Search was split across creation dates to avoid the 100-result cap. Retrieval finished after first production edit: the request's fully-before-edit inventory requirement was not met. Historical failures/log pagination are not exhaustively audited. No newer Draft found.

## Formal acceptance and remaining work

Music_Studio_最終機能仕様書_v1.pdf, confirmed/modified 2026-09-30, was read in full on 2026-10-19 JST (5 pages / 166 lines). No.1–30 retain C: this increment does not close all UI/backend/runtime/storage/restore/policy requirements of any entire large feature. A0/B0/C30. Inherited 30-row residual ledger retained and copied with this scope.

Remaining: human real-song listening, realistic sound sources, seamless sustained-note ties/crossfades, more phrase/passing-note variety, intra-bar chord editor and chord rebase on transpose, full-song structural model understanding, free Japanese conversation, true server inference interruption, 8-minute whole-song generation performance/storage acceptance, HTTPS reconnect work, signed distribution/runtime/policy and inherited requirements for all 30 features. Original MIDI, existing eight screens, imported/audio files and backups are not deleted or mutated by generation/preview. Physical Mac/iPad checks belong to Tia. No Live Provider calls, Ready, Merge, force push, main edits, or user work deletion.

This is substantive runtime work on the four-instrument orchestration and candidate preview. It is not completion of 20–30 independent production features, nor a proof of musical naturalness.
