# Finished versions and production history — 2026-10-21 JST

Source: Music_Studio_最終機能仕様書_v1.pdf, fixed2026-09-30, current original read all5 pages/166 lines through Library. No.30: 完成版固定、曲情報、完成曲検索、制作Session、日次記録、完成までの時系列履歴. All30 residual rows compared; No.30 selected because existing durable checkpoints and complete archives provide its local storage graph. No.28 assistant integration, No.19 mastering quality, No.29 cross-song transformation are larger remaining scopes.

## Production behavior

- Working and finished checkpoints are explicitly distinguished; existing checkpoints without a kind remain readable as working versions.
- Finished records retain the exact validated project snapshot: MIDI, lyrics, AI candidates, sound selections, PCM/long audio, Mix/Master settings, metadata and final export history/deliveries. Existing binary references are retained and SHA-256 authenticated before publication.
- Metadata/name/date search finds finished records locally; project search also matches historical finished metadata.
- Explicit session start/finish persists dates and revisions. Start notes and finish notes are retained separately. Open sessions survive restart.
- Daily records append with a user-selected valid calendar date, note, recorded timestamp, revision and optional active session link. Multiple records per day remain retained. Invalid dates, duplicate session IDs, broken links and over-capacity ledgers fail closed.
- Unified chronology includes working/finished records, adoption, session start/finish and daily entries. This is explicit production history, not a log of every edit.
- Open copy creates a new editable project with source/checkpoint provenance. It never rewinds or overwrites the current source. Source baseline verification and destination add occur inside one strict IndexedDB transaction. A copied active session is closed only in the copy; source session stays open.
- Both source and copied project retain their flat checkpoint graphs. Existing additive JSON/complete binary archive recovery rebinds project identities without recursive snapshots.
- Cancellation, dirty editors, recording/count-in/stopping, running export/archive/shutdown, storage races, missing/corrupt binaries and quota failures prevent publication. Original songs and completed versions remain unchanged.
- Existing No.22/23/24/28 paths are reused. No new service, model, asset, authentication, storage choice, provider call or paid operation.

## Evidence and limits

Initial new PR #484 head7b5908e0e4ea5501f278df872d8a2d4e0ff2d0a1 (tree f640460e96d079bdff92208ec8308b1b4b3a1619) matches local initial implementation tree. Its checkpoint-recovery job119199454152 completed SUCCESS, including focused23 tests and real browser UI/restart/copy/archive regression. Later daily append and unified chronology changes require their own final-head validation; initial-head evidence is not attributed to later commits.

Local initial full Node2544/2544 PASS (106.311s), focused final24/24 PASS, Python audio509 run/504 PASS/5 existing skips (33.917s), generation36/36 PASS (4.745s). All253 JavaScript syntax checks passed before the final daily/timeline additions, and modified scripts rechecked afterward. Whitespace checks pass. Local Swift unavailable. Local Chromium download failed, so no local browser pass is claimed. Current-head native/Swift/real ONNX/Sinsy/browser jobs must be checked independently.

Bounds preserve data rather than silently prune:32 checkpoints,32 adoption operations,256 sessions,512 daily entries, inherited project JSON capacity. Session timestamps are UTC; daily dates are explicitly chosen by the user. No physical Intel Mac/iPad acceptance or human music quality certification.

Formal A0/B0/C30 retained pending final current-head production acceptance and standalone runtime/distribution/policy closure. The No.30 storage lifecycle is implemented; unsigned build/source or passing unit tests alone do not establish that physical acceptance is the only remaining requirement. Full packaged runtime/distribution closure is not certified here. No20–30 independent improvement count is asserted.

Next: verify final-head complete binary archive/restart/browser and packaged resource acceptance; close any identified No.30 packaging/policy blocker with concrete evidence; then evaluate formal B. Next bounded functional candidate remains No.28 assistant-intent integration, subject to the same original requirements.

Follow-up evidence: local daily-record implementation full Node2545/2545 PASS (104.115s), focused24/24 PASS. Final chronology/contrast edits pass focused24/24, changed JS syntax and whitespace. Original-head browser artifact12342479665 ZIP was downloaded and SHA256 verified as4d188725da73275d69b67a6bdea7cafcebddcb011aaf02a1fa71d211a925497c. Report confirms all4 viewports with overflow=false, errors=[], external=[], source immutable, editable copy, AI binding, historical WAV and complete archive restore. Actual390px screenshot inspection revealed white section/background contrast, corrected in the subsequent source; new focused history screenshots cover all4 sizes. These earlier-head artifacts remain separate from final-head acceptance.

Daily records are now independent append-only ledger entries. Session start notes remain unchanged when finishing; finish notes use a separate field. A single chronological view includes session start/end and daily-record publication alongside finished/working snapshots and adoption history. These are concrete No.30 requirements, not a test-count proxy for completion.
