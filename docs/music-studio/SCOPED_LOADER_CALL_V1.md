# Scoped loader call evidence v1 — 2026-10-06

Independent Draft from #312 exact HEAD a43af2d282e50b229a2828e4be2de3b102b5c2c1.

Production ProcessingReceipt.call (already used by Basic Pitch, Demucs and codec adapters) now opens a bounded, thread-local ctypes audit window around the authenticated actual Python entry call. Declared artifact path matching is lexical against only trusted root spellings; the actual declared file is streamed through the existing verifier before permitting a requested load/lookup attempt. Undeclared, ambiguous, unrequested, invalid-artifact and overflow operations fail closed. A backend catching PermissionError cannot erase the rejection. Failed calls retain their attempt evidence; windows always release. Hook installation is once per owned process and inert outside a window. No global OS inventory, firewall or sandbox mutation.

Every call has a fresh scope/sequence/source/contract digest. Audit attempts bind parentCall and child logical identity, artifact digest and ordering. They are **PRE_OPERATION_ONLY**, never authenticated successful runtime loader parent/child edges or actual native execution proof. Python audit is not a tamper-proof native observer. Direct C dlopen, worker threads, cached symbol calls, unloads and hidden/transient loads remain UNVERIFIED. No OS loader enumeration or static graph promotion is used.

Before/after receipts classify expected, newly observed, still observed, disappeared, unexpected, unresolved and ambiguous identities. Loads which appear and disappear between snapshots remain unobserved. Transition receipts bind both observation digests and the unchanged contract revision. Processing native stage aggregation binds all actual call evidence by stage; incomplete loader evidence, mismatching call identity, rejected attempts, changed/disappeared/partial load evidence cannot satisfy strict processing eligibility, even with VERIFIED stage labels. Native identity remains OBSERVED_UNVERIFIED or UNVERIFIED.

Owned Helper and owned Demucs child use the existing OfflineRuntimeGuard. ctypes network symbol guard additionally normalizes ASCII bytes and Darwin symbol suffixes, rejects ordinal lookup, and blocks selected DNS/resolver/socket/TLS/syscall gateways. This is only Python-to-native lookup containment. Pre-cached functions, C/CFFI dispatch, direct socket/DNS/fetch/syscalls and real ML native isolation remain UNVERIFIED. No COMPLETE network claim.

## Completion boundaries

| Category | Result |
|---|---|
| Software added | bounded call audit guard, digest-bound attempted edges, snapshot transitions, per-stage aggregation, stricter eligibility and lookup guard |
| Runtime loader parent/child edges | UNVERIFIED; pre-operation calls cannot prove successful load or dependency cause |
| Basic Pitch/Demucs/torch/codec actual native dispatch | UNVERIFIED; authenticated actual Python entry call only |
| Mapped-memory integrity / hidden-transient coverage | UNVERIFIED |
| Native syscall/socket/DNS/fetch containment | UNVERIFIED; lookup guard PARTIAL |
| Stage 2 | OPEN; production binding PARTIAL |
| Formal 30-feature A | 0/30, unchanged; none has all production/backend/policy/physical evidence |
| Stage 3 gate | NOT PASSED |

The authoritative 30-feature matrix and production component matrix remain in PROCESSING_CLOSURE_V1.md; this scoped change does not satisfy any missing full acceptance contract.

Backend blockers: approved assembled assets, anchors, actual backend linkage, durable publication/reload/cleanup/quota adapters.
Policy blockers: storage A/B/C, distribution, signing/notarization/PKI, licenses, retention/GC decisions.
Physical blockers: Intel Mac, Apple Silicon, iPad/Safari, Gatekeeper/notarization, real native isolation, real ML/performance, six-note Audio-to-MIDI accuracy, Logic and Keystation. CI/Simulator is software evidence only.
Other software blockers remain: successful runtime edges, mapped integrity, hidden/transient direct native observation, native containment, actual internal ML dispatch, Swift-owned anchored result/stop channel/renewal/hard interruption, browser >64 MiB streaming hash and unsupported native formats.

No changes to #312/main/older PRs, user songs/Backups, storage schema or policy. No model/binary downloads, live provider or external AI calls. Existing CI packaging/signing tooling is unchanged and does not determine distribution policy.
