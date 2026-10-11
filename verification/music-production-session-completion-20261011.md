# Production save, shutdown and transfer completion — 2026-10-11 JST

Source: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, reread in full 2026-10-11. Prior checkpoint #395 / 459306debbb96cf6831622d6fe833b39dfd96b9d; all three returned exact-head workflows SUCCESS. Main 552d56eafddfd192970c09f7d6278696cf8775c3. Fresh audit retrieved 142 Open PRs, including 140 Drafts: each Draft HEAD/base/mergeability and returned workflow runs fetched; no Draft conflict. No old PR/main writes.

22 production implementation units, grouped below. These are subrequirements, NOT 22 completed major features, and tests are not counted as implementation units.

| Unit | Production behavior |
|---|---|
|1|Serialize manual MIDI, autosave and Stop writes|
|2|Retain the requested editor session while a queued save waits|
|3|Reject changed repository before publication|
|4|Use existing atomic compare-and-put for MIDI writes on supported repositories|
|5|Retain edits made during an older write as dirty for the next save|
|6|Update recent-project identity after successful active-editor save|
|7|Share in-progress Stop result so shutdown waits for that Stop|
|8|Shutdown stops active MIDI and saves committed held notes|
|9|Cancel pending MIDI activation/count-in before shutdown|
|10|Await queued saves and bounded follow-up saves before close acknowledgement|
|11|Save dirty project forms before shutdown acknowledgement|
|12|Save dirty settings form before shutdown acknowledgement|
|13|Reject known temporary-storage fallback as durable shutdown success|
|14|Reject active import/export/PCM/Restore operations before closing|
|15|macOS window close waits for the page save promise|
|16|macOS application quit waits for all live hosts|
|17|Missing API/storage failure/15s timeout cancels close and reports save failure|
|18|JSON project export flushes pending editor changes before reading storage|
|19|Project duplicate flushes pending editor changes before copying|
|20|Backup export refuses pending edits/recording instead of silently omitting them|
|21|Candidate Preview and Preview cancellation do not create false pending AI edits|
|22|Family Preview/Plan/Preflight/Cancel do not create false pending AI edits|

Changed production: music-studio.js, music-studio-ai-assistant-panel.js, MusicStudioWebViewHost.swift, both Swift Package and Xcode app entrypoints. Existing storage schema unchanged. Older custom repositories lacking compare-and-put retain their existing put fallback; no cross-process atomic guarantee is claimed for those adapters.

Local evidence: full node --test 2037 PASS before final active-editor recent-ID guard; focused suite 219 PASS; new shutdown/transfer suite 19 PASS. Python 509 run = 504 PASS / existing 5 skip. All 185 JS syntax PASS before final edits; final syntax/whitespace recheck recorded in PR body. Tests that previously intercepted put now intercept compare-and-put, keeping their original failure/Undo/race assertions. Swift fixture adds asynchronous save acknowledgement, failed save, missing API and not-ready checks. Chrome bundled MIDI script adds active held-note shutdown -> actual IndexedDB commit -> reload, JSON flush, and unsaved Backup refusal at all three widths.

Local runtime has no Swift/Xcode/macOS Simulator or installed Chromium executable. Native builds and real Chrome verification MUST be read from this PR's exact-head CI; pending is not PASS. CI evidence/status and final HEAD belong in the PR body and final delivery.

## Major-feature classification

A 0 / B 0 / C 30 remains conservative. All No.1–30 are C. No current complete per-subrequirement production/backend/model/policy evidence map or physical acceptance allows promotion. Existing residual ledger verification/music-residual-ledger-20261010.json has explicitly unknown total residual counts, not a proven finite completion percentage. This patch improves No.1/2/6/22/23 and common native lifecycle without declaring the entire major feature done.

Before physical verification: complete production requirement/evidence mapping for all 30; real vocal/guided-vocal/harmony/model/backend closure; full multi-project binary Backup including long WAV (generic Backup still rejects it); migration/update/origin continuity; distribution/license/model selection where required; production native end-to-end song recording/transfer in independent app processes beyond the existing raw IndexedDB fixture. These remain software/evidence obligations, not only hardware checks.

Physical Mac gates: Keystation actual capture/Stop/reopen/play/edit; macOS red-close and Cmd-Q/relaunch with real songs; permissions, quota/interruption/update, Intel Audio Helper signing/notarization and six-note Audio-to-MIDI quality, Logic Pro round trip. iPad physical gates: touch/Japanese layout, file/microphone/MIDI permissions and suspension/relaunch. Forced OS kill/power failure is not covered by cooperative close acknowledgements. iOS background suspension is not claimed completed.

No Ready/Merge/Auto Merge/force push/provider API calls. All fixtures disposable; no user song or Backup opened or changed.
