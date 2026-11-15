# Swift private final summary and launcher acknowledgement

Verified source scope: 2026-10-07 JST. Base is the fresh GitHub #325 exact
95287bd846009004e705f267e965510cce56a455, not a duplicate #324 delivery patch.

## Production code

`prepare()` now exposes its existing runtime-bound native launch adapter.
An explicitly supplied `NOVA_NATIVE_WRAPPER_PATH` must resolve through the
existing authenticated `native-wrapper` native binding. No executable/PATH,
distribution, anchor or signing policy is selected. Immediately before native
Popen, existing source/whole-assembly preflight, executable actual Mach-O/ELF
CPU validation and runtime recheck run again. Missing native binding is a hard
failure; assets are not downloaded or inferred from CI builds.

`OwnedNativeSummaryDelivery` creates an anonymous AF_UNIX socketpair, passes only
the child descriptor to the native Popen, closes its local inherited reference,
and retains the actual Popen and parent socket/fstat identity. The native startup
environment supplies the descriptor independently of the browser handoff.
The adapter becomes the existing `LocalProductionLifecycle.final_sink`.

Swift startup adopts an anonymous connected stream descriptor with its own
duplicate, CLOEXEC/nonblocking behavior and local SO_NOSIGPIPE. The WebView host
requires this channel for private owned startup. After the authenticated stop
response, a retained owner/channel reads the final summary on a background queue,
including when the view is being dismantled. There is no HTTP summary endpoint,
public socket pathname, persistent summary, browser authority or external network.

The channel reads a four-byte big-endian length before allocating at most 16 KiB.
It uses fstat continuity and poll under one monotonic 9.5-second budget. Existing
`receiveShutdown` validates HMAC, owner/session/request/result binding, completion
state and audit chain/generation and consumes the summary once. Its existing signed
acknowledgement is framed back over the same descriptor. Python sends and receives
under one 2.5-second budget and the existing three-second final-ack deadline.
`acknowledge_final_lifecycle` rejects foreign/generation/contract/digest/stale/replay
acknowledgements. No new authority or credential is introduced.

Production eligibility now requires an actual retained native private delivery
adapter and live native Popen plus the Helper private stop path. Browser-only
production cannot pass this gate. Delivery failures become FAILED/PARTIAL. Only
an authenticated COMPLETE summary plus validated acknowledgement can set launcher
state CLOSED. A valid PARTIAL acknowledgement remains PARTIAL.

## Evidence and limits

Disposable actual native-style Popen tests exercise inherited framing, authenticated
summary and final acknowledgement, foreign generation, EOF/truncation/oversize,
one-shot closure and missing-child rejection. Swift tests exercise actual anonymous
socketpair bytes through the existing lifecycle validator and back to its peer,
including audit/digest binding and PARTIAL preservation. These are software tests,
not installed native ML/device/distribution acceptance. Full packaged Python-to-Swift
application execution with approved resources remains PARTIAL/MISSING.

Existing #324/#325 Helper stop, retained observer/cookie/NOTE_EXIT and late Demucs
exit evidence are preserved. Final summary authenticates their existing shutdown
and stop digests. Deeper descendant state is not inferred from a leader's exit.
Full descendant closure remains PARTIAL. No interruption-capable exact Darwin
handle has been established: scoped interruption remains UNVERIFIED and no signal
adapter is activated. No process/group kill, PID guessing or process enumeration.

Private CPython/dependency/native/model assembly gates remain unchanged. Approved
packaged runtime/model/native-wrapper assets are MISSING. Basic Pitch weights:
LICENSE_UNCONFIRMED. Demucs htdemucs_6s:
EXTERNAL_LICENSE_VERIFICATION_REQUIRED. No new license/dependency adoption.

A: scoped software integration; B: approved assets/full installed integration open;
C: user decisions 0; D: physical acceptance pending; E: exact interruption/deeper
native proof UNVERIFIED. Formal A 0/30; Stage 2 OPEN; Stage 3 NOT_PASSED. Known
remaining defects in repaired private framing/ack behavior are subject to exact-head
CI; exhaustive repository-only blocker count cannot be confirmed. This does not
relabel fixtures, simulator builds or an uninstalled binary as production acceptance.

Primary documentation checked 2026-10-07 JST:
- https://docs.python.org/3/library/subprocess.html : pass_fds / retained Popen
- https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/recv.2.html : partial reads, EOF, nonblocking socket semantics

No main/#324/#325/earlier PR write, Ready/Merge/Auto Merge/force push, provider/AI
API, model/binary download, user-song or real-Backup access. No system-wide,
storage/distribution/signing/notarization/PKI/retention/GC policy selection.

Next checkpoint: exercise this exact native private summary/ack channel in an
approved installed assembly when its authenticated native/runtime/model slots are
available; meanwhile repair any source/CI failure without manufacturing CLOSED.

ティアが今やること：ありません。次のWorkへ進めます。
