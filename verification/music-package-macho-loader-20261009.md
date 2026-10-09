# Package Mach-O loader compatibility — 2026-10-09 JST

Baseline Draft #346 exact 1303a26041c07425bb0469f5abcfc017307a9ebb.
The new regression first reproduced unsupported-macho-loader-or-environment-route
from unsigned_app.layout on a synthetic MH_EXECUTE with LC_LOAD_DYLINKER.

Primary sources checked 2026-10-09:
- Apple xnu loader.h, dylinker_command / LC_LOAD_DYLINKER / LC_DYLD_ENVIRONMENT:
  https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h
- Apple dyld MachOFile.cpp, dynamically-linked executable LC_LOAD_DYLINKER:
  https://github.com/apple-oss-distributions/dyld/blob/main/common/MachOFile.cpp
These define disk syntax, not a redistribution/license or system-library policy grant.

package_macho.py reuses existing bounded selected-slice/read primitives. Its separate
package-only parser records dynamicLinker, installName, dylib commands and rpaths.
CPU, table/string bounds, UTF-8, unique loader, MH_EXECUTE loader, selected fat
slice, byte mutation and existing command budgets are enforced. LC_DYLD_ENVIRONMENT
is rejected. No native loading, rewriting, subprocess, environment search or network.
Existing runtime_evidence.native_image_routes is untouched and still rejects the
loader; new regressions assert that rejection. Package syntax never becomes runtime
origin/loaded-edge proof. Both x86_64 and arm64 synthetic selected slices are tested;
universal2 actual approved CPython remains MISSING, not verified by these fixtures.

unsigned_app.layout uses the package parser and retains every loader as an external
UNVERIFIED path. Exact /usr/lib/dyld gets APPLE_SYSTEM_LOADER_CANDIDATE_POLICY_REQUIRED;
all other names get EXTERNAL_DYNAMIC_LINKER_POLICY_REQUIRED. No path is approved,
resolved through the host, or silently dropped. Thus real app layout can be observed
without crashing on a loader while nativeDiskRoutesComplete stays false and unsigned
assembly stays INCOMPLETE. Existing dylib/rpath closure and signing candidates remain.

Wrapper inventory keeps its existing strict-runtime UNSUPPORTED/UNVERIFIED fields
and adds explicitly package-scoped syntax. Existing native CI now passes actual local
Xcode build bytes through the package layout parser, asserts PARTIAL, external policy
required, no publication/approval, and records the routes in its existing evidence
artifact. No downloaded/repository binary/model is adopted. Existing CI signing and
retention unchanged. CI-observed build revision remains caller-declared, not binary
provenance authentication. No actual physical acceptance is claimed.

B approved Wrapper/Helper/CPython/stdlib/site-packages/native/models/config/manifests
MISSING. C exact licenses, weights evidence and system/native distribution policy
UNVERIFIED; Basic Pitch LICENSE_UNCONFIRMED; Demucs
EXTERNAL_LICENSE_VERIFICATION_REQUIRED. D real Intel/Apple Silicon/iPad/Safari,
Gatekeeper/native isolation/ML/accuracy/performance/Logic/Keystation UNVERIFIED.
E signing/notarization/external approval UNVERIFIED. No choices are made here.
parentLaunchAuthenticated=false; parentKernelOriginVerified=false;
mappedBytesVerified=false; exact interruption UNVERIFIED.
formal A 0/30; Stage 2 OPEN; Stage 3 NOT PASSED; software approx 99% unofficial.

Next: use actual observed loader/dylib/rpath inventory for package-root closure
and policy-required diagnostics; do not auto-approve Apple candidates or promote
CI bytes. Private CPython actual approved bytes and their exact stdlib/dependency/
model/license layout remain required before unsigned production assembly can pass.
