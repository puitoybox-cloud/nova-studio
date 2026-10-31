# Atomic metadata Restore and bounded Chrome verification

Checked 2026-10-05 JST (work began 2026-10-04 JST). Stage 2 software/contract **OPEN**; physical acceptance **PENDING**; formal A **0/30**. This is a production metadata improvement, not complete binary Backup or device acceptance.

## GitHub source and CI diagnosis

Fresh audit: main `552d56eafddfd192970c09f7d6278696cf8775c3`, 45 Open / 43 Draft PRs. Drafts mergeable; #35 and #10 have conflicts. Latest #298 `031def44c194787f4e8e17552961d62e93b10df2`, base #297 `f4402bc7d4dee5470b454f0f8058c57c96b3c601`. No #299+ existed. Existing HEAD/base/state values and retrieved HEAD Actions are in `verification/music-atomic-restore-start.json`.

#298 run 37207106392 stalled in Real Chrome. Unchanged #298 regression was executed in new Draft #299 under a 40-second diagnostic bound. It printed `normal retry failed`, then remained alive until exit 124. Its catch only set exitCode; page/browser resources were not closed. The completion listener was checked before its own event callback was guaranteed observed. The fixture also passed unknown metadata to makeProject, which does not retain arbitrary top-level fields; a source-executed Node check confirmed `unknown` absent.

The corrected fixture attaches unknown metadata to the synthetic Project, independently awaits both production put and the complete observer, starts directly on its isolated origin (avoiding an originless IndexedDB script), blocks and asserts external requests, and retains every original assertion. Page/browser cleanup is in finally. Bounds: evaluate 15s, page/browser close 5s, script watchdog 90s, process 100s; application smoke process 600s, Chrome workflow step 12min, job 20min. Timeout fails, never skips. A child-process regression proves exception closes page/browser and exits nonzero without open handles.

Repair checkpoint `c2534316f49c67cb8b9c2e8977b2075b6cfb1d45`, Actions [37211054737](https://github.com/puitoybox-cloud/nova-studio/actions/runs/37211054737) SUCCESS. Artifact 11307096028 downloaded/inspected: matching HEAD, Chrome 1440/820/390 request success → late abort, error, complete, retry, invalid-second preflight PASS, Console/error/warning/pageerror and external arrays empty. Existing application smoke retained, 225 screenshots. #298 itself is unchanged; its original CI is not represented as repaired or successful.

## Production behavior

Restore preflight validates all selected Project metadata, known MIDI versions/PPQ/tempo/signatures/track shapes/channels/programs/notes (including muted tracks) and structural event maps. Empty and editor-only/legacy MIDI are retained without normalizing or manufacturing data. Assets/reference shapes, known identities, duplicates and derivedFromAssetId closure are checked. Malformed second item prevents all publication. Project/MIDI/legacy/opaque fields are copied, not stripped. Settings retain opaque extensions while known fields still receive the existing safety normalization; Backup and loadSettings retain those extensions.

Current Backup and Restore scope is metadata-only. External file classifications are external, declared missing, reselection-required, unsupported. Presence is explicitly **unverified**: neither a path nor a metadata claim is evidence of bytes. No binary is marked present without a resolver. External/unsupported legacy metadata remains restorable as metadata, with warnings; malformed references and broken asset dependency edges fail preflight. No binary URL is fetched, no full binary completeness claimed, no A/B/C storage choice made. Original MIDI file bytes are distinct from inline midiData.

IndexedDB v5 schema unchanged. All selected Projects and settings are staged in one readwrite transaction across the existing projects/settings stores. Existing and duplicate input IDs receive unused IDs under that transaction; Project additions use add, preventing overwrite. Settings and all Projects publish only at transaction complete. Abort/request error/transaction error/synchronous enqueue failure abort the entire transaction. Transaction and DB open are bounded to 15s. Memory repository stages all clones before its synchronous commit; it is not durable storage. Repositories without an atomic capability fail before per-project writes.

Cancel/signal abort, supersession, replacement repository and changed input are checked before publication and at request boundaries; active native transactions are aborted on explicit Cancel/supersession. Input is detached before async work. Cancel arriving after commit cannot roll it back: committed metadata is reported honestly, and stale/view-refresh-pending UI is separated from persistence outcome. UI Cancel and replacing Backup preview cancel an active operation. No saved-song fixture or actual Backup is accessed.

## Verification and limitations

Full Node regressions, all JS syntax and base diff whitespace must pass at final HEAD. New real Chrome cases at all three widths exercise abort, transaction error, native ConstraintError after an earlier successful request, late settings error, Cancel, AbortSignal Cancel, stale input, superseded operation, synchronous enqueue failure; each compares all old Projects and settings and verifies retry. Invalid second MIDI/dependency, legacy/editor-only fields and external binary statuses are exercised. Explicit completion/late-abort assertions remain.

Native quota/permission/OS crash/power loss failures are not established by injected events. Native ConstraintError is real, but is not quota exhaustion. IndexedDB transaction atomicity is not a guarantee against physical power loss. Unknown Take/Version/Checkpoint and arbitrary nested future binary dependency contracts remain unassessed.

Standalone retains the existing local script graph (Studio cache version 1.4.119 in both entries), browser IndexedDB or memory fallback. No Audio Helper, native wrapper, binary resolver or distribution changes. Static dependency inventory is re-evaluated; Helper/model/runtime/native/distribution/Japanese/touch/Mac/iPad physical acceptance is not inferred from browser CI.

## Exit gate and shortest next work

Stage 2 software/contract OPEN: reviewed binary persistence contract, exhaustive production binary resolver, full binary Backup and durable binary+metadata recovery, Take/Version/Checkpoint contracts, transitive runtime/distribution compatibility remain. Physical acceptance PENDING separately (Intel Audio-to-MIDI six-note accuracy, Helper signing/runtime, Keystation/Logic, Mac/iPad permissions/capacity/interruption/reload/Japanese/touch).

Formal A remains 0/30: no feature meets its complete formal acceptance through these storage/verification changes. Per-feature blockers remain in PRODUCTION_VERIFICATION_CONTRACT_V1.md and COMPLETION_MASTER_PLAN_V1.md. #22/#23/#25/#27 remain below A. Next shortest work: make the unresolved external-binary resolver/Restore boundary concrete under an approved storage contract, with explicit byte evidence and binary-plus-metadata rollback/recovery. Do not choose persistence, retention/GC, Cloud/provider/model policy independently. No Stage 3 transition.
