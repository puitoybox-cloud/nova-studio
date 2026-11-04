# Browser process termination and export-only history — 2026-11-04 JST

Baseline: PR #580, eff3cb949ea1f04358549651069ec5820ee59d08.
Failure source: Actions run 41776318563, job 126397412892: Page.crash did not produce Playwright's page crash event within 10 seconds. The log establishes a missing notification; the Chromium internal reason is unknown.

## Implemented acceptance boundaries

| Boundary | Evidence | Scope |
| --- | --- | --- |
| Normal browser process restart | Real Chromium, same profile, original and additive restore | Session, daily history, checkpoints |
| Committed data followed by SIGKILL | Owned detached Chromium process group; observed SIGKILL exit; same profile reopened | Both projects and retained history |
| In-flight productionDaySave | Real IndexedDB put success; transaction held active by chained reads; browser SIGKILL | Exact original project retained, including revision/history; retry succeeds |
| Export-only history | finalDownload and repeated finalSave; active session; failed CAS; backup restore | Automatic production timeline now includes receipt/history-only publication |

Initial process recovery CI passed: https://github.com/puitoybox-cloud/nova-studio/actions/runs/41793815023 (df97d48cfa24b0bca5a7c29f8fb2a627a4687de1). Later production changes require CI on their own HEAD.

## Remaining acceptance gaps

MS22-A04 remains open. This test does not cover every public save entry, every repository transaction family, binary/archive/journal writes, or OS/power failure. The in-flight test deliberately prevents commit; it does not sample the uncertain commit boundary.

MS30-A02 remains open. Export-only history publication is repaired, but a complete inventory and accepted evidence for every special save entry is still required. No acceptance ledger counts are changed by this patch.

Macless baseline remains 60 verified / 135, 75 open, 44.44%. Intel Mac and listening checks remain separate.
