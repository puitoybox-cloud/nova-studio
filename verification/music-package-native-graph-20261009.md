# Package-root native disk graph — 2026-10-09 JST

Base: Draft #347 exact 412cb636d43e60a1466f51dbb011cc1b711427a1,
feature/music-package-macho-loader-v1. GitHub start retrieval: main
552d56eafddfd192970c09f7d6278696cf8775c3; 92 open Draft PRs (#256–#347),
#346/#347 Draft/Open/mergeable; #347 exact-head four Actions successful.
No newer open Draft checkpoint observed. Historical reports are not new acceptance.

Source authority: current repository package_macho, scoped_closure.validate_graph,
dependency_identity.verify_local_asset and runtime_inventory.local/stable; requested
package disk contract. Mach-O command names retain Apple's loader.h syntax referenced
in music-package-macho-loader-20261009.md. No host dyld/runtime behavior, system policy,
redistribution or legal conclusion is inferred from disk command syntax.

package_native_graph.py is a separate bounded inspector. It retains typed load commands,
selected architecture/file type/ID/dynamic loader/rpaths and resolves only exact regular
package graph-bound bytes. Root escape, symlink ancestors, canonical-path/case/Unicode
ambiguity, duplicate bindings, bad/missing targets, unsupported architecture/file type,
changed size/digest/tree/image and unexpected dylib IDs fail closed. It never imports,
executes or loads supplied code and never searches environment/system/build directories.

Ordered per-image rpaths expand loader/executable locations relative to the uniquely
bound main executable, not the Helper's directory. Multiple existing resolutions block,
even for equal digests. Unsafe/external search rpaths cannot produce an internal match.
Absolute paths lexically contained in this exact package root can resolve; arbitrary
host absolute paths cannot. Unsupported inherited runpath context remains conservative;
no universal emulation of dyld runtime search or actual loaded-image closure is claimed.

Three classifications: PACKAGE_INTERNAL, APPLE_SYSTEM_CANDIDATE_POLICY_REQUIRED,
BLOCKED_EXTERNAL. All weak/reexport/upward/lazy dependencies remain required, including
weak references. /usr/lib/dyld is a syntax-only loader policy candidate. Canonical
/usr/lib/* and /System/Library/* do not gain approval. Foreign loader paths always block.
Shell interpreter candidates /bin/bash, /bin/sh and /usr/bin/env require policy; env
arguments remain observed, never searched/resolved through a host environment.

All graph-bound Mach-O files are examined, including nested dylibs, Python distributions'
.so modules and lib-dynload images, even when not reachable from main load commands.
Corrupt .so/.dylib bytes cannot disappear by being grouped in a distribution node.
Exact-byte private CPython remains MISSING; its future executable/extension images use
the same inspector. A synthetic CPython fixture proves connection only, not approval.

unsigned_app.inspect consumes the stronger graph gate in addition to anchored generation
and layout; valid file existence/old path observation alone no longer completes package
inspection. A new integration regression proves an unexpected install name blocks the
final candidate even when legacy path-only nativeDiskRoutesComplete was true. Legacy
layout fields/signing candidate output stay conservative and compatible; the authoritative
new fields are packageInternalNativeClosureComplete and externalSystemPolicyComplete.
An executable-relative route can resolve in the new graph while the old externalPaths
view remains conservative. The final validator uses the new graph, not that legacy view.
The preexisting fixture's unsignedDiskComplete assertion is strengthened to false because
its system shell interpreter lacks policy; no tests/skips are removed/added or denial
assertions weakened.

Wrapper observation embeds the same graph, preserving observed/unapproved graph evidence.
CI applies it to exact-head locally built Wrapper bytes and exports per-edge observations
and count summary in the existing artifact. CI Wrapper bytes are not production assets.
packageFilesComplete, packageInternalNativeClosureComplete, externalSystemPolicyComplete,
licenseMaterialComplete, signingComplete, runtimeAcceptance and publicationEligible are
separate. License inventory lists native owning nodes/paths/status without invented text;
material closure remains UNVERIFIED/false. Signing candidates contain dependency leaves,
container inside-out candidates, Helper and main/root stages; cyclic dependency groups
and dependents require explicit review. No signing identity/entitlements are chosen.

New tests: 26 graph methods plus two package integration methods and one Wrapper method
(29 total). Cover loader/rpath/executable success, lexical absolute package equivalence,
root escape, ambiguous rpath, missing/bare target, foreign/system paths, selected universal
architecture, wrong architecture, install ID mismatch/missing/equivalence, transitive
closure, symlink escape, changed bytes, case ambiguity, unsafe rpaths, script interpreters,
unknown main identity, typed weak/reexport/upward edges, lib-dynload/distribution extension,
cycles, executable permissions and private Python native connection.

No lifecycle/shutdown/request/output/RECORD/publication/runtime verifier changes.
parentLaunchAuthenticated=false; parentKernelOriginVerified=false; mappedBytesVerified=false;
actualLoaded=false; runtimeSelectionVerified=false; publicationEligible=false;
exact interruption UNVERIFIED. CI/fixtures never establish physical acceptance.

B: approved Wrapper/Helper/private CPython/stdlib/installed dependencies/native-shared/model/
configuration/manifest bytes MISSING or PARTIAL. Basic Pitch and Demucs htdemucs_6s MISSING.
C: licenses, exact weights and system/interpreter policy UNVERIFIED/POLICY_REQUIRED;
Basic Pitch LICENSE_UNCONFIRMED; Demucs EXTERNAL_LICENSE_VERIFICATION_REQUIRED.
D: Intel/Apple Silicon/iPad/Safari/Gatekeeper/native isolation/real ML/accuracy/performance/
Logic/Keystation physical acceptance UNVERIFIED.
E: signing/notarization/entitlement/external approvals UNVERIFIED; candidate order only.
formal A 0/30; Stage 2 OPEN; Stage 3 NOT PASSED. Software approx 99% is the user's
unofficial planning estimate, not a measured completeness claim or 100% production status.
