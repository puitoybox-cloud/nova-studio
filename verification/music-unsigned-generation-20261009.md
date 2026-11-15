# Unsigned private generation staging — 2026-10-09 JST

Baseline: Draft #343, 61435e4ff3ac20d06559ffb56abd9f544e368714.

`tools/music-audio-pipeline/unsigned_generation.py` inspects an explicitly supplied
approved generation, or stages its exact graph files to a new directory. It
reuses the externally anchored manifest, closure graph, installed METADATA/RECORD,
license material, private Python layout and actual executable checks. It copies
no discovered host files. The manifest anchor is supplied by the caller, never
created by the assembler. Relative paths and manifest bytes are preserved;
verification runs again at the destination. Missing graph files identify both
artifact ID and relative path. Missing/invalid manifest or closure fails with
INCOMPLETE, exit 2. No existing output is replaced.

Example (arguments are caller-supplied approved identities, not repository assets):

```sh
python3 tools/music-audio-pipeline/unsigned_generation.py \
  --root APPROVED_GENERATION --manifest APPROVED_MANIFEST \
  --anchor EXTERNAL_MANIFEST_DIGEST --build EXACT_APPROVED_BUILD
```

Add `--destination NEW_GENERATION_DIRECTORY` to stage a complete disk generation.
No download, installation, signing, trust-anchor selection or model substitution
occurs. This is not the final Native Wrapper application assembler: it reports
nativeWrapper=NOT_ASSEMBLED, publicationEligible=false and runtimeAcceptance=
UNVERIFIED even when its scoped disk graph is complete. Existing native runtime
observation, network policy, source/weights license and physical gates remain.
No lifecycle/receipt/summary/audit/state/publication logic was changed.

## Layout and assets

The existing Python layout is used, not replaced: CPython 3.11.x exact version
from the approved node; one unpacked stdlib root containing os.py, encodings,
json and sysconfig; optional graph-bound lib-dynload; exact private dist-info
roots. Existing launcher uses -I -S -B, pins sys.path and removes Python/dynamic
loader environment injection. No zipped/system stdlib or ambient Python fallback
is added. The repository candidate 3.11.17 remains a candidate, not approved
bytes. Intel x86_64 / arm64 bytes and universal2 assembly remain MISSING/UNVERIFIED.
Cert/network-related stdlib trimming is not decided by this change.

Basic Pitch and Demucs model/config/native files use existing manifest graph
slots. Exact paths, digests, lengths and provenance require approved input; this
change invents none. Basic Pitch actual model MISSING / LICENSE_UNCONFIRMED;
htdemucs_6s MISSING / EXTERNAL_LICENSE_VERIFICATION_REQUIRED.
Private runtime, stdlib, installed dependencies, native libraries, wrapper and
actual license material MISSING. Final unsigned app INCOMPLETE. Actual external
Mach-O paths and nested signing order cannot be enumerated without those bytes.
Existing native verifier remains authoritative; no new system-library allowlist.

## Primary evidence

Rechecked 2026-10-09: https://docs.python.org/3.11/license.html
Python 3.11.17 documentation identifies PSF licensing and separately incorporated
software licenses. This is source-license evidence, not approval of absent builds.
Basic Pitch/Demucs GitHub license page retrieval failed this session; prior
2026-10-06 repository source evidence remains historical, not freshly verified.
Torch/numpy/scipy/soundfile/libsndfile installed-byte license closure remains
UNVERIFIED. No source-license evidence promotes weights permission.

B: approved CPython/stdlib/site-packages/native/models/wrapper bytes MISSING.
C: redistribution/model/native policy and exact bundled notice obligations open.
D: physical Intel/Apple Silicon/iPad/Safari/Gatekeeper/ML/accuracy/performance/
Logic/Keystation acceptance UNVERIFIED.
E: Developer ID/Team ID/certificate/entitlements/notarization identity undecided.
parentLaunchAuthenticated=false; parentKernelOriginVerified=false;
mappedBytesVerified=false; exact interruption UNVERIFIED.
formal A 0/30; Stage 2 OPEN; Stage 3 NOT PASSED.
Software completion approx. 99% is an unofficial user estimate, not measurement.

Next safe software work: connect an explicit Native Wrapper build output and
existing generation graph to a candidate app layout without approving bytes,
then derive nested executable/signing-order inventory from approved local input.
No user action is currently required.
