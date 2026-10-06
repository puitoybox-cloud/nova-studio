# Installed metadata assembly continuation — 2026-10-06

This continues live Draft #320 (`9bf70a4289d4384c8010bee62b42d7a4538af74c`),
not the older supplied #319 checkpoint. Main and all existing PRs are untouched.
The candidate versions, model identities, platform matrix, native provenance and
license boundaries in `EXACT_BACKEND_CANDIDATES_20261006.md` remain applicable.
The supplemental JSON in `verification/music-installed-metadata-assembly-20261006.json`
supersedes only the three unreported dependency declarations and graph edge counts.
Neither research document is an approved production manifest or install lock.

## Exact source declarations resolved

| Candidate | Pinned upstream revision | Runtime requirements | Source license evidence |
| --- | --- | --- | --- |
| julius 0.2.7 | `486c0329158ad6c137d18bcddc5461d493005c65` | `torch>=1.7.0` | MIT at same revision; retain copyright/permission notice |
| treetable 0.2.5 | `2ebd741048f9dadd80487369095acf5c366a74dc` | explicitly empty `REQUIRED` | Unlicense at same revision |
| antlr4-python3-runtime 4.9.3 | `e4c1a74c66bd5290364ea2b36c97cd724b247357` | `typing ; python_version<'3.5'`, inactive for cp311 | BSD 3-clause in pinned LICENSE; retain notices/conditions/disclaimer, no endorsement |

Primary setup.py files state each exact version and installation requirements.
No source archive, wheel, native binary or model was downloaded or executed.
Pinned text URLs and their SHA-256/length are retained in the supplemental JSON.
Source revision correspondence is not a comparison against uninspected sdist bytes.

Both Darwin profiles now have 65 candidate nodes / 110 active dependency edges,
zero unreported runtime declarations and zero observed version-constraint conflicts.
This is declaration-level evidence, not installation, build dependency closure,
security clearance, native linkage or model compatibility. The profiles explicitly
remain incomplete as production closures. Source-build backend dependencies and
exact installed distributions must still be authenticated from real assets.

## Production integration

Existing `scoped_closure.verify_closure` now binds every verified Python distribution
to exactly one authenticated `.dist-info/METADATA` in its approved RECORD footprint.
It bounds the read to 1 MiB, rechecks length and SHA-256, rejects malformed or
duplicate identity headers, normalizes the package name and requires the exact
manifest version. Detached `importlib.metadata` Name/Version claims cannot replace
those authenticated bytes. Final existing stable-file checks also cover METADATA.

This runs on the existing assembly verifier, launcher preparation, strict runtime
inventory and child closure verification paths. No new contract schema, dependency,
runtime import or production asset was added. Missing/ambiguous/wrong metadata
fails closed through the existing UNVERIFIED → incomplete assembly path.

`Requires-Dist` can be read from these same authenticated bytes by the helper.
It is explicitly returned as declarations with `dependencyConstraintsVerified=false`.
This change does **not** certify markers, selected extras or installed dependency
version constraints. The authenticated graph still proves only its declared scope;
all possible dynamic imports/native loader dependencies are not silently certified.

Six new regression tests exercise authenticated identity disagreement, duplicate/
missing/malformed headers, missing/ambiguous metadata, canonical names and raw
requirements, tampering/budget limits, and detached resolver claims. Existing fixture
footprints now contain disposable metadata, and the stamp test asserts every exact
fixture path plus the new count. Fixtures remain TEST_ONLY; no assertion is weakened.

## Assembly and private delivery boundary

App → Swift wrapper → private Helper → private Python → authenticated distributions
and model/native assets → existing manifest/inventory/receipt/authorization → processing
→ final mido MIDI and explicit soundfile WAV output remains the required assembly.
All real backend/model/runtime bytes remain MISSING; research identities are never
promoted to approved assets. Basic Pitch ONNX weights and htdemucs_6s exact commercial
weight grants remain LICENSE_UNCONFIRMED / EXTERNAL_LICENSE_VERIFICATION_REQUIRED.

Both cp311 architectures have published package candidates; internal Mach-O slices,
shared-library linkage, actual private runtime and physical acceptance remain unverified.
No Rosetta premise, product storage location, distribution, signing, notarization,
PKI or retention policy has been selected. Existing native-library license scopes,
README/build-version disagreement and pretty_midi soundfont uncertainty are retained.

Private delivery was re-inspected: production `local_distribution_entry.main` still
requires the system browser; native_host/final_sink injection points are not installed
Swift delivery. Existing owned pipes, EOF and bounded waits are retained. An exact
OS-owned live-handle provider for the installed Mac assembly cannot be confirmed.
No PID kill, process-group kill, translated execution or fictitious delivery binding
was introduced. This remains B/E, not a physical pass.

NOT_REQUIRED remains: external FFmpeg/sox/ffmpeg-python on the strict path, Mac CUDA/
NVIDIA/triton payloads, training/dev/evaluation extras, unused four-stem models,
TensorFlow/TFLite for the proposed ONNX profile and synthesis/MP3 output functions.
lameenc and Darwin CoreML remain reachable through unmodified upstream import/
metadata requirements; they cannot be silently removed. diffq remains conditional
NOT_YET_DETERMINABLE until actual checkpoint contents are authenticated.

## Completion classification

| Category | Current scoped assessment |
| --- | --- |
| A repository-only pure software | 0 identified outstanding blockers after this identity repair; not a claim that all future runtime evidence is available |
| B backend/assets/anchors | OPEN: real runtime/distributions/models/native closure/notices and installed delivery missing |
| C policy | 0 decisions ready for ティア; future policy unchanged |
| D physical acceptance | UNVERIFIED: Intel, Apple Silicon, iPad, Safari, Gatekeeper, notarization, ML/performance/isolation, six-note/Logic/Keystation |
| E OS/runtime evidence | OPEN: exact installed live handles, real kernel/native loader/hidden-library evidence |

Formal A remains 0/30. Stage 2 remains OPEN; Stage 3 remains NOT_PASSED.
The shortest safe next checkpoint is authenticated real installed distribution
metadata constraint/marker binding and source-build closure evidence, preserving
the model acquisition/license boundary. Work can continue without a user decision.

Validation results and exact source head are recorded in the new Draft PR after CI.
No saved songs, real backup, main, #319 or #320 was changed.
