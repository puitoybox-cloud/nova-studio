# Private runtime, license material and owned exit assembly — 2026-10-06 JST

## Result

GitHub starting reads found a newer safe checkpoint than the supplied comparison:
#321, `d0ecf98c932d2955eb0c6fea2c3401a4cc17a6e2`, Draft/Open/mergeable,
base #320 `9bf70a4289d4384c8010bee62b42d7a4538af74c`; all three exact-head
Actions completed SUCCESS. This independent branch continues that exact HEAD.
main remains `552d56eafddfd192970c09f7d6278696cf8775c3`.
The starting collection contained 68 Open PRs; #322 or later was absent.

Implemented actual existing assembly paths, not another approval/abstract contract:

- `verify_distribution_metadata` now checks every declared installed `License-File`
  against the same authenticated graph used for METADATA/RECORD verification.
  PEP 639 metadata 2.4+ resolves under `.dist-info/licenses`; older setuptools
  declarations resolve beside METADATA, labeled `LEGACY_METADATA_EXTENSION`.
  Reject missing/unlisted/tampered/symlink/unsafe/duplicate/overbudget material.
  This is file-inclusion integrity; declarations cannot grant redistribution.
- `verify_assembly` emits an exact notice-material inventory tied to dependency ID,
  version, artifact digest, approval status, and verified file paths/digests/sizes.
  Existing launcher and offline assembly verifier consume this existing report.
  No header means **NO_LICENSE_FILE_DECLARATION**, not no license obligations.
  The inventory is not a final legal NOTICE, and never approves native/model scope.
- `RuntimeInventory.resolve_executable` reuses #312's bounded Mach-O/ELF parser on
  the actual authenticated executable. A CPU label alone cannot pass. On Darwin
  the image must be Mach-O. Fat images require exactly one matching CPU slice.
  Record disk header evidence; loader selection, runtime version and mapped
  execution are not falsely promoted. Existing caller-selected anchored generation
  and current-CPU resolver remain the production path; no cache/PATH/Rosetta fallback.
- Immediately after actual Popen creation, both launcher/Helper and resident Demucs
  child register one process-owned kqueue `EVFILT_PROC` / `NOTE_EXIT` subscription
  when available. Registration precedes reader/supervisor threads. Retain the
  creator Popen object, creator process identity, child session and generation
  digest; bind processing request digest at observation. Reject foreign object or
  foreign creator. Close the private descriptor and hash observed evidence into
  the existing final shutdown receipt. No PID/address/descriptor goes to browser.
  On unsupported runtime, already-reaped child or registration failure, evidence
  remains UNSUPPORTED/UNVERIFIED. It is **an exit subscription, not a termination
  handle**, descendant census, native isolation proof or interruption capability.

All sources above are already included by existing seventeen-resource packaging
and launcher source preflight. No new transport, public endpoint, listener,
credential, signing policy, native installation path or production dependency was
added. `native_host`/`final_sink` remain uninstalled hooks; this work does not claim
installed Swift delivery merely because shutdown observation now reaches its
existing authenticated summary. Native capability gates stay closed.

## Primary evidence and model permission

All evidence is checked 2026-10-06 JST. The JSON companion records 22 freshly
retrieved primary UTF-8 source texts with URL, SHA-256 and byte length. Source
licenses, source build recipes and author comments are separate from actual
installed package bytes and model grants. Existing #320/#321 registers retain
65 exact metadata candidates / 110 dependency edges per Darwin profile; no
candidate becomes an approved manifest or installation lock here.

Basic Pitch 0.4.0 source: official versioned LICENSE is Apache-2.0, copyright
Spotify. Official README identifies bundled model formats, but its license
statement describes software. No dedicated exact `nmp.onnx` weights grant was
confirmed from the inspected owner repository/card. Source obligations: include
license, retain required notices, preserve applicable upstream NOTICE and mark
changes. Exact weights redistribution/commercial grant and applicable packaged
NOTICE remain **LICENSE_UNCONFIRMED / EXTERNAL_LICENSE_VERIFICATION_REQUIRED**.

