# Production asset/linkage inspection — 2026-10-06

Baseline: #317 `8b1a4640be4960e99a8e040caf6615f3a68bc72e`.
This is an observation report, not a new approval contract or eligibility authority.

## Actual integration change

The existing `prepare` launcher now authenticates all twelve existing Helper/adapter
source identities, rather than four. It retains their exact disk generation and
externally declared identity and rechecks them, the Python executable and runtime
stamps immediately before the production `Popen`. Same-size mutation, replacement,
symlink substitution or stale runtime aborts before child creation. The callback
is private in-memory launcher state and is not serialized in the browser envelope.
No anchor, model, runtime, credential or installation is manufactured.

The actual final merged MIDI `mido.MidiFile.save` now passes through the existing
request-scoped `ProcessingReceipt.call` in strict mode. The callable's module/file
identity must pass existing import evidence before write. This records the writer
that produces the final output, rather than only Basic Pitch's intermediate writer.
An absent approved mido entry fails closed. Native routes still require the existing
authenticated `processingNativeRoutes` declaration; a new logical call label does
not invent native identity. Legacy behavior is preserved.

Disk checks are not atomic exec/mapped-memory proof: the OS/runtime interval after
preflight remains unverified. No ownership or native evidence is promoted.

## Asset observations

`verification/music-production-assets-20261006.json` lists 39 actual source/fixture
resources, exact SHA-256 and size, package recipe membership and identity scope.
The tracked repository contains no .onnx/.pt/.pth/.ckpt/.tflite model or
.dylib/.so/.dll/.exe runtime payload. This extension search is scoped evidence;
it does not prove every arbitrarily named file is incapable of containing a model.

The existing Helper CI recipe packages seventeen resources: twelve authenticated
adapter sources; helper_identity.py; requirements.txt; STOP_AUDIO_PIPELINE.command;
Info.plist; NovaMusicAudioHelper. It contains no copied ML model, Python runtime or
third-party native library. CI now checks actual copied bytes against the selected
checkout before existing signing/ZIP steps, emits their hashes and stores
`Contents/Resources/packaged-source-inventory.json` in the actual bundle. Its
`OBSERVED_PACKAGE_BYTES` label does not mean approved anchor/license or runtime load.
The existing signing method and distribution mechanism are unchanged.

The Swift resources are build inputs. The MIDI/WAV fixtures and owned-audit JSON
are test evidence; none is an ML model or production trust anchor. Git source
version and requirements ranges do not establish installed backend versions.
The repository license register is still awaiting approval and supplies no
approved redistribution evidence for the required third-party backend assets.

## Production chain

| Stage | Reachable production source | Remaining evidence |
| --- | --- | --- |
| browser | immutable Blob hashing, admission upload, authenticated result/output acceptance | actual approved local web manifest/build provisioning |
| Swift | startup handoff validation, owned authorization, result/stop, final summary validator | installed native handoff/final delivery adapter |
| launcher | prepare -> new exact Python command -> owned lifecycle | external manifest/anchor and approved Python runtime; system-browser main does not instantiate Swift |
| Helper/Python | strict bootstrap, inventory, request binding, new spawn source preflight | approved assembled runtime; strict readiness remains closed |
| decoder/resample | soundfile/librosa/julius receipt adapters and production calls | exact-version source/native codec/resampler closure and backend observations |
| Basic Pitch | retained authenticated model passed to predict; actual callable observation | approved model/companions plus exact loader/inference package closure |
| Demucs | resident authenticated child/session and retained model adapter | approved htdemucs weights/companions, child config and loader closure |
| torch/native | declared routing, scoped image/loader/C-boundary observations | approved torch/torchaudio/native closure and actual internal kernel proof |
| writer/output | intermediate writer plus actual final merged writer -> output bytes -> request/result binding | approved mido/pretty_midi writer import closure; actual approved end-to-end processing |

