# Owned result and stop lifecycle v1

Date: 2026-10-06 JST. Independent implementation from #314 exact HEAD
24730636102cdec68b952bc5834be50a94b00a5b. No distribution/signing/PKI policy selection.

## Implemented software boundary

The launcher creates separate random 256-bit browser, Swift control, and Helper
result capabilities. An explicit injected native-host adapter receives a detached
private handoff; the default system-browser adapter never receives the control
capability in a URL. Swift startup strips `ownedControl` before WebKit injection.
The wrapper keeps its control credential outside JavaScript and uses ephemeral
URLSession, numeric loopback, exact endpoint, no redirects, a 2-second request /
3-second resource timeout, and a 4096-byte response budget.

Swift owner commands are serialized and one-shot by session and increasing sequence.
Begin binds request, input identity, and complete runtime/model/codec/native/network
inventory. The Helper publishes only after strict processing receipt consumption.
The private Helper route requires its separate capability. The launcher rechecks
live Helper/session identity and strict eligibility, recomputes the processing
aggregator, and rejects changed, missing, partial or mismatched chains. Result
retrieval is one-shot; acceptance binds result ID and the actual Swift-supplied
output bytes hashed in 64 KiB chunks. Acceptance closes processing authority and
requests teardown. Duplicate/replay/foreign/expired/cancelled results fail closed.
No uncertain transport operation is automatically retried.

Capabilities initially last at most 20 seconds. Two renewals at most rotate only
Swift authority and add at most 20 seconds each, bounded by the original session /
Helper deadline (currently 60 seconds). No new request/session or Helper lifetime
can be acquired by renewal. Monotonic checks are authoritative; wall deadlines are
fixed at creation and cannot change through clock drift. Server startup no longer
extends an already-issued Helper deadline.

Swift stop uses the private native channel; the launcher sends an authenticated
one-shot `/owned-stop` to the owned Helper. The Helper invalidates request admission
and sets a cancellation event checked before/final processing acceptance. Graceful
STOPPING is an acknowledgement, not proof that native work or descendants exited.
Unexpected Helper termination invalidates the channel and signals teardown.

## Interruption limits

The former launcher process-group SIGTERM/SIGKILL path is removed. A leader PID or
past Popen ownership cannot safely prove descendants or guard against PID reuse.
Default shutdown performs an authenticated graceful request plus bounded wait only.
An injected live-handle interruption adapter must independently verify opaque owner,
current live handle and owned descendants and return a matching receipt. No OS signal
implementation is installed; even a fixture adapter is OBSERVED, not VERIFIED.
Leader reaping does not release descendant ownership. Incomplete teardown remains
UNVERIFIED with `ownershipReleased=false`, and an unresponsive Helper yields FAILED.
The listening transport may be STOPPED while descendant shutdown is UNVERIFIED.

## Native dispatch, loader, network

Exact Python profiling now also captures bounded `c_call` / `c_return` /
`c_exception` pairs while the owned Python call is active. Operation ordinals and
bounded diagnostic module/name strings are attached to the fresh call digest.
Budget is 256 native boundary events; observer change, exception, unmatched return,
or incomplete window is partial. This observes the CPython-to-C boundary, not the
identity or internal execution of decoder/resample/Basic Pitch/Demucs/torch/codec/
writer C/C++ kernels. Types, cached CFFI calls, direct C calls and worker threads may
be invisible. No boundary name is treated as an authenticated native identity.

A new network permission permits exactly one connect of one existing socket object
in the owned thread to a caller-validated numeric 127.0.0.1 endpoint. It permits no
DNS, external target, second socket/connect, nested permission or general bypass.
This is solely for the private Helper result transport; native containment remains
PARTIAL/UNVERIFIED. The existing native symbol lookup denial and Mach-O/ELF routing,
64 KiB artifact verifier/cache, mapped receipts and loader observations are preserved.

Static routing is not an actual runtime parent-child loader edge. Hidden/transient
loads, unload, workers, cached symbols, direct C/CFFI and mapped-memory integrity
remain UNVERIFIED. No native evidence is promoted through labels or recomputed hashes.

## Remaining completion blockers

Pure software: approved concrete launcher-to-Swift launch adapter; browser processing
request/output handoff to the explicit Swift owner API; authenticated final shutdown
receipt and proven live-handle descendant interruption; integration of observed native
operation with authenticated artifact/loader/kernel identity; actual runtime edges,
unload/hidden/transient/worker coverage; mapped page integrity; native syscall network
containment. Private result publication changes Python audit counters; a future native
containment adapter must supply a compatible stable authority/transport receipt. The
current exact inventory binding rejects changed evidence rather than ignoring counters.
The 60-second Helper deadline cannot support longer ML work without an approved bounded
session lifetime design. Current strict production processing stays blocked.

Backend: real approved ML/codec/native assets and concrete backend binding; no model or
binary downloads performed. Policy: distribution, signing, notarization, PKI, storage,
license, retention/GC remain undecided; no such policy is selected here.

Physical: Intel Mac, Apple Silicon, physical iPad, Safari, Gatekeeper/notarization,
actual network isolation, real ML/performance, six-note conversion, Logic and Keystation
are PENDING/UNVERIFIED. CI and simulators cannot satisfy these acceptance gates.

Evidence distinction: contract/source/disk checks can be VERIFIED within their scope;
actual Python entry/return and graceful acknowledgement are OBSERVED; CPython C boundary
and mapped/loader observations are OBSERVED_UNVERIFIED; production lifecycle/containment
is PARTIAL; internal native/kernel/runtime edge/shutdown coverage is UNVERIFIED.
Formal A remains 0/30. Stage 2 OPEN; Stage 3 gate NOT PASSED.

Tests use disposable fixtures. Existing tests/skip assertions are preserved; the prior
synthetic processing HTTP fixture now publishes its consumed result into a disposable
owned channel and additionally asserts that channel state. No user song/Backup mutation.