Demucs 4.0.1 source: official versioned LICENSE is MIT; retain copyright and
permission notice. Actual official issue #327 comments were re-read. Author
`adefossez`, **2022-05-23**, excludes model weights from MIT and limits their
provision to scientific purposes. Later 2024 comments are questions/third-party
interpretation, not a new owner grant. Statement predates v4; no exact permission
for `htdemucs_6s` / `5c90dfd2-34c22ccb.th` was found. Bag YAML and checkpoint
registry provenance establish names, not redistribution rights. Commercial and
weights redistribution remain **EXTERNAL_LICENSE_VERIFICATION_REQUIRED**.
No model/checkpoint was fetched and no owner was contacted.

Primary links:
- https://github.com/spotify/basic-pitch/blob/v0.4.0/LICENSE
- https://github.com/spotify/basic-pitch/blob/v0.4.0/README.md
- https://huggingface.co/spotify/basic-pitch/blob/main/README.md
- https://github.com/facebookresearch/demucs/blob/v4.0.1/LICENSE
- https://github.com/facebookresearch/demucs/issues/327#issuecomment-1134828611
- https://github.com/facebookresearch/demucs/blob/v4.0.1/demucs/remote/htdemucs_6s.yaml
- https://github.com/facebookresearch/demucs/blob/v4.0.1/demucs/remote/files.txt

## Exact source license/redistribution material

These are source-text findings for reachable production candidates, **not approval
of actual wheel contents or model weights**. Exact sources/digests are in JSON.

| Candidate | Primary source license | Material/remaining scope |
| --- | --- | --- |
| CPython 3.11.17 | PSF v2 and historical agreements in LICENSE | retain full applicable license/copyright; include modification summary where required; separately inventory bundled extension libraries |
| torch 2.2.2 | BSD-style three conditions | preserve notices/conditions/disclaimer and no endorsement; each bundled native component still needs actual wheel closure |
| torchaudio 2.2.2 | BSD-2-Clause | preserve source/binary notices/conditions/disclaimer; no source grant assumed for separately shipped codec libraries |
| numpy 1.26.4 | BSD-3-Clause | include main license plus actually bundled component notices; source register lists lapack-lite BSD, tempita/dragon4 MIT, libdivide Zlib; build tools are not automatically runtime payload |
| soundfile 0.12.1 | BSD-3-Clause | Python wrapper notice separate from libsndfile and codec notices |
| libsndfile 1.2.0 recipe | LGPL 2.1 license text | actual embedded revision/link mode unverified; source/relink/replacement obligations need actual build, not just NOTICE text |
| Basic Pitch 0.4.0 | Apache-2.0 source | model permission separately unconfirmed; preserve applicable NOTICE and modification notices |
| Demucs 4.0.1 | MIT source | weights outside automatic source grant |
| mido 1.3.3 | MIT | preserve copyright/permission notice |
| pretty_midi 0.2.10 | MIT code | unused bundled TimGM6mb.sf2 remains separate packaging/license scope; do not approve whole unmodified distribution from code license |
| librosa 0.10.2.post1 | ISC | preserve copyright/permission notice |
| scipy 1.12.0 | BSD-3-Clause | preserve notice/conditions/disclaimer and no endorsement; actual BLAS/LAPACK/runtime vendor closure unverified |
| soxr 0.3.7 wrapper | LGPL 2.1-or-later | LICENSE separately lists libsoxr LGPL 2.1-or-later and PFFFT BSD-like attribution/no endorsement; exact compiled closure still unverified |
| julius 0.2.7 | MIT, exact revision 486c0329158ad6c137d18bcddc5461d493005c65 | preserve copyright/permission; tag v0.2.7 missing, do not guess a tag |
| ONNX Runtime 1.17.3 | MIT source | shipped third-party NOTICE/native closure still requires actual package files |
| numba 0.59.1 / llvmlite 0.42.0 | BSD-style source notices | compiled LLVM/vendor notices and exact native identities remain distinct |

