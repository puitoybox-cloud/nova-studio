# Music Studio UI and vocal production — 2026-10-12 JST

Shared UI changes apply to existing standalone and host Music Studio surfaces. Capture lyric following and measured sample-peak normalization extend existing saved-take production paths. No original song, prior branch or backup is replaced.

## Connected changes

UI:
1. One 4px label spacing scale.
2. One 6px vertical / 10px horizontal control padding scale.
3. One 12px common panel padding scale.
4. Compact home cards without inherited forced height or title indentation.
5. Common readable page heading size and line height.
6. Consistent action gaps and wrapped vocal form controls.
7. Explicit Japanese font fallback and Japanese fonts in CI.
8. Japanese captions for main editing and AI actions; stable action identities retain existing behavior.
9. Mobile 44px action targets and 16px inputs, without expanding desktop control padding.
10. Visible keyboard focus and readable native file inputs on dark surfaces.

Production:
11. Explicit lyric track selector using saved note assignments.
12. Stale assignments excluded and ambiguous duplicate note assignments rejected.
13. Lyric time uses the actual project tempo map, note duration and rests.
14. Capture clock drives highlighted lyrics and scrolls only the lyric container; stop/discard releases the timer.
15. Selected lyric track travels with recording-plan metadata through save, fresh reopen and complete WAV archive/additive recovery.
16. Peak normalization measures currently processed PCM, including retained pitch/timing/range gain, before calculating global gain.
17. Silence, nonfinite targets and gains outside the existing allowed range fail without saving.
18. Before/After, selection, cancel and explicit adoption use the existing candidate/render path; preview does not mutate the song.
19. Normalization retains source bytes and existing independent pitch/timing/range settings.
20. Adopted normalization uses existing atomic edit history, Undo/Redo, edited WAV, fresh reopen and byte-identical full archive recovery.

These are twenty connected UI/behavior changes within two new vocal workflows and a common UI scale, not twenty completed major features. No whole-product 100% claim. The UI matrix covers ten principal routes at 1440/820/390; it does not certify every hidden popup, touch interaction or physical device.

## Evidence

Start: main 552d56eafddfd192970c09f7d6278696cf8775c3; actual #404 HEAD 509bcd570590549283a417ee1bf52ef3ee92307c; six exact-head workflows success. All 149 prior Drafts individually fetched with HEAD/base/mergeability/latest commit/all changed filenames/exact-head runs. Source inventory: music-ui-production-start-20261012.json.

Original specification Music_Studio_最終機能仕様書_v1.pdf (confirmed 2026-09-30) was freshly read in full: five pages, 166 lines, all thirty scopes. Current scoped status: music-ui-production-30-feature-status-20261012.json. A0/B0/C30 retained without promotion. Sample-peak normalization is not LUFS, true-peak limiting or proof of complete mastering.

Local full Node after the Japanese-caption changes: 2154 PASS; final preview-label follow-up focused suite passes. Python: 504 PASS / five preexisting dependency skips. JavaScript syntax and base diff whitespace pass. Local Chromium acquisition failed; browser/native results must come from exact-head CI, not be inferred from these local checks.

Initial real Chrome produced successful ten-route / three-width lyric, peak, history, archive and fresh-document recovery evidence with zero console/external requests and no horizontal overflow. Its subsequent legacy Comp scenario failed because a selector expected the old English-only caption. Exact selectors now accept the bilingual caption; final CI/PR body supersedes this preliminary record. Screenshots were inspected, and remaining file-input contrast, title size and compact-home overrides were improved.

Final exact-head full Node, browser regression/screenshots, Swift and unsigned macOS/iPad build results are recorded in the final PR body. Do not read preliminary statements here as final device acceptance.

Remaining software includes latency calibration, gapless cycling, formant/vibrato, approved local singing assets/runtime/licenses, complete final batch/Stem export and native distribution. Physical Intel Mac/iPad microphones/headphones, human voice quality, Japanese touch, permissions/suspension/restart/storage pressure, Logic/Keystation and Gatekeeper/signing/notarization remain separate acceptance work.

Draft only. No Ready/Merge/Auto Merge/force push or Live Provider API.
