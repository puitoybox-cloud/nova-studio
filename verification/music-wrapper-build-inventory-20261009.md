# Wrapper build inventory — 2026-10-09 JST

Baseline Draft #345 exact f9d3255c373053029190b9f0ac16d1edf7cc6f6e.

The explicit local Wrapper build is observed read-only. Files retain app-relative
paths, streamed SHA-256 and actual byte size; Info.plist identifies the wrapper
executable. The bounded existing Mach-O parser reports the caller-selected CPU
slice, load commands and rpaths. Symlinks/nonregular files, missing/invalid plist,
wrong CPU, non-MH_EXECUTE wrapper, missing execute mode, file/tree mutation and
file/byte budgets fail closed. Signature presence is observed, never stripped or
verified as a distribution identity. Signed disk bytes can be observed but cannot
become approved unsigned package inputs.

Existing closure graph shape is reused, with OBSERVED_METADATA_ONLY evidence and
REVIEW_REQUIRED license status on every node. Multiple roots represent independent
inventory groups; requires remains empty because actual dependency relations
are NOT_EVALUATED. No approval manifest/trust anchor is created. The graph is
validated structurally, and regression proves verify_assembly remains incomplete.
Zero-byte resources are retained in the diagnostic but prevent graph conversion,
because the existing graph only accepts positive file sizes; they are not dropped.

Example:

```sh
python3 tools/music-audio-pipeline/wrapper_build_inventory.py \
  --root EXPLICIT_WRAPPER_BUILD --build EXACT_40_CHARACTER_REVISION \
  --architecture x86_64
```

The CLI always returns 2 and INCOMPLETE: successfully observing a build does not
complete production packaging. Build revision is caller-declared, not authenticated
binary provenance. No installed or system site-packages discovery, model loading,
native loading, network requests, binary downloads, signing or user storage access.

The existing macOS native CI now observes its own exact-head local Xcode build,
asserts all graph nodes remain unapproved and all approved-asset slots MISSING,
and uploads wrapper-build-inventory.json beside the existing evidence artifact.
This provides actual CI build-byte evidence without approving a production asset.
No compiled binary is added to the repository or downloaded into this worktree.
Existing CI signing settings, retention and distribution identity are unchanged.

Missing approved asset slots: Wrapper, Helper source, CPython, stdlib,
site-packages, native/shared libraries, Basic Pitch model, Demucs htdemucs_6s,
model config/provenance, license material, runtime config, closure and manifest.
Only the observed Wrapper executable path is known; other paths remain null until
explicit actual approved layouts exist. No model format/digest/license is guessed.
Basic Pitch LICENSE_UNCONFIRMED; Demucs EXTERNAL_LICENSE_VERIFICATION_REQUIRED.

B: actual approved bytes still MISSING; CI observed Wrapper is not approval.
C: exact distribution/native/model/weights/license/system-library policy open.
D: Intel/Apple Silicon/iPad/Safari/Gatekeeper/real isolation/ML/accuracy/performance/
Logic/Keystation acceptance UNVERIFIED.
E: signing/notarization/external approval UNVERIFIED.
parentLaunchAuthenticated=false; parentKernelOriginVerified=false;
mappedBytesVerified=false; exact interruption UNVERIFIED.
formal A 0/30; Stage 2 OPEN; Stage 3 NOT PASSED; software approx 99% unofficial,
not a measured completion ratio. No lifecycle/receipt/state/audit/publication changes.

Next safe checkpoint work: app-relative missing-slot diagnostics against explicit
unapproved Wrapper evidence plus the existing actual generation inputs, without
promoting evidence, choosing runtime policy or inventing asset paths/approval.
