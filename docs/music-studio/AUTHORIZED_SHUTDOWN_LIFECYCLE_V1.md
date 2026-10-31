# Authorized processing and bounded shutdown — 2026-10-06 JST

Independent Draft from #315 exact HEAD d244983a4643490e8a8fedf501cdb65cb6299ecf. Main and existing PR branches are not edited.

## Implemented repository path

Private launcher capability -> Swift WebKit main-frame handler -> `authorize` -> owner/session/request/input/inventory/contract/deadline/generation-bound one-shot ticket -> browser upload -> Helper streamed input hashing -> private authenticated `/owned-helper-admit` -> exact binding recheck -> processing receipt -> private result publication -> Swift result polling -> actual output bytes SHA-256/length acceptance -> authenticated stop -> bounded launcher shutdown -> private final receipt sink.

`begin` cannot authorize production admission. The production launcher rejects that action. Legacy channel fixture tests remain supported but never receive an admission ticket. The Helper rejects missing tickets before input reading, and consumes admission only after actual input hashing, before backend entry. Replays, stale capability generations, changed inventory/contract, foreign input/request/session, expired tickets and cancelled sessions are refused. No UI label is identity evidence. Inventory hashing includes scopedNativeLoads in Python and the browser.

Swift keeps private capabilities outside JavaScript. Only a main frame at the configured numeric loopback origin can call the reply bridge. Its JSON request names the exact input identity and inventory/contract. The page receives only the one-shot processing ticket. The Helper still authenticates that ticket through its separate private capability: forging a JavaScript bridge object cannot authorize processing.

Output bytes are independently hashed in Swift and compared with the authenticated owned result before acceptance. Acceptance consumes result authority; only stop remains usable. Stop is a separate authenticated command, not implicit result completion. Existing two-renewal/original-deadline limits are retained. The WebKit owner schedules at most two renewals, 15 seconds apart while processing; result/stop cancels pending renewal. It never retries uncertain delivery or extends the original deadline. Concurrent/expired authority fails closed.

The existing native-network adapter-unavailable browser gate remains closed. Real assembled runtime inventory/native proof cannot be replaced by synthetic test booleans. These are production-shaped connections behind the existing fail-closed gates, not evidence that real ML processing has been unlocked or physically accepted.

## Shutdown and interruption

Launcher close first refuses further admission, attempts authenticated Helper stop, waits at most three seconds, closes its local serving socket/thread, invalidates capabilities, and signs a detached final summary with the initial private owner capability using HMAC-SHA256. The summary binds session/request/binding, accepted result, stop/shutdown digests, transport close, capability invalidation and descendant evidence. Its separate private sink is supplied explicitly by an approved native launcher adapter; no transport is reopened after close and no browser endpoint serves this summary.

Swift `receiveOwnedShutdown` authenticates and checks exact owner/session/request/result binding and consumes the summary once. A complete claim without admission closure, zero proven descendants and closed/invalidated transport fails. A valid PARTIAL summary yields SHUTDOWN_PARTIAL, never VERIFIED. STOPPED on the Python launcher/control object means its local teardown has returned; `shutdown_state` and signed `completionState` determine strict lifecycle closure.

The current launcher has no approved descendant live-handle observer, so final shutdown stays PARTIAL (or FAILED). Leader reaping, sending stop, pipe EOF and a closed server socket cannot prove native-owned grandchildren or in-flight HTTP handler threads have terminated. No current production path emits COMPLETE. The native final sink is an explicit adapter API, not an installed distribution/IPC choice; its concrete private delivery remains pending.

Demucs resident-child close now sends EOF on its own pipe and waits boundedly. PID terminate/kill escalation is removed. A hung handle is retained and shutdown stays unverified; stdout is not synchronously closed while a live reader may be blocked. A locked one-shot `OwnedChildInterruptionAdapter` checks exact opaque object identity, owner, fresh challenge, live-handle scope and operation budget before invoking an externally trusted provider. There is no OS signal implementation. An arbitrary Popen/PID is not accepted as proof. Providers must independently establish ownership at operation time and are not installed/enabled here.

## Native evidence

Existing streamed 64 KiB digest verification/cache, Mach-O/ELF routing, scoped loader attempts/transitions, Python dispatch, CPython C-boundary, model/codec and processing aggregation are retained. Scoped native networking lookup denial adds c-ares, asynchronous resolver, curl polling and selected TLS/Apple host gateway names. This is lookup denial in owned Python audit scope only. Cached symbols, CFFI/direct C/C++, worker threads and syscalls are not fully contained.

Python entry/return and CPython C-boundary events are OBSERVED. Runtime load attempts/mapped observations remain OBSERVED_UNVERIFIED. Internal decoder/resampler/Basic Pitch/Demucs/torch/codec/writer kernels, authenticated successful loader parent/child edges, mapped-memory integrity, hidden/transient loads and complete native networking remain UNVERIFIED. No new successful native kernel execution proof is claimed.

## Stage 2 categories

`stage2_software_closure` is an advisory contract checklist with explicit A/B/C/D/E rows. It is not runtime eligibility authority and never grants formal A or Stage 3 admission. Its caller must supply reviewed source/test evidence; user labels/booleans are not native proof.

| Category | Requirements / status |
| --- | --- |
| A: safely implementable in repository | Swift authorization binding, one-shot Helper admission, byte-bound output acceptance, authenticated final summary and PARTIAL rejection, safe interruption provider contract, scoped evidence integration: implemented with disposable regressions. Bounded Swift renewal scheduling is connected. A concrete private launcher-to-Swift final receipt delivery installation needs an externally approved native adapter; the source contract/sink/validator are implemented, installation is not claimed complete. |
| B: approved backend/assets | Approved assembled runtime/model/codec/native assets and anchors; real backend linkage; durable publication/reload/recovery/cleanup/quota adapters. Pending. |
| C: policy | Storage A/B/C, distribution, signing/notarization/PKI, licenses, retention/GC. No choice made. |
| D: physical acceptance | Intel Mac, Apple Silicon, iPad/Safari, Gatekeeper/notarization, actual native isolation/ML/performance, six-note accuracy, Logic and Keystation. PENDING / UNVERIFIED. |
| E: unproven within current safe runtime boundary | Internal kernel identity; successful authenticated runtime loader edges; hidden/transient native loads; complete native-network/syscall containment; descendant live-handle observation/interruption provider. UNVERIFIED. |

Remaining safely implementable repository work: browser >64 MiB streaming-input hashing, currently rejected by an explicit 64 MiB budget. Private launcher -> Swift final-summary delivery/acknowledgement requires an approved native adapter and transport/distribution decision (B/C), with source sink/validator implemented. These are distinct from approved backend/policy/physical requirements and the current native/OS proof boundary. Stage 2 OPEN, production PARTIAL, formal A 0/30, Stage 3 NOT PASSED.

Tests never access saved songs or real Backups. No external AI/provider calls, model/binary downloads, system-wide settings, destructive migrations, Ready/Merge/Auto Merge or force push. CI/SIMULATOR success is not physical acceptance.
