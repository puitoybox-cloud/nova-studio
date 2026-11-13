# Exact backend candidates and production assembly — 2026-10-06 JST

## Result and evidence boundary

Independent work from #319 exact `17525108dc6939e2a10f3dab630f78a3e7270479`.
In candidate research, no package, model or remote binary was downloaded or adopted. Existing CI TEST_ONLY dependency setup is unchanged. Only primary source
text, official package metadata, Git tree metadata and the existing repository
were inspected. This is a candidate register, not an approved manifest/lockfile.
Actual production runtime/model/native payloads remain **MISSING**.

A real production bug was identified and fixed: Demucs 4.0.1's WAV writer calls
`torchaudio.save` without selecting a backend. Torchaudio can select FFmpeg before
soundfile, bypassing the existing soundfile encoder receipt. The strict resident
child now selects `backend='soundfile'`, rejects other backend/format/remote-output
requests before write, preserves Demucs clipping/PCM arguments, and restores all
patched callables on success or failure. Its encoder observer now accepts the
upstream `soundfile.write(file=..., data=...)` keyword form. Two regression tests
failed with the original keyword-incompatible observer and pass after the fix.
Five new tests exercise dispatch, preservation, rejection, no retry, and cleanup.
They use explicitly disposable modules and **do not prove real ML or native IO**.
Legacy processing is unchanged. No new trust contract or approved asset is created.

No user choice is ready now. Primary-source license clarification, exact package
closure, and current runtime provenance are engineering/external evidence work.

## Primary source register

The companion JSON `verification/music-exact-backend-candidates-20261006.json`
records retrieval dates, source URLs, response digests, upstream versions/revisions,
wheel filenames/tags/SHA-256/sizes, raw dependency declarations, both Mac metadata
profiles, model tree identities, and unresolved evidence. Digests describe the
retrieved metadata/text response, not installed binaries or a trusted anchor.
A wheel digest/size is an official published **candidate identity**, never proof
that its bytes were downloaded or that internal native libraries were inspected.
A Git blob SHA-1 is not a model SHA-256; no model blob endpoint was fetched.

Principal versioned sources:

