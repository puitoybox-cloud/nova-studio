# Music Studio compact late-song vocal generation — 2026-10-17 JST

Parent: #450 / 7013f2ae854f63898e61db84ee80024263c3943a. main confirmed unchanged: 552d56eafddfd192970c09f7d6278696cf8775c3.

## User behavior
Selected-measure Sinsy synthesis now emits only selected measures, including their local rests, rather than all preceding song silence. The first selected measure inherits the effective prior tempo and includes meter/divisions/clef; within-range tempo and truncated-meter changes retain absolute score timing. Imported PCM is anchored at the selected measure tick. Full original XML binding remains saved for stale-score checks, comparison/replacement, existing edits, Mix rendering and full archive restoration. Existing full-score and older range takes retain their stored placement. The range UI explains comparison/adoption and no longer falsely says replacement is unavailable.

## Evidence and limitations
New transactional test covers measure 101 after 120 seconds, inherited tempo, no preceding measures, original full XML provenance, import, render, fresh repository archive restoration and exact PCM equality; invalid range/unbound compact import reject. Existing bounded replacement suite remains in place. Real inference script now additionally requests actual Sinsy measure 101 and checks 200-second placement plus archive byte equality. This is a CI requirement, not a locally completed real inference claim.

Local Chrome executable, Swift/Xcode and ONNX/Sinsy model assets are unavailable. Browser launch failed for missing executable. Required CI is requested on the new Draft; no physical Mac/iPad acceptance. Full MIDI/AI/Vocal/Mix/Mastering single-screen coverage, long recording, complete HTTPS reconnect, native signed distribution and other 30-feature production gaps are not completed by this change. No claim of 20–30 independent completions, 100% readiness or B promotion. A0/B0/C30 conservatively inherited; no complete re-audit of the authoritative 30-feature spec in this turn.

Start inventory: 197 open PRs, 195 Drafts; per-Draft HEAD/base/mergeability/changed-file first page/exact-head check-runs saved in music-production-workflow-start-20261017.json. Parent has 11 successful exact-head checks. File/check collections are first-page only; no claim of exhaustive pagination for oversized PRs.

No main or existing PR mutation; no Ready/Merge/force push/Live Provider API. New draft targets parent feature/music-long-vocal-window-v1.