`estimate_bpm`, drum analysis and some note parsing remain ordinary library calls,
not proof of complete internal dispatch coverage. Existing scoped aggregate receipt
must not be read as an exhaustive trace of every internal operation.

## Private delivery and owned handles

`LocalProductionLifecycle.native_host` and `final_sink` are caller adapter hooks.
`MusicStudioWebViewHost.receiveOwnedShutdown` validates and returns the private
one-shot acknowledgement. Actual `main` selects a system browser, with no installed
Swift adapter. Swift views consume an externally supplied environment handoff but
neither instantiate this launcher nor receive its final summary. The Helper shell
wrapper does not implement that bridge. Thus final delivery/ack consumption is a
source path only, not installed production delivery. No existing approved private
pipe/XPC/socket adapter connecting these owners was found in tracked source.
No new public endpoint, secret exposure, credential file or transport policy is added.

The newly created Popen and Demucs owned pipes are retained. They prove local child
creation/wait or pipe ownership observations only. They do not constitute the exact
live-handle descendant provider required for safe interruption. The interruption
provider is absent, PID/group signaling remains unused, and descendant completeness
remains PARTIAL/UNVERIFIED. No process enumeration or system configuration change.

## Blocker reassessment

| Category | Specific outstanding requirement |
| --- | --- |
| A repository-only scoped #317 checklist | zero identified remaining entries; this is not an exhaustive claim about all future integration gaps |
| B approved backend/assets/anchors | Basic Pitch model+companions; Demucs htdemucs model+bag config; Intel/Apple Silicon Python runtime; basic-pitch/Demucs loader packages; torch/torchaudio native closure; numpy/scipy/librosa/julius resampler closure; soundfile/libsndfile decoder/encoder; mido/pretty_midi writer closure; approved runtime-config, runtime-closure, runtime evidence and Demucs child config; externally approved manifest/build/architecture anchor; installed Swift private delivery and durable storage adapter |
| C policy | storage A/B/C and durable adapter choice; approved local distribution/runtime layout and private transport ownership/bootstrap; signing/notarization identity; trust-anchor/PKI provisioning; model/dependency redistribution licenses and notices; retention/GC rules |
| D physical | Intel Mac, Apple Silicon, iPad, Safari, Gatekeeper/notarization, native isolation, real ML artifacts/performance, six-note end-to-end accuracy, Logic, Keystation all PENDING/UNVERIFIED |
| E OS/runtime | exact owned descendant live-handle provider; internal C/C++/torch kernel identity; successful authenticated runtime loader edges; mapped-memory integrity and hidden/transient image coverage; complete native socket/DNS/TLS/syscall containment |

VERIFIED applies only to scoped byte/contract tests with explicit fixture inputs.
Python/CPython boundaries are OBSERVED; mapped image/loader attempts are
OBSERVED_UNVERIFIED. Production integration/closure is PARTIAL; installed delivery,
real backend, native kernel/network containment and physical acceptance UNVERIFIED.
Formal A remains 0/30, Stage 2 OPEN, Stage 3 NOT_PASSED.

Next shortest safe checkpoint: supply approved local backend bundle plus external
manifest/anchor/license evidence, and choose the native private ownership/delivery
adapter. Then run actual package preflight/bootstrap/processing/output/final-delivery
against those bytes. Do not add a fixture model to manufacture completion.

## Validation scope

Local Node: 1831/1831 PASS, no failures/skips. Local Python: 266 total,
261 PASS, five preexisting unavailable-audio-dependency skips; no skip decorators
added, no tests removed/weakened. Full JS syntax, Python compile, bash syntax and
whitespace checks pass. Swift/macOS/iPad Simulator/Chrome rely on exact-head CI,
whose final IDs/results are reported in the Draft PR. Physical tests are not run.
Fixtures only; saved songs and real Backups were not accessed. Device byte equality
cannot be confirmed. main, #317 and prior PRs are not edited.