- [Basic Pitch v0.4.0 source](https://github.com/spotify/basic-pitch/tree/9991303bba609a3b93089d13ec80d1d495083596),
  [pyproject](https://github.com/spotify/basic-pitch/blob/v0.4.0/pyproject.toml),
  [LICENSE](https://github.com/spotify/basic-pitch/blob/v0.4.0/LICENSE),
  [official metadata](https://pypi.org/pypi/basic-pitch/0.4.0/json).
- [Demucs v4.0.1 source](https://github.com/facebookresearch/demucs/tree/ef66d254cd6d558e207eeff2c4b8d053db2e77dd),
  [minimal requirements](https://github.com/facebookresearch/demucs/blob/v4.0.1/requirements_minimal.txt),
  [model bag](https://github.com/facebookresearch/demucs/blob/v4.0.1/demucs/remote/htdemucs_6s.yaml),
  [checkpoint registry](https://github.com/facebookresearch/demucs/blob/v4.0.1/demucs/remote/files.txt),
  [LICENSE](https://github.com/facebookresearch/demucs/blob/v4.0.1/LICENSE).
- [Demucs writer](https://github.com/facebookresearch/demucs/blob/v4.0.1/demucs/audio.py),
  [torchaudio 2.2.2 dispatcher](https://github.com/pytorch/audio/blob/v2.2.2/src/torchaudio/_backend/utils.py),
  [soundfile backend](https://github.com/pytorch/audio/blob/v2.2.2/src/torchaudio/_backend/soundfile_backend.py).
- [torch 2.2.2 metadata](https://pypi.org/pypi/torch/2.2.2/json),
  [torchaudio 2.2.2 metadata](https://pypi.org/pypi/torchaudio/2.2.2/json),
  [upstream paired releases](https://pytorch.org/get-started/previous-versions/).
- [CPython 3.11.17 release, 2026-10-01](https://www.python.org/downloads/release/python-31117/),
  [historical 3.11.9 universal2 installer](https://www.python.org/downloads/release/python-3119/).
- [soundfile 0.12.1 packaging](https://github.com/bastibe/python-soundfile/blob/0.12.1/setup.py),
  [pinned native submodule](https://github.com/bastibe/libsndfile-binaries/tree/d9887ef926bb11cf1a2526be4ab6f9dc690234c0),
  [exact native build recipe](https://github.com/bastibe/libsndfile-binaries/blob/d9887ef926bb11cf1a2526be4ab6f9dc690234c0/mac_build.sh),
  [native COPYING](https://github.com/bastibe/libsndfile-binaries/blob/d9887ef926bb11cf1a2526be4ab6f9dc690234c0/COPYING).

The register distinguishes exact source text from package-metadata-only licenses.
Unreported `Requires-Dist` is not silently interpreted as no dependencies. Where
available, exact version source setup/minimal declarations and text-only wheel
METADATA supplement PyPI JSON. Darwin/Python 3.11 markers are evaluated separately
for x86_64 and arm64. Metadata constraint consistency is not runtime compatibility,
security approval, a resolver-generated installation lock or complete binary closure.

## Candidate classification derived from production calls

`EXACT_CANDIDATE` means a named version/artifact has primary evidence suitable for
further engineering review. It does **not** mean the only possible version, installed,
approved, secure for distribution, physically verified, or ready to ship.
`MULTIPLE_CANDIDATES` identifies alternative engines/formats/packaging routes.
`NOT_YET_DETERMINABLE` keeps an exact-byte/native/permission gap explicit.
`NOT_REQUIRED` is scoped to the current strict call path, not every import/metadata
edge in an unmodified upstream distribution.

| Component | Classification / exact research candidate | Production reason / limitation |
| --- | --- | --- |
| Basic Pitch | EXACT_CANDIDATE 0.4.0 | retained `Model` → `predict`; satisfies `>=0.4,<1`; official package metadata and versioned source |
| Basic Pitch model | EXACT_CANDIDATE ICASSP 2022 `nmp.onnx`, v0.4.0 | one-file model fits current file-only inventory verifier; serialized bytes absent |
| Basic Pitch engine | MULTIPLE_CANDIDATES; ONNX Runtime 1.17.3 is the concrete one-file profile | CoreML 7.2 has both Mac wheels, but `.mlpackage` is a directory incompatible with current file-only model verification; TF SavedModel is also multi-file; Mac TFLite availability not established |
| Demucs | EXACT_CANDIDATE 4.0.1 | resident child already enforces `loaderVersion == 4.0.1`; do not substitute a newer untested loader |
| Demucs model | EXACT_CANDIDATE `htdemucs_6s` → `5c90dfd2-34c22ccb.th` + bag YAML | `server.py` actually requests six stems; general `htdemucs` is not this production model |
| Python | EXACT_CANDIDATE CPython 3.11.17 source-build target, cp311 | current security release on 2026-10-01; official release is source-only; assembled Mac runtimes absent |
| Python packaging | NOT_YET_DETERMINABLE actual private runtime build/provenance | 3.11.9 universal2 installer proves historical distribution availability only; older installer not selected as current product runtime |
| torch / torchaudio | EXACT_CANDIDATE 2.2.2 / 2.2.2 CPU | official cp311 wheels for both architectures; torchaudio metadata requires exact torch 2.2.2; real checkpoint compatibility/performance unverified |
| numpy | EXACT_CANDIDATE 1.26.4 | existing `<2` requirement; direct production numeric/audio use |
| mido | EXACT_CANDIDATE 1.3.3 | final merged MIDI `MidiFile.save`; pure Python wheel; packaging dependency retained |
| pretty_midi | EXACT_CANDIDATE 0.2.10 | Basic Pitch creates intermediate MIDI and calls `.write`; separate from final mido writer |
| soundfile | EXACT_CANDIDATE 0.12.1 | direct strict decode + explicit stem encode; both Mac wheels |
| libsndfile | EXACT_CANDIDATE 1.2.0 **recipe**, actual embedded revision NOT_YET_DETERMINABLE | pinned soundfile native submodule recipe; no native bytes downloaded |
| librosa | EXACT_CANDIDATE 0.10.2.post1 | direct load/resample/onset/note correction and Basic Pitch preprocess |
| scipy | EXACT_CANDIDATE 1.12.0 | librosa/Basic Pitch reachable dependency; both cp311 Mac wheels |
| soxr | EXACT_CANDIDATE 0.3.7 | librosa resampling and metadata requirement; both Mac wheels |
| julius | EXACT_CANDIDATE 0.2.7 | Demucs `convert_audio` → `resample_frac`; source distribution candidate; exact transitive metadata still partial |
| decoder / codec | soundfile 0.12.1 + libsndfile recipe/native candidates | strict soundfile path; general format/real input acceptance and native byte closure remain unverified |
| resampler | librosa/soxr 0.10.2.post1/0.3.7; Demucs julius 0.2.7 | two actual chains, not interchangeable defaults; `resampy` 0.4.2 remains an upstream Basic Pitch metadata dependency |
| MIDI writer | mido 1.3.3 final + pretty_midi 0.2.10 intermediate | both necessary in actual pipeline; browser own SMF writer cannot replace the Python path implicitly |
| stem writer | Demucs 4.0.1 → torchaudio 2.2.2 → soundfile 0.12.1 | strict explicit soundfile selection and keyword observer fixed here; no real bytes supplied |
| native/shared libraries | NOT_YET_DETERMINABLE complete actual closure | wheel tags / Git names / build recipes are declared architecture evidence only |
| setuptools | EXACT_CANDIDATE 69.5.1 research profile | satisfies existing `<82`; build/bootstrap scope distinguished; no production removal without exact import/build closure |

Other exact research-profile versions, package metadata and dependency edges are
in JSON. None were installed. Their presence in the research register does not
mean every package must be included in the product.

## Models and acquisition boundary

Basic Pitch source revision is `9991303bba609a3b93089d13ec80d1d495083596`.
The Git tree, without reading any model bytes, reports:

| Format / upstream path under `basic_pitch/saved_models/icassp_2022/` | Declared size (bytes) | Git blob SHA-1 / current integration |
| --- | ---: | --- |
| `nmp.onnx` | 230444 | `c30e5f9438e798604b7177aa26be1fe64482f767`; one-file candidate |
| `nmp.tflite` | 204448 | `85a41befdd036e9b365a052b7c704c6810288b95`; Mac engine unresolved |
| `nmp.mlpackage/Data/com.apple.CoreML/model.mlmodel` | 123027 | `4fa2f93d7879fc58e2dc78e7ecd95a7aaad547ae` |
| `nmp.mlpackage/Data/com.apple.CoreML/weights/weight.bin` | 145956 | `883fcaf0519b9eddcb99edec6dcba87ed6dfdcb3` |
| `nmp.mlpackage/Manifest.json` | 617 | `37bfe14d07213ca2d0f2485dbeeeb9decd15ada9` |
| `nmp/saved_model.pb` | 1084140 | `3a22fc986be8c436987debb7f899a2b0371166b3` |
| `nmp/variables/variables.data-00000-of-00001` | 219309 | `a473eb08150b66f7a3a02cdb6dbb84893024b875` |
| `nmp/variables/variables.index` | 4794 | `dba4ca40bf5d1b64a32a82c5a6ffd6a542650bbd` |

CoreML/TF directory forms require future verified companion/directory integration;
they are not secretly promoted to a file model or implemented via fixtures here.
An explicit model binding must point inside the approved private root. No absolute
installation path or default storage location was chosen. Actual local path,
SHA-256 and installed size remain **MISSING** for every model.

Demucs revision `ef66d254cd6d558e207eeff2c4b8d053db2e77dd` has bag
`demucs/remote/htdemucs_6s.yaml` with one model signature `5c90dfd2`.
The exact `files.txt` registry places `5c90dfd2-34c22ccb.th` below
`hybrid_transformer/`. This identifies the upstream candidate URL only; it was
not requested. Expected production local repository must contain that checkpoint
and the six-stem bag under explicit manifest bindings; no cache/PATH fallback.
Checkpoint size and full SHA-256 **cannot be confirmed**. The eight-character
filename hash is not a full digest or permission to acquire/use the model.
Exact weights quantization/serialization contents cannot be confirmed without
bytes, so conditional `diffq` need is not falsely declared universally absent.

## License evidence, separately scoped

| Scope | Evidence confirmed | Outstanding redistribution evidence |
| --- | --- | --- |
| Basic Pitch 0.4.0 source | versioned Apache-2.0 LICENSE; retain copyright/license and applicable NOTICE, mark modifications under license conditions | dedicated exact model-weights grant and actual packaged notices: LICENSE_UNCONFIRMED / EXTERNAL_LICENSE_VERIFICATION_REQUIRED; repository software license not silently substituted for a separate weights license |
| Demucs 4.0.1 source | exact MIT LICENSE; retain copyright/permission notice | no automatic grant for checkpoints |
| Demucs weights | [author statement, 2022-05-23](https://github.com/facebookresearch/demucs/issues/327#issuecomment-1134828611): weights are outside MIT and provided only for scientific purposes | statement predates v4 `htdemucs_6s`; exact commercial/redistribution grant **cannot be confirmed**; EXTERNAL_LICENSE_VERIFICATION_REQUIRED; not a user approval choice |
| mido 1.3.3 / pretty_midi 0.2.10 | versioned MIT source licenses retrieved; retain notice | pretty_midi package includes `TimGM6mb.sf2`; soundfont is not used by `.write`, and its separate license cannot be inferred from MIT source code |
| torchaudio 2.2.2 | versioned BSD-style source license retrieved | actual wheel bundled libraries/notices not inspected; separate requirements remain |
| soundfile 0.12.1 | versioned BSD 3-Clause source license | native libsndfile and codec obligations remain separate |
| libsndfile native candidate | pinned submodule includes LGPL-2.1 COPYING; script identifies exact build inputs; README attributes codec licenses separately | corresponding source, relinking/replacement rights, codec notices, actual statically linked revisions and complete license compliance need verification; do not treat soundfile BSD as native permission |
| librosa 0.10.2.post1 / soxr 0.3.7 | versioned ISC / LGPL-2.1 texts retrieved | python-soxr wrapper vs statically linked libsoxr/native notices still separate |
| numpy 1.26.4 / scipy 1.12.0 | versioned BSD-style source texts and numpy bundled-license evidence | BLAS/LAPACK/Fortran runtime and actual Mac wheel notices require exact-byte inspection; Linux wheel license evidence is not Mac binary proof |
| numba 0.59.1 / llvmlite 0.42.0 | exact source licenses / llvmlite third-party notice retrieved | LLVM/native runtime identity and actual bundled license closure unverified |
| CoreML 7.2 / ONNX Runtime 1.17.3 | versioned BSD-style / MIT source license, ONNX ThirdPartyNotices retrieved | actual installed native frameworks/libraries/transitive notices unverified |
| torch 2.2.2 / julius 0.2.7 / other research candidates | official exact-version metadata license fields/classifiers in JSON | metadata evidence is not complete bundled-native/model redistribution approval; unknown/omitted licenses remain unconfirmed |
| CPython | official current release source identity; exact v3.11.17 LICENSE text retrieved; PSF/history terms confirmed | include that license and actual bundled third-party notices; built extension/native provenance must be confirmed before adopting actual runtime |

No entry was inserted as APPROVED in the existing product license register.
No legal permission, distribution/signing/PKI/storage/retention decision was made.

## Intel / Apple Silicon matrix

| Layer | Intel x86_64 | Apple Silicon arm64 | Evidence limit |
| --- | --- | --- | --- |
| Python | CPython 3.11.17 source-build candidate | same source-build candidate | no built private runtime; cp311 ABI target only; physical UNVERIFIED |
| torch 2.2.2 | `cp311-none-macosx_10_9_x86_64` wheel published | `cp311-none-macosx_11_0_arm64` wheel published | exact wheel SHA-256/size in JSON; internal Mach-O/linkage UNKNOWN |
| torchaudio 2.2.2 | `cp311-cp311-macosx_10_13_x86_64` published | `cp311-cp311-macosx_11_0_arm64` published | metadata pairs torch 2.2.2; no Rosetta premise |
| ONNX Runtime 1.17.3 | `cp311-cp311-macosx_11_0_universal2` | same universal2 metadata candidate | file-only model profile; actual native slices uninspected |
| CoreML 7.2 alternative | cp311 x86_64 wheel | cp311 arm64 wheel | directory-model verifier gap prevents current integration |
| numpy / scipy / soxr / cffi / numba / llvmlite | exact Mac wheel candidates listed | exact Mac wheel candidates listed | metadata availability only; no physical compatibility or native isolation claim |
| soundfile 0.12.1 | macOS x86_64 wheel / named native dylib | macOS arm64 wheel / named native dylib | architecture names are declarations, not `lipo` results |
| Basic Pitch / librosa / mido / other pure Python | published pure Python candidate wheels where available | same metadata candidates | interpreter marker/semantic/runtime checks still required |
| Demucs / julius / pretty_midi / dora | exact source-distribution candidates | same candidates | metadata/source build required; no prebuilt wheel fabricated |
| Models | named CPU-processing candidate | named CPU-processing candidate | real checkpoint load and numerical/6-note/performance compatibility UNVERIFIED |

Torch 2.2.2 is a concrete common-architecture candidate, **not a claim that it is
current, security-cleared or the only usable version**. Metadata alone cannot
certify a safe 2026 distribution of this legacy stack. No known unsupported *wheel
architecture* was found for the named cp311 candidates. Complete runnable backend
availability cannot be confirmed because actual native/model/runtime closure is
absent. The ONNX wheel sets a declared macOS 11+ floor for this candidate profile on both architectures; actual supported product OS versions are not selected. No Rosetta or translation layer is assumed or installed.

## Dependency closure and native provenance

Actual source chain:

1. App → Swift wrapper → private launcher/Helper → manifest-bound private Python.
2. Input → soundfile + libsndfile; strict Demucs decoder uses `torch.from_numpy`.
3. Basic Pitch → librosa / numpy / scipy / scikit-learn / mir_eval / pretty_midi /
   resampy / typing-extensions; Darwin metadata additionally installs CoreML even
   when an ONNX extra is requested. ONNX profile adds onnxruntime → flatbuffers /
   coloredlogs / protobuf / sympy / packaging / numpy.
4. librosa → soundfile / scipy / soxr / numba → llvmlite; also audioread, joblib,
   decorator, pooch → requests/platformdirs, lazy-loader, msgpack, typing-extensions.
5. Demucs **minimal** requirements → dora-search / einops / julius / lameenc /
   openunmix / pyyaml / torch / torchaudio / tqdm. dora 0.1.12 setup adds omegaconf /
   retrying / submitit / treetable / torch; torch adds filelock, typing-extensions,
   sympy, networkx, jinja2, fsspec; Linux-only NVIDIA/triton markers are excluded on
   both Mac profiles. `requirements.txt` training/dev list is not substituted for
   installed minimal requirements.
6. Final MIDI → mido; intermediate MIDI → pretty_midi → numpy/mido/six.
7. Stems → Demucs clipping → torchaudio explicit soundfile dispatch → libsndfile.

The JSON contains 65 exact package candidates and both platform marker profiles (65 nodes / 109 edges each), exact source/metadata edges,
zero observed version-constraint conflicts, and three remaining unreported dependency declarations (julius, treetable, antlr4-python3-runtime). It is deliberately
PARTIAL: unreported dependencies, uninspected source/wheel records, native imports,
models and installed bytes prevent full resolution/assembly certification.

Pinned soundfile submodule Git tree names:

| Native artifact | Declared bytes | Git blob SHA-1 |
| --- | ---: | --- |
| `libsndfile_x86_64.dylib` | 3048464 | `02d410c6ab8feeb79a64945d02708573e95bf98c` |
| `libsndfile_arm64.dylib` | 2937924 | `144af7c0bdb585e5d23bbb09cf59c18e6b6d7f04` |

No native blobs were read. The exact build script says libsndfile 1.2.0,
libogg 1.3.5, libvorbis 1.3.7, FLAC 1.4.2, Opus 1.3.1, mpg123 1.30.2,
LAME 3.100. The same revision's README still says libsndfile 1.1.0 / FLAC 1.3.3 /
mpg123 1.29.3. This discrepancy is retained: script declarations **do not prove
which revisions are actually inside the dylibs**. README says codec libraries are
statically included. Full architecture, SHA-256, linker graph, codec build identity
and bundled-notice closure remain UNVERIFIED, not fabricated from filenames.

Other reachable native families: torch/torchaudio C++ kernels, numpy/scipy numerical
libraries, soxr resampler, numba/llvmlite LLVM, cffi, CoreML/ONNX inference libraries,
Python extension libraries. Their origins are official package artifacts named in
JSON. Internal native paths/digests/transitive links cannot be confirmed without
actual package bytes. Apple system frameworks remain OS dependencies, not copied
product assets. No code-level observer is promoted to proof of kernel execution.

## Dependency reduction without breaking imports

| Item | Current classification | Why |
| --- | --- | --- |
| external FFmpeg executable / ffmpeg-python / sox executable | NOT_REQUIRED for strict path | input decoder is replaced; subprocess/PATH fallback forbidden; stem route now explicit soundfile |
| CUDA/NVIDIA/triton Mac payloads | NOT_REQUIRED | official torch marker applies to Linux, not either Mac profile |
| TensorFlow / tensorflow-macos / TFLite engine | NOT_REQUIRED in proposed cp311 ONNX profile | do not install all engines; this does not select a production engine/asset |
| Basic Pitch data/test/dev/docs extras, Demucs dev extras, openunmix evaluation extras | NOT_REQUIRED | training/evaluation/documentation are not production inference |
| Demucs `htdemucs` four-stem checkpoint, other model bags | NOT_REQUIRED for current six-stem request | production explicitly uses `htdemucs_6s` |
| MP3/FLAC output capability and MIDI synthesizer soundfont | NOT_REQUIRED processing functions | current strict outputs WAV and MIDI; pretty_midi soundfont license remains a packaging issue if shipping the unmodified distribution |
| lameenc | **NOT safe to exclude as a package** | unconditionally imported by `demucs.audio`, even for WAV; LGPLv3 package metadata; native LAME scope separate |
| CoreML package on Darwin | **NOT safe to exclude from unmodified Basic Pitch metadata closure** | base Darwin requirement remains even with ONNX extra; engine directory-form gap is separately recorded |
| diffq | NOT_YET_DETERMINABLE conditional need | upstream quantized-checkpoint loader can require it; actual selected checkpoint content absent |
| openunmix / dora / mir_eval / resampy | retained metadata/import closure candidates | not removed merely because application code does not call their public APIs directly |

No dependency was added to production `requirements.txt`, silently vendored,
removed from an unmodified package, or imported as an approved runtime asset.

## Concrete assembly using existing interfaces

Build separate x86_64 and arm64 private bundles from the same declared cp311
candidate graph. Exact packaging location/delivery policy is **not selected**.
Required assembly inputs are: source-built current CPython plus stdlib/extensions;
exact platform Python distributions; one chosen Basic Pitch model/engine;
htdemucs_6s bag/checkpoint; reachable native/codec libraries; all licenses/notices
and any corresponding-source/relinking materials; existing web/source resources;
then explicit runtime-config, child config, scoped closure and runtime evidence
bindings for those actual bytes. None can be assembled from the current source-only
Helper ZIP or from fixture assets.

Use existing `RuntimeInventory`, `distribution_binding.load_manifest`,
`scoped_closure.verify_assembly/verify_closure`, `runtime_evidence.assembly_evidence`,
`scripts/music-offline-assembly-verifier.py`, Helper source preflight and request
receipts. Compute actual per-file sizes/digests/architecture/linker evidence, then
bind the complete approved build to an external anchor. Candidate JSON does not
become any of those inputs and cannot authorize startup. Strict gates remain closed.

Production assembly reached here: exact public candidate identities and platform
metadata profiles; named model/checkpoint and native recipe; fixed real strict
stem dispatch/receipt integration. Not reached: installed ML/native runtime,
complete license approval, full byte closure, approved anchor or runnable product.

## Private delivery, owned live-handle and interruption

Re-read actual launcher `main`: `NOVA_LOCAL_BROWSER=system` with `webbrowser.open`.
`native_host` and `final_sink` are callback hooks, not installed Swift connections.
Swift consumes configured handoff and validates shutdown receipts, but repository
build resources do not include an installed private Helper/Swift transport adapter.
The packaging artifacts still do not supply backend/model/native payloads.

No existing approved private native executable/adapter or OS-owned descendant handle
was found to connect safely. No PID/group kill, guessed process ownership, browser
secret, public endpoint, signing/distribution/PKI selection or system-wide change
was introduced. Existing owned pipes/EOF/bounded wait and authenticated final
acknowledgement remain available source mechanisms; descendant/native handle
completeness and installed final delivery remain **PARTIAL/UNVERIFIED**. Adding a
mock transport cannot resolve the missing installation/OS evidence, so none was
promoted or added as a substitute. macOS has no supplied Linux pidfd provider;
Linux-only code would not prove Intel/Apple Silicon delivery.

## Stage 2 / Stage 3

| Category | Updated status |
| --- | --- |
| A repository-only pure software | reviewed checklist remaining **0** after fixing newly found strict writer dispatch/keyword bug; limited to reviewed scope |
| B backend/assets/anchors | exact candidates now identified; real private Python/models/native bytes, byte-level closure, notices, exact model permission and complete approved anchor still absent |
| C policy | current user decisions **0**; future storage/distribution/signing/notarization/trust ownership/retention/GC unchanged |
| D physical acceptance | Intel/Apple Silicon/iPad/Safari/Gatekeeper/notarization/real ML/performance/native isolation/6-note/Logic/Keystation all PENDING/UNVERIFIED; previous real-device failures not overwritten |
| E OS/runtime evidence | descendant exact live handles, internal kernels, successful authenticated loader edges, hidden/transient mapped libraries and native syscall containment unverified |

Formal A **0/30**. Stage 2 **OPEN**. Stage 3 **NOT_PASSED**.
Next shortest safe checkpoint: confirm the exact six-stem weights redistribution
grant and Basic Pitch model scope from primary evidence; narrow a current cp311
source-runtime build recipe/native notice closure and existing file-only ONNX
profile; connect installed private native delivery only when real assets/provenance
exist. No model/binary acquisition is authorized by this candidate report.

## Verification and protected data

Final exact-head GitHub Actions and counts are recorded in the new Draft PR.
Mandatory suite remains unchanged except five additional regression tests. Full
Node/JS/Python/bash validation and existing Swift/macOS/iPad Simulator/three-width
Chrome workflows are required; fixture success never establishes physical acceptance.
No tests were deleted, skipped, or weakened. No existing PR/main/#319 write was made.
Saved songs/real Backups were not accessed; device byte equality cannot be confirmed.

Automatic approval review rejected a Python release-file metadata API retrieval as
potential binary download. It was not retried. Official release HTML established
current source-only/runtime and historical installer facts instead. No exception
to the user's no-download instruction is requested or needed for this work.

**ティアが今やること：ありません。次のWorkへ進めます。**