No broad "commercial use OK" verdict is issued. Full 65-node license closure is
**not confirmed**; names/retrieval count are not a closure-completion percentage.
LGPL native redistribution can require corresponding source and replacement or
relink materials depending on actual linkage; collection of license text alone
cannot resolve that. Static codec revisions in #320 recipes differ from upstream
README declarations; the discrepancy remains open until actual bytes exist.

NOT_REQUIRED items from #320 stay outside the proposed strict processing closure:
external FFmpeg/sox executables, CUDA/NVIDIA/triton Mac payloads, unselected TF/TFLite
engines, training/test/docs/evaluation extras and unrelated model checkpoints.
Unconditional imports such as lameenc and upstream Darwin CoreML requirements
cannot be silently removed from an unmodified distribution. diffq's actual
checkpoint need remains undetermined. No production requirements were changed.

## CPython source-build assembly, each native CPU

Official release page confirms **3.11.17, released 2026-10-01**, source-only security
release; 3.11.9 was the final installer release. Therefore 3.11.17 remains the
current cp311 source-build **candidate**, not a selected/approved built runtime.
No more suitable exact cp311 release was established by these primary reads.

Use independently provisioned, exact-approved source checkout/build inputs on each
native architecture. Do not start acquisition, source compilation or binary
installation in this work. Existing CI setup-python/test venv is TEST_ONLY and
cannot be repackaged as the product runtime.

Concrete build recipe candidate from versioned CPython Makefile/configure docs:
caller-supplied private prefix, traditional Unix (non-framework) install,
`--with-suffix=` for the real `python3.11` filename, `--with-ensurepip=no` to avoid
implicit install/bootstrap, local `make` then `make altinstall` with caller-supplied
staging `DESTDIR`. No `/usr/local`, system Frameworks or default user storage is
chosen. SDK/toolchain/dependency inputs and deployment target need exact build
provenance. Framework/shared/static alternatives are not silently selected.
`DESTDIR` does not establish runtime relocatability: final prefix, interpreter
path discovery and all linked load paths still need actual Mac verification.

| Logical component inside an externally selected generation root | Assembly requirement |
| --- | --- |
| `runtime/bin/python3.11` | actual regular executable, approved version/build digest/size, current CPU Mach-O header; direct path, no symlink/PATH alias |
| `runtime/lib/python3.11/` | complete shipped stdlib files and LICENSE.txt copied by CPython Makefile; inventory actual final files, not directory existence |
| `runtime/lib/python3.11/lib-dynload/` | exact `_ctypes`, audio/numeric-reachable and all shipped extension files; per-file native routes/architectures/licenses |
| `runtime/lib/python3.11/site-packages/` | exact selected platform distributions, authenticated METADATA/RECORD, declared license files and complete footprint; `.pyc`/generated files must be explicitly accounted for |
| selected private shared libraries | if actually shipped, record identity, parent, origin, per-CPU routes, license/materials and approved manifest binding; Apple OS images remain system dependencies |
| model/bag files | explicit existing model/companions bindings; full actual digest/size plus separate weights permission, all currently missing |
| runtime config/closure/evidence/manifest | existing externally anchored schemas, no candidate JSON as anchor; inventory runtime, stdlib, distributions, native files and material bytes |
| notice material | original verified included files, identity-linked inventory; full native/weights and LGPL delivery materials require independent completion |

x86_64 and arm64 may share source version constraints and pure-Python source
material. Native executable, extensions, wheels, embedded libraries, linker
routes, actual digest/size, deployment targets and runtime-generation anchors must
be architecture-specific. #321's two 65-node/110-edge metadata graphs do not prove
runtime compatibility or byte identity. Universal2 source build is an upstream
option, not a justification to use one native wheel inventory for both CPUs.
Rosetta is not a prerequisite or fallback; actual translated-process rejection
and native Mac acceptance cannot be claimed from the current source-only bundle.

