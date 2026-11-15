# Music model constraints and saved lyric re-edit — 2026-10-17 JST

Parent #445: 20ab9264284fa382944575a909c019cce5e9611b. Main independently re-read as 552d56eafddfd192970c09f7d6278696cf8775c3. All 190 existing Open Draft PRs (#256–445) re-read through GitHub connector: HEAD/base/ref, mergeability, latest commit, exact-head workflows. Initial REST snapshot was incomplete (rate restrictions); companion connector snapshot is authoritative. No newer checkpoint found. Parent real-generation workflow SUCCESS.

## Product changes

Prepared local Mac/LAN host now accepts Key, meter, pitch bounds and a sampling style along with BPM/seed/range. A/B/C real ONNX inference uses style-specific temperature/top-p/top-k. Explicit postprocessing projects generated pitches to the nearest allowed major/natural-minor scale note inside the chosen bounds; ties choose lower pitch. Rhythm, rests, durations and velocities are retained. Requested BPM and meter replace generated meta events, avoiding model-produced tempo drift. This is explicit scale/range correction, not learned key/mood conditioning or chord-aware composition. Unsupported keys/meters/ranges fail closed.

Compact AI model controls offer Balanced/Gentle/Varied sampling and Wide/Female guide/Narrow pitch presets. Female guide is A3–F5, not an assurance of individual singability. Project Key/BPM/meter are transmitted. Busy state disables controls; musical settings join MIDI/session/range/workspace stale-result checks. Request seed is captured before repaint. Actual generation constraints, model/revision/seed and correction counts are retained on candidates, displayed in summaries, saved/reopened and backup-restored through the existing AI workspace. Preview/Listen/partial Apply/Undo remain on the original production path.

Saved lyric assignments can be reopened against current note IDs after MIDI pitch/timing edits. Re-read and Preview are mandatory before adoption. Missing or noncontiguous notes are rejected; no original assignment/take is altered by reopening. After adopting an edited assignment, the existing Sinsy generation/import route can produce another take. This is selected-assignment regeneration, not audio-region replacement/crossfade or automatic migration of old take timing.

An explicit Split kana action converts supplied katakana to hiragana and preserves compound sounds such as きゃ. Kana morae are separated; っ/ん/ー and explicit ~ remain individual tokens. Kanji/Latin input or malformed small-kana combinations are rejected. No reading/accent guess is made. Preview still requires the exact note/token count.

Host/standalone script cache keys and version fixtures updated together. Existing screens/data retained. No Live Provider, unlicensed models, force push, Ready/Merge/auto-merge.

## Validation

Real Linux CPU ONNX invocation: Dm, A3–F5, 6/8, BPM90, gentle, 48 events, 3840 ticks. A/B/C generated 32/40/7 notes, 23/22/1 pitch corrections. Initial real run exposed NumPy integer correction-count JSON serialization; corrected with native int and rerun successfully.

Actual host → Studio integration with Dm/A3–F5/gentle: A/B/C32/40/7 notes, every note checked against scale/range; partial Apply and MIDI save/reopen; real Sinsy WAV192044 bytes; full archive restore/render byte equality; foreign Origin rejected. No mocked model substituted for these checks.

Python constraint tests4/4; startup4/4; HTTPS transport3/3. Focused JS import/lyrics tests17/17 and cache/navigation/editor tests81/81 PASS. Full final Node suite result and exact-head CI are recorded in PR final body. Earlier suites found only cache-version fixture mismatches; assertions retained and versions synchronized. JS syntax, Python compile and git diff --check PASS.

Local Chrome installation failed (invalid/truncated downloaded archive). Browser1440/820/390/1180×820 including real model/voice is delegated to exact-head CI. CI fixture now selects gentle/A3–F5/Dm and verifies every returned pitch. No physical Mac/iPad/Safari, listening quality, all-editor one-screen, or distribution signing acceptance is claimed.

## Remaining production work and formal status

Arbitrary mood text/genre conditioning, chord-aware/lyric-conditioned inference, variable-meter/tempo-map conditioning and precise model quality acceptance remain. Kana splitting is not Japanese accent/phoneme analysis; harmony and advanced voice quality remain. Region-only vocal rendering/replacement, signed/notarized full runtime/model distribution and approval closure, complete all-editor iPad one-screen acceptance, and existing 30-feature production residuals remain.

Formal No1–30 remain C, A0/B0/C30, with conservative inherited ledger and new scoped evidence. No function group is newly certified as having only physical tests remaining. This change does not complete 20–30 independent production features or reach 100%; a trustworthy completion percentage cannot be confirmed.
