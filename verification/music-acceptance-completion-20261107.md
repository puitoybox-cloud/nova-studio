# Music Studio acceptance — 2026-11-07 JST

Baseline: PR #599, `34d620c5c8b1ff3fc9977fd4551d235ed2197093`. Production changes are isolated in Draft PR #600; the baseline branch and main are unchanged.

## MS30-A03: finished snapshot immutability

The previous repositories accepted a replacement row with a modified or removed finished checkpoint. The added Node regression failed before the production fix (`Missing expected rejection: put:content`).

Every existing-project replacement now compares finished receipts against the durable previous row. The IndexedDB comparison and replacement share a strict transaction. A changed snapshot, receipt, kind, identity, or removed checkpoint rejects the transaction. `putLongWav` rejects before publishing metadata/binary records or consuming recording journals. Memory repository writes use the same invariant. Working project fields remain editable.

Storage closure is recorded in `music-finished-boundary-audit-20261107.json`: existing project rows are replaced only by `put`, `compareAndPut`, and `putLongWav`. MIDI imports, finished forks, metadata restores and Full WAV Archive restores add new identities, reject destination collisions, and do not replace their source. Explicit project deletion remains a separate user action.

The Chromium matrix attempts 114 snapshot/receipt mutations across the three replacement sinks, checks exact source preservation and binary rollback, permits working edits through each sink, opens and edits a finished copy, and reopens the source and copy in a new page. Existing checkpoint tests also cover source races, destination collisions, missing dependencies, cancellation, quota errors and complete archive restoration. Evidence is source-hashed in `music-finished-snapshot-acceptance-20261107.json`.

## Keyboard focus and workspace CI

Status repaint now captures the focused control, caret and open ancestor disclosures, and restores them only to a visible enabled replacement on the same route. The native MENU toggle is restored after its host mutation observer relocates the existing node, without taking focus away from a newer control. Disabled controls and route changes do not receive restored focus. Real-browser accessibility inventory covers 14 major routes, keyboard traversal and collapsed/expanded axe scans; the inventory is diagnostic and its successful execution alone does not certify zero accessibility violations.

Shared accessibility fixes also include legible nested disclosure backgrounds and labels, a level-two Favorites heading, visible MENU text in its accessible name, one primary main landmark, and named roles for the ruler/playhead visuals. Three existing playhead-position assertions now allow added ARIA attributes while retaining the same exact position checks.

The cancelled baseline smart-workspace job stalled downloading `fonts-noto-cjk` from the Azure HTTP mirror until the 12-minute job limit. Its Node tests passed; the browser step was skipped. PR #600 uses the existing official HTTPS archive setup with bounded transfer time and a font-family assertion. Neither the Japanese font assertion nor browser assertions were removed.

## Remaining verification gaps

| ID | Remaining acceptance condition | Next concrete work |
|---|---|---|
| MS12-A02 | Long-duration PCM and encoded recovery is not matched to every save destination and interruption position. | Build a recording duration × encoding × destination × interruption matrix; kill/reopen/retry and compare retained samples, journal consumption, archive bytes and history. |
| MS18-A02 | Supported source formats, placements and dependency conditions lack a complete independent whole-song reference mix comparison. | Enumerate accepted MIDI/PCM/WAV/Take/encoded-reference forms and offsets; compare rendered channels, timing and mixed samples against independently rendered fixtures. |
| MS22-A04 | All save entrances lack a complete uncertain-commit, retry, repository switch and interrupted Archive/recording/backup mapping. | Match each production save entrance to before/during/after commit termination, fresh Chromium restart, retry identity and exact stored payload/history preservation. |
| MS28-A02 | All editing states × workspace transitions have not been exercised in Chromium. | Cover dirty MIDI, count-in/start/record/stop, PCM edits, Archive transfer and final export against each navigation/settings action; check refusal, retained drafts and valid later navigation. |
| MS28-A04 | All conditional panels, keyboard operations and focus-return paths require full accessibility acceptance beyond the new major-route inventory. | Resolve recorded axe findings; include populated audio/recording/AI panels and dialogs, keyboard activation/escape/return and complete Tab traversal with before/after data checks. |
| MS30-A02 | Special save entrances lack a one-to-one session/day/edit/restore history matrix for normal/interrupted/uncertain/retried commits. | Pair the MS22 save-entrance matrix with exact event IDs, session/day links and no-loss/no-duplication assertions after fresh reopen and restore. |

The 63 decision-dependent A requirements still depend on 18 C decisions. The audit JSON maps every blocked requirement to its decision and the concrete information required by `docs/music-studio/MACLESS_DECISIONS_20261031.md`. No model adoption, license approval, quality threshold, paid provider contract, Cloud Sync policy or Logic integration contract is inferred from a candidate's presence in the repository.

Intel Mac, physical power loss and actual-song listening acceptance are separate and unverified.

## Validation at publication

- Full Node regression: 2,927 passed; zero failed, cancelled or skipped. The final CSS-only refinement additionally passed 45 existing style/layout/workspace tests. Focused checkpoint/workspace/menu/Logic regression: 227 passed. Auto-Finish helper: 22 passed.
- Matching JavaScript runtime `545b5945d40f9130888cdbcefa8c5936e1ce8b27`: checkpoint/recovery run 42342656636, IndexedDB run 42342656645, audible A/B run 42342656917, smart-workspace run 42342656766 succeeded. The 14-route inventory restored 58 focus samples with no focus failures; its remaining findings were color contrast.
- Latest CSS-only refinement: Chromium run 42342944951 was queued at the last check; its outcome is **確認できません**. It is not represented as a passed accessibility acceptance.
- Formal ledger: **66/135 (48.89%)**, **69 open**: six incomplete verification matrices and 63 decision-dependent A requirements. New verified ID: **MS30-A03** only.
