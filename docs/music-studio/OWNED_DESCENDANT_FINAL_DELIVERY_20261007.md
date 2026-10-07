# Owned descendant final delivery — 2026-10-07 JST

Fresh GitHub reads found #324 already present. Continue exact f909543081adcb7bef0254b0230ce825a319caf0, with all three Actions SUCCESS; preserve #323/main/all existing PRs. No new assembly contract or authority.

## Confirmed production gap and correction

The #324 Helper stop monitor closed its inherited descriptor immediately after STOPPING, before main closed the Demucs child. Launcher could not receive actual child cleanup evidence. Preserve that descriptor through main cleanup and return a bounded authenticated HELPER_SHUTDOWN frame on it. Use existing Helper capability, owner/session/assembly generation/deadline/request binding digest/challenge; consume final delivery before read and reject replay, foreign context, changed data, duplicate JSON, wrong capability, EOF and budget excess.

Actual server.main calls finish_owned_shutdown after admission closure/server teardown. This function acquires the existing PROCESS_LOCK for at most 0.5 seconds; busy processing is explicitly PARTIAL and no child cleanup is fabricated. When quiescent, reuse actual ChildSession.close: owned stdin EOF, at most three-second wait and retained creator-owned NOTE_EXIT observation. Deliver child nonce, parent processing binding and actual exit observation through the same private channel. Launcher reads it after bounded Helper wait, rechecks leader exit and includes it in existing authenticated shutdownDigest/audit summary. No new HTTP route, listener, credentials or browser authority.

An authenticated reported child exit is distinct from proof that all descendants closed. Every new Helper child report remains PARTIAL, ownedDescendantsComplete false and remainingOwnedDescendants null. No fixture promotes missing runtime/model/installed native assets. No safe interruption-capable identity has been established: hard interruption stays UNVERIFIED and no signal is sent. Existing Swift final-summary validation and one-shot launcher acknowledgement remain; installed Swift private delivery remains SOURCE_ONLY/PARTIAL, not implemented by this change.

## Verification

Seven added regressions: final one-shot state; authenticated foreign/tampered fields; framing limits/duplicate keys/EOF; expired/other-capability report; disposable actual Demucs EOF and exit; busy processing; actual inherited launcher Popen final delivery bound into authenticated shutdownDigest. macOS-only NOTE_EXIT assertion runs only when the OS provides kqueue, without adding test skips. Other OS tests continue checking actual disposable Popen reaping without claiming macOS kernel observation.

Final local full Node 1831/1831 PASS (no skips); Python 333 total / 328 PASS, five unchanged unavailable dependency skips. Exact-head CI recorded in PR after completion. All 175 JS syntax / 36 Python compile / three Helper shell syntax / git diff --check PASS at initial tested tree. No tests deleted, skips added or assertions weakened. Native Swift/builds/Chrome require exact-head CI; CI is not physical acceptance.

## Limits and next checkpoint

A: scoped delivery software repair verified locally; B: approved bytes/installed native delivery missing; C: actionable user choices zero; D: physical pending; E: safe live-handle/interruption/deeper-descendant proof unverified. Known repaired behavior gaps zero; exhaustive repository-only blocker count cannot be confirmed. Formal A 0/30; Stage 2 OPEN; Stage 3 NOT_PASSED. Next shortest safe checkpoint is installed Swift private final-summary/ack delivery through existing owner lifecycle, without introducing another authority.

Private CPython/runtime/native/model actual approved bytes absent. Basic Pitch weights LICENSE_UNCONFIRMED; Demucs htdemucs_6s EXTERNAL_LICENSE_VERIFICATION_REQUIRED. No license elevation or dependency adoption. No download/signing/notarization/PKI/storage/retention decision. Songs and real Backup were not accessed or modified.

Primary API evidence checked 2026-10-07 JST: Python https://docs.python.org/3/library/socket.html (socketpair, inherited descriptors, timeouts); Apple https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kqueue.2.html (NOTE_EXIT is event observation, not a signaling handle).

ティアが今やること：ありません。次のWorkへ進めます。
