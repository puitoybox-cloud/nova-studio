# Disposable durable recovery evidence — 2026-10-04 JST

## Result

Stage 2 remains open; formal A stays 0/30. This checkpoint adds actual temporary filesystem writes and independent-process reload/recovery to #295's observed-byte gate. It selects no production storage A/B/C policy. Product loaders, schema, saved songs, real Backup and existing PRs are untouched.

`scripts/music-studio-disposable-durable-backend.js` creates its own marked `os.tmpdir()` directory. Each test owns and disposes only that directory. Caller-supplied production paths are rejected. The test-only format is not a product manifest/migration proposal. Generations retain previous binary copies; there is no production retention/GC/dedup rule. One shared graph binary ID is written once per generation and all Take/Version/Checkpoint edges remain in the snapshot.

The explicit #294/#295 closure and byte gate runs before writing. Captured copied bytes are staged in generation files, file descriptors fsynced, a manifest written/fsynced, then a verification digest commit marker written. A partial pending marker does not publish. Rename followed by directory fsync creates the commit boundary. Reload independently measures and hashes every byte; missing/truncated/changed binary or manifest/marker rejects the entire generation. Recovery selects the latest fully validated committed generation, otherwise the earlier valid generation, or an explicit no-valid-generation result. It never publishes partially validated binary maps. The hash is verification-only observation comparison, not production logical content identity or cryptographic authenticity.

Deterministic phases: before-write, during actual partial binary write, after-write, before-commit, during pending commit record, before-publication, after-commit before reload, and reload. Failure injection covers interruption, synthetic permission/capacity errors, Cancel and retry. Child processes terminate at each precommit boundary and after commit; independent fresh Node processes recover the expected whole old/new state. Missing binary, equal-length changed bytes, truncation, manifest/marker corruption and shared referrer omission reject. Stale caller snapshots refuse commit. Cancel after commit cannot undo a durable commit: the report explicitly says committed/reload-pending. A read failure never authorizes rollback or deletion of already committed bytes.

This is a trusted, single-writer disposable Linux experiment, not a hostile-path sandbox, concurrent production transaction engine, browser IndexedDB implementation or power-loss test. Injected errors do not establish real OS permission revocation or disk exhaustion. Temporary generation copies, metadata and runtime overhead are excluded from the synthetic byte budget. Previous state recovery requires a still-readable previous valid generation; if all generations are unreadable it reports no valid generation rather than inventing a fallback. No cleanup/GC occurs during save/recovery.

## Stage 2 exit gates

| Gate | Evidence now | Production/physical remainder |
|---|---|---|
| dependency closure | Declared graph/source-package comparison, shared referrer omission rejection | Exhaustive real Project/Take/Version/Checkpoint resolver and approved dependency contract |
| byte observation | Independent source/package bytes, length and verification digest comparison; persisted bytes reread in fresh process | Production resolver and logical content identity remain pending |
| missing/corrupt | Missing/truncated/equal-length mismatch/manifest/marker rejection, old valid generation retained | Real production asset paths and full Backup completeness |
| capacity/permission | Synthetic budget boundary and per-phase fault injection | Actual quota/peak memory/free space and permission lifecycle |
| interruption | Partial binary/commit records, terminated child, fresh-process recovery | Browser/Helper process crash, OS crash, power loss on supported devices |
| atomic publication | Test-only marker boundary; complete validated generation or earlier valid generation | Approved production persistence contract and backend implementation |
| reload/recovery | Actual disk files and independent Node reload, corrupt latest fallback, retry | Production reload/recovery and migration; device acceptance |
| shared reference safety | Four Take/Version/Checkpoint references retained; failed/corrupt candidate cannot damage earlier generation; omitted referrer rejected | Production exclusion/deletion/GC policy and operations remain pending |
| Standalone boundary | Existing direct script/style inventory and existing browser regression | Exhaustive runtime/transitive/model/license/distribution compatibility, Mac/iPad |
| Backup/Restore boundary | Synthetic package closure and durable test-only generation recovery | Current metadata Backup is unchanged; full production binary Backup/atomic Restore pending |

**Stage 2 cannot finish from this evidence.** Synthetic/disposable, production and physical outcomes must remain separate. No feature is promoted to A solely for added test counts.

## Shortest next route

1. Bring the existing A/B/C comparison and unresolved identity/Take/Version/Checkpoint/Backup contract to one reviewable decision. Do not silently select it. Until reviewed, production binary writes remain blocked.
2. After that decision, reuse existing repository and #293–295 guards for an exhaustive production byte resolver and contract-specific transaction adapter in disposable storage. Run the same write/commit/reload matrix against that actual adapter, including migration, all referenced bytes and shared deletion/exclusion behavior.
3. Close Standalone runtime/distribution dependencies and run one consolidated physical batch. Only then reevaluate Stage 2. It cannot honestly be guaranteed to finish in one next Work while these decisions and device evidence are absent.

## Consolidated physical pending

Intel Mac Chrome and M1 iPad Safari: separate disposable synthetic project; real permissions/reselection, capacity, interruption/reopen/recovery, complete Backup migration, Japanese/touch layout. Never inject faults into saved songs or real Backup. Intel Audio Helper signing and actual Audio-to-MIDI six-note accuracy, Keystation recording/playback and Logic round trip remain their existing pending gates; this Node experiment establishes none of them.

## Verification

Local full `node --test`: 1510/1510 PASS, FAIL/skipped 0; 46 new durable cases. Existing tests retained. All 148 JavaScript syntax checks and whitespace checks required. Exact-head CI retains existing real Chrome 1440/820/390 smoke and console/error/warn/pageerror/external request monitoring. Final CI status must be read from the new PR's exact HEAD, not copied from #295.

Start audit: `verification/music-disposable-durable-start.json`: main 552d56eafddfd192970c09f7d6278696cf8775c3, 42 Open / 40 Draft; all Drafts mergeable with returned HEAD Actions success. Non-Draft #10/#35 conflicting with no returned HEAD runs. No #296+ was present. Base #295 120b4527780bbfe00b164875c57f852c4055cc9a.
