# Explicit Project Section Apply

2026-10-03 JST. Independent branch `feature/music-ai-project-section-apply-v1`, based on freshly fetched Draft #280 `4faed5d1810c841d2e191984e9ff99cf33aa8db7`. Main and all 25 pre-existing Draft PRs were fetched at start; all were mergeable and their returned CI runs successful. Existing non-Draft Open PRs #10/#35 were also included in the HEAD inventory. See `music-ai-project-section-apply-audit.json`.

## Confirmed unfinished feature and resulting behavior

At #280, Section candidates had exact Preview intervals but Family Apply only recorded adoption metadata. The project data contract already contains `sections`, but Apply did not write candidate Sections there. This increment adds an unchecked-by-default **Apply Section to Project (曲構成へ追加)** option. It requires Section selection, Plan, passing Preflight and explicit Confirm. Default and metadata-only Family behavior remain adoption-only.

Explicit Section Apply appends exact selected Section intervals to the existing project sections without replacing earlier rows. Unknown extra fields on existing sections are retained. Overlap, ID collision, ambiguous legacy ranges, malformed collections, absent Section selection, metadata-only conflict, duplicate Set IDs, stale source/binding and altered Section plans reject without MIDI, adoption or history mutation. Legacy measure-only ranges are never reinterpreted into changing-meter ticks. No new musical classification or auto-adoption policy is inferred.

The existing atomic Editor commit now optionally carries a runtime-only Project Sections sidecar. MIDI, adoption metadata and Project Sections share one existing Undo/Redo unit. Older MIDI history is seeded only during the explicit operation; it restores original sections when Undo crosses the first Section Apply. Session load/render creates no sidecar and performs no write. There is no saved MIDI metadata field, schema/version migration or separate history system.

Save uses the explicit sidecar only after that operation. It retains the absence of a legacy `sections` field on Undo, preserves additions for retry after failure, detects concurrent stored section changes before overwriting, and retains a newer Undo during an in-flight older Save. Project Section rows are visible in a compact details area. Changes use the existing schema-1.0 `sections` array and existing JSON/Backup preservation.

## Validation

- Fresh #280 baseline: node --test 1082/1082 PASS, fail/skipped 0. Its actual code ignored the applyProjectSections option and had no Project Section Plan/history API; this missing feature was reproduced before the implementation.
- Independent implementation: 1109/1109 PASS, fail/skipped 0. New core/integration tests exercise explicit Section-only, Melody+Section and full Family operations, exact tick 1000 under changing meter, partial M2-3, before/after ordinary MIDI history, rollback and absence of history binding on failed commit.
- Save -> Undo -> Save -> Redo -> Save -> Reopen -> JSON export/import -> Backup/Restore retains exact MIDI, workspace and Section rows. Legacy unknown/absent sections load/render write 0. In-flight Undo, repository failure/retry and concurrent source changes are covered using synthetic memory repositories only.
- Default Family, partial/component selection, metadata-only, dependencies/conflicts, locks, exact bounds, rollback and persistence regressions are retained.
- Browser smoke retains all prior cases at 1440/820/390 and adds explicit Section-only and mixed MIDI operations, Plan/Preflight/Cancel nonmutation, visible exact Project rows, one Undo/Redo, Save/Reopen, overlap/legacy-range/metadata-mode rejection. Browser routes capture external requests and console warning/error/pageerror.
- The initial product checkpoint 969c4cb passed all three workflows, including real Chrome 1440/820/390 run 37101270589 with 63 screenshots and empty console error/warning/pageerror and external-request arrays. Artifact 11266880852 was downloaded, actual HEAD checked and screenshots inspected. Final refinements add two successive-transaction/history regressions and clarify that an opted-in Section Plan writes Project Sections rather than adoption-only metadata. Final exact HEAD CI and artifacts are recorded in the Draft PR after completion. This environment has no local Chrome executable; Actions uses real Google Chrome.

## Remaining and physical acceptance

Intel Mac/Chrome and M1 iPad/Safari: use a separate synthetic project, generate a four-bar Family B, select Section M2-3 and enable Apply Section to Project; Plan -> Preflight -> Cancel -> Plan -> Preflight -> Confirm -> Undo -> Redo -> Save -> Reopen. Check the visible Section rows and unchanged MIDI for Section-only mode. An overlapping existing exact Section and a legacy range with unknown ticks must be BLOCKED. Check iPad touch and Japanese rendering, plus normal MIDI partial Apply playback/Keystation Mini 32 MK3 recording separately. Physical-device acceptance is not established by Linux Chrome.

Automatic section classification, replacing or editing existing Sections, Arrangement instrument rendering, Lyrics realization and Continuation policy remain future work. The earlier Intel Mac Audio-to-MIDI accuracy acceptance is separate.

No protected main/PR/branch change, real song/backup modification, feature deletion, automatic migration/load-time write, external AI/Live Provider/API key communication, Ready/Merge/Auto Merge or force push.
