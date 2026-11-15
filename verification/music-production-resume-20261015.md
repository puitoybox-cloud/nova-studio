# Music Studio continuation — 2026-10-15 JST

Source specification: Music_Studio_最終機能仕様書_v1.pdf, fixed 2026-09-30; all five pages / 166 lines read this session. Parent: Draft #422, `63901c436f702d8c44b6c31e5c502364cf578245`.

## Implemented behavior

- Stereo loopback WAV measurement runs locally. The left channel must be a simultaneous direct reference, the right channel its returned signal. Normalized correlation estimates signed frame delay, supports inverted polarity and rejects silent, clipped, ambiguous, unsupported or low-confidence recordings. Analysis yields and cancels when its form/device changes.
- File analysis produces a preview. Explicit Apply changes only the recording compensation field and disables the older saved-profile override. Existing Save input and capture paths persist the confirmed value. The source audio and old takes remain intact. This is file-based measurement; automatic calibration of the currently connected microphone/output is still incomplete.
- Saving an input profile preserves pending latency, microphone choice, punch/end position, count-in, cycle and checkbox choices plus disclosure state after the atomic save repaints the form.
- AI note review is scoped to project and proposal identity. All/None, individual choices and tab changes preserve the current review without transferring unchecked IDs to a new proposal. Retention is bounded to eight proposal reviews per open project; review choices are transient UI state.
- Landscape AI drawer retains header/navigation while long proposals scroll inside its body. Main actions remain sticky; note labels and checkboxes have touch targets. Actual iPad layout remains unverified.
- Both standalone and hosted loaders include the measurement module and updated script/style versions. Native resource staging includes the new module.

## Verified locally

- `node --test`: **2249 passed, zero failed/skipped**, including measured delay -> capture -> render -> reopen -> complete Archive restoration with original-byte comparison, existing cycle recording/stop/quota behavior, AI adoption, and exact native resource staging.
- `python3 -m unittest discover -s tools/music-audio-pipeline -p 'test_*.py'`: **509 tests, OK**.
- JS syntax: 176 root/test scripts checked; changed runtime scripts checked again after final edits. `git diff --check` passed.
- Physical acceptance is not included in fixture results. Browser persistence and screen layout cannot be inferred from VM/IDB test doubles.

## Not executed locally

Swift, unsigned macOS and iPad Simulator builds: no Swift/Xcode installed. Chrome at 1440/820/390 and 1180x820, Console error/warn count: browser executable absent, browser download failed. These are pending, not successful. Exact new-HEAD CI is checked after Draft creation and reported separately.

## GitHub recovery evidence

`music-resume-github-20261015.json`: main `552d56eafddfd192970c09f7d6278696cf8775c3`; 169 open PRs, 167 Drafts, all 167 mergeable at retrieval. Latest saved Draft is #422. Head/base, latest commits, changed paths and available exact-head workflow runs are recorded. Public API rate limits were recovered with connected GitHub reads. Historical failed workflow job/step/log excerpts are in `music-pr-failure-evidence-20261015.json`; they are not treated as current-HEAD failures.

## Remaining production scope

No whole major feature is certified A or B. **A0 / B0 / C30**, with individual residual groups in `music-resume-30-features-20261015.json`. This session does not complete the target of 20–30 substantive feature items. Remaining work includes automatic live-device latency calibration, full iPad editing-screen acceptance, production MIDI instrument/model assets and bindings, AI composition/vocal/Mix/Master residual workflows, and native/physical end-to-end acceptance. No percentage is calculated.

Only a new branch/Draft is written. No main or existing PR updates, Force push, Ready, Merge, Auto Merge or Live Provider API calls.