Sources (checked 2026-10-06):
- https://www.python.org/downloads/release/python-31117/ (release 2026-10-01)
- https://docs.python.org/3.11/using/configure.html
- https://github.com/python/cpython/blob/v3.11.17/Mac/README.rst
- https://github.com/python/cpython/blob/v3.11.17/Makefile.pre.in
- https://github.com/python/cpython/blob/v3.11.17/LICENSE
- https://peps.python.org/pep-0639/ (installed license-file layout)
- https://docs.python.org/3.11/library/select.html (non-inheritable kqueue descriptor)
- https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/kqueue.2.html (EVFILT_PROC/NOTE_EXIT)

## Private delivery / native closure / live handle limits

Actual routes reuse bounded Mach-O/Fat32/Fat64/ELF code and the authenticated
existing graph. Parent/origin/version/file/license are still supplied by explicit
inventory, not inferred from dylib names. No actual private runtime/native bytes
were acquired. Internal static libraries, successful loader edges, hidden or
transient native execution, native syscall containment, exact descendant handles,
installed Swift↔Helper final delivery and hard interruption remain UNVERIFIED.

kqueue watches exactly the unreaped child supplied by its creator; it does not
register after reaping, follow descendants, scan a PID table or send a signal.
Registration status is not liveness authority. Popen poll/wait and kernel exit
notification are recorded separately. Missing/failed/unsupported subscription
cannot produce a verified hard-interruption receipt or descendant completion.

License approval remains manifest/assembly review, separate from runtime native
security evidence. Runtime processing still requires existing full runtime/model/
dependency/native/architecture/network/session/request bindings. No unknown
license, missing weights, incomplete native observation or candidate inventory
was upgraded into an approved runtime. Publication remains false.

## Validation, stage status and next checkpoint

Local Node 1831/1831 PASS; Python 297 total, 292 PASS and five unchanged preexisting
unavailable-dependency skips. Fourteen added tests: eight license-material tests,
two executable-image tests, four creator/exit subscription tests. No tests deleted,
new skip or assertion weakening. Original source reproduced license-regression
failures/errors and architecture acceptance failure before implementation.
Final exact-head Actions provide full Python, Swift/builds/Chrome results in PR.
CI native exit observer success is disposable OS software evidence only.

| Category | Remaining status |
| --- | --- |
| A repository-only reviewed checklist | 0 after declared-license inclusion and CPU-label-only resolver corrections; not exhaustive future assembly completion |
| B backend/assets/anchors | current private Python/model/native bytes, full notice/native redistribution material and exact approved generation remain missing |
| C policy | user decisions ready now 0; no storage/distribution/signing/notarization/PKI/retention/GC decisions made |
| D physical | Intel Mac, Apple Silicon, iPad, Safari, Gatekeeper, notarization, real ML/performance/isolation, six-note accuracy, Logic and Keystation PENDING/UNVERIFIED; prior physical failure not superseded |
| E OS/runtime evidence | creator-owned exit subscription connected; exact termination handle, descendant closure, internal kernels and native containment unverified |

Formal A **0/30**. Stage 2 **OPEN**. Stage 3 **NOT_PASSED**.
Next shortest safe checkpoint: complete remaining primary source/embedded native
notice evidence and exact weights permission; then inspect independently approved
local per-CPU source-build assets through the existing assembler and resolver.
Permission investigation is external evidence work, not a speculative user choice.
No models/binaries/provider API/external AI API/system changes were used. main,
#320, #321 and all earlier PRs remain untouched. Songs/real Backup were not accessed
or modified; physical-device byte equality cannot be confirmed remotely.

**ティアが今やること：ありません。次のWorkへ進めます。**
