# Native image routing and scoped processing evidence v2

確認日: 2026-10-06 JST. Independent Draft based on #311 exact HEAD
`3b5e04eb3d614e1b8ef6634e1141e07b9ae5a6db`.

## Production-shaped implementation

- Bounded thin/fat Mach-O 64-bit disk parsing. Fat32/Fat64 and both byte orders:
  at most 64 slices, file/table ranges, alignment, overlapping ranges, CPU/subtype
  header consistency, and exactly one declared CPU match. Multiple subtypes for
  the same CPU are ambiguous, not guessed. CPU selection is disk evidence only.
- ELF64 little/big-endian x86_64/arm64 program headers, PT_DYNAMIC, DT_NEEDED,
  DT_STRTAB/STRSZ, RPATH and RUNPATH. At most 1024 program headers, 4096 dynamic
  records, 1 MiB string/command buffers, 4096-byte names, 128 search paths, and
  4096 graph edges plus a terminal budget-failure entry. ELF32/extended headers,
  missing/ambiguous segments and unsupported filter/audit routes fail closed.
- RUNPATH takes precedence over that image's RPATH. Only explicit $ORIGIN,
  ${ORIGIN} and absolute candidates matching declared artifacts are resolved.
  No inherited RPATH, default search path, LD_LIBRARY_PATH, cache, cwd or $LIB
  inference. An unsupported search token or multiple candidates fails closed.
- Candidate expansion is lexical: no probing undeclared paths. Declared files
  retain before/after authenticated streaming digest checks. 64 KiB SHA-256,
  process-local verifier receipts/cache and exact invalidation are unchanged.
- Scoped observation joins exact declared RTLD_NOLOAD/dlinfo/dladdr handles with
  extension module origins inside declared namespaces only. Reports expected,
  observed, unexpected, unresolved and ambiguous separately. No process image
  list, system inventory, filesystem walk, PID search or global monitoring.
- Processing adapters validate IDs before backend execution, capture scoped
  before/after observations, reject changed contracts and unexpected/ambiguous
  loads, and bind evidence digests into the existing session/request/input/runtime/
  model/codec/network/output chain. Optional `processingNativeRoutes` in the
  authenticated contract maps logical call IDs to declared native IDs, with no
  inferred backend selection. Existing Basic Pitch and Demucs receipt calls use
  this adapter; decoder/resample/inference/stem/writer associations can be bound.
  This does not demonstrate their internal native dispatch or instrument torch.
- Owned Helper/child Python audit denies known networking ctypes symbol lookups.
  Exact-handle observer symbols remain usable. Only logical counts are retained;
  direct C/native socket, DNS or fetch calls remain unobserved. No system firewall,
  sandbox or OS settings are changed.
- Child wire summaries digest the whole scoped observation with category counts.
  Strict eligibility and final receipt gate reject partial scoped load coverage.
  Empty unexpected lists are never a completeness proof.

## Evidence classification

`VERIFIED_ARTIFACT`/`VERIFIED_ENTRY` applies only to authenticated disk/source
bytes. Observed mapping/declared static routing remains `OBSERVED_UNVERIFIED`;
runtime loader edges and mapped memory integrity remain `UNVERIFIED`.
Unexpected-load detection and ctypes dispatch guard coverage are `PARTIAL`.
Native network remains `UNVERIFIED`, nativeNetworkVerified=false. Processing
eligibility remains false for production evidence from these observers.

## Remaining pure software blockers

Authenticated loader parent/child edges and mapped memory integrity; hidden or
transient direct native load coverage; native syscall/DNS/fetch containment;
actual Basic Pitch/Demucs internal native stage dispatch including torch;
Swift-owned anchored result/stop channel, bounded renewal and hard native
interruption; browser streaming verification above 64 MiB. Unsupported routing
formats require additional bounded parsers before those artifacts are eligible.

## Separate blockers and acceptance

Backend: approved local ML/native artifact assembly, anchors, actual backend
linkage, durable binary/generation/selected-pointer publication/reload/cleanup/
quota adapters. No model or binary download was added.

Policy REQUIRED: storage A/B/C, distribution, signing, notarization, PKI,
dependency/model/provider licenses and retention/GC. No choice made here.

Physical PENDING/UNVERIFIED: Intel Mac, Apple Silicon, iPad, Safari, Gatekeeper,
notarization, real native network isolation, real ML artifact/performance,
six-note Audio-to-MIDI accuracy, Logic and Keystation.

Formal A remains 0/30 as at the #311 checkpoint. This change does not satisfy
production/backend/policy/physical acceptance. Stage 2 remains OPEN; Stage 3 gate
remains not passed. Main, #311, older PRs, saved songs and real Backups are not
mutation targets. The next checkpoint is this Draft's final exact-head CI, then
bounded ownership/authentication of runtime loader and processing dispatch proofs.

## Verification

32 new routing/observation/processing/network regressions. Existing tests are not
deleted, skipped or weakened. The old Mach-O fixture is corrected to 8-byte
command alignment with an explicit x86_64 architecture; all assertions remain.
Local Node: 1804/1804 PASS; all 174 tracked JS syntax PASS; whitespace PASS.
Local Python: missing soundfile/mido causes the existing five accuracy tests to
skip; the macOS Helper CI with its existing dependencies must run all tests.
Exact-head CI is authoritative for Swift/macOS/iPad Simulator and Chrome. CI
and Simulator do not replace physical acceptance.
