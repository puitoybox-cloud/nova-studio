# Creator-owned exit lifecycle and inherited private stop delivery

Checked 2026-10-07 JST. Base: freshly fetched Draft #323 exact
`7f717c6a3cbdfd463f97da992a5e2dfd3441bdd6`, tree
`75754ff10c6d2c6191107daf62df56c257a1770c`. #323 already existed, so
#322 was not the latest checkpoint. main and every existing PR remain untouched.

## Production change

`LocalProductionLifecycle.start` now creates an anonymous AF_UNIX stream pair
and passes only its child endpoint through actual `Popen(pass_fds=...)`. It closes
the parent's duplicate child endpoint immediately. Helper `main` installs the
receiver after existing authenticated runtime/source bootstrap. It imports the
already verified demucs-receipt source; no new unauthenticated source is loaded.
The child makes its endpoint non-inheritable again. No listener, filesystem socket,
new HTTP endpoint, browser credential, persistent credential or external network
is introduced. Existing result/admission HTTP and Swift APIs are unchanged.

The actual launcher stop now uses this retained endpoint, rather than retrying an
HTTP stop. It uses the existing Helper capability, not a parallel authority.
HMAC covers session, owner, assembly generation, original monotonic deadline,
request binding digest, fresh challenge and message direction. STOPPING must
match the exact request/challenge. The receiver closes the existing request
registry before responding. Duplicate JSON keys, altered/wrong-key/foreign/stale/
replayed/different-direction/different-request responses are rejected. Framing is
4096 bytes and the complete read has one total second, including fragmented input.
Post-session stop has a bounded ten-second shutdown-only window; processing
admission and the original processing deadline are never extended. EOF or invalid
private delivery closes admission and initiates graceful shutdown without
fabricating authenticated delivery evidence. Keys are erased on close.

Helper/Demucs exit observations now include an opaque registration identity,
registration monotonic timestamp (not an OS process-birth timestamp), initial
owned pipe/channel fstat identity digest, a per-registration kernel-echoed udata
cookie, retained-object identity validation,
pinned request binding and pre-stop authorization digest/timestamp. Pinned or
sealed bindings reject later request substitution. Actual launcher inherited
channel ownership is part of its observer. Demucs processing pins its existing
request immediately before dispatch and seals it before owned pipe EOF.

Both shutdown paths previously closed the exit observer even when bounded wait
expired with a live child. They now retain the observer and exact Popen object on
that timeout. Demucs repeated close can collect the eventual exact exit and release
the observer. Launcher final receipt remains terminal/immutable and PARTIAL on a
live timeout; retaining its observation does not retroactively complete its receipt.
No PID signal, process/group kill, global enumeration or live-handle promotion.

The existing final summary HMAC binds stopDigest and shutdownDigest, so the new
private stop identity and exact exit/ownership fields enter the existing summary
and audit path without changing the Swift summary schema or acknowledgement
protocol. Swift can verify those authenticated digests; it does not independently
inspect the full Python exit payload. Full installed Swift/launcher descriptor
handoff and final-summary/ack delivery remain SOURCE_ONLY/PARTIAL.

## Verification boundaries

Fourteen new tests use disposable fixtures. They cover the real launcher Popen
inherited-descriptor STOP/STOPPING and final PARTIAL summary, actual Helper receiver
admission closure, total fragmented-read deadline, channel rejection and descriptor
closure, request pinning, and Demucs timeout retention followed by actual owned
child exit. The existing macOS-only behavior test conditionally observes actual
kqueue NOTE_EXIT on macOS, without skip addition. Fixture ML assets are never
production assets. Native/network isolation and descendant closure are not proven.

Local Node 1831/1831, no skips; Python 324 total / 319 pass, five unchanged existing
missing-test-dependency skips. Full JS syntax, Python compile, shell syntax and
whitespace checked. Exact-head CI results must be verified after publishing; local
Linux is not macOS/Swift/iPad build or physical evidence. No test deletion, skip
addition or weakened assertion. No production dependency/model/binary acquired.

## Runtime / models / native / license

Existing #322/#323 executable-byte CPU verification and anchored manifest/installed
METADATA/RECORD/License-File assembly are preserved. x86_64 and arm64 candidate
resolvers remain fail-closed on actual executable/declared CPU mismatch; no Rosetta
fallback introduced. Private CPython/stdlib/site-packages/native extensions are not
present approved production bytes. Model slots retain expected revision/digest/size/
approval/runtime identity through the #323 actual shared assembly gate; Basic Pitch
and Demucs bytes remain MISSING. Native/shared architecture/edge/load-path/license
binding is existing scoped closure, not a completed installed native package.

No license decision is made in this change. Prior exact Basic Pitch weights
LICENSE_UNCONFIRMED and htdemucs_6s EXTERNAL_LICENSE_VERIFICATION_REQUIRED remain.
Source NOTICE inventory is not redistribution approval. No new dependency adopted.

## Primary API sources

Retrieved 2026-10-07 JST:
- Python 3.11 subprocess: https://docs.python.org/3.11/library/subprocess.html
  `pass_fds` explicitly selects descriptors kept open across child execution.
- PEP 446: https://peps.python.org/pep-0446/ — default non-inheritable descriptors
  and explicit subprocess descriptor inheritance.
- Apple kqueue manual: https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kqueue.2.html
  EVFILT_PROC/NOTE_EXIT is process exit observation. This archival page does not
  establish an exact interruption-capable handle for the current deployment target.

No safe current exact macOS signaling/live-descendant handle was established by
these sources or the repository. That adapter and hard interruption remain
UNVERIFIED, with no signal implementation. This does not claim no such API exists.

## Completion

A: scoped source work implemented and tested. B: approved private assets/models/
anchors and full installed Swift private delivery open. C: actionable user decisions
0. D: all physical acceptance pending. E: exact interruption/descendant handles,
full native isolation/dispatch/network proof unverified. Three scoped repository
work items addressed (sealed ownership binding, timeout retention, actual inherited
Helper stop delivery); no known unresolved blocker in those repaired behaviors.
This is not an exhaustive repository or product blocker count. Full delivery
closure remains unfinished. Formal A 0/30; Stage 2 OPEN; Stage 3 NOT_PASSED.

Next shortest safe checkpoint: bind full Swift-owned private final-summary and ack
into inherited/process-owned delivery using existing authority, and connect retained
late-exit evidence without reusing a finalized acknowledgement. Remain Draft.
Songs/real Backups were not accessed or changed. Physical-device byte equality
cannot be confirmed remotely. No Ready/Merge/Auto Merge/force push, system changes,
policy choices, signing/notarization/storage/distribution/PKI/retention/GC decisions.

ティアが今やること：ありません。次のWorkへ進めます。
