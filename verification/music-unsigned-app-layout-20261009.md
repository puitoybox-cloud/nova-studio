# Candidate unsigned macOS app layout — 2026-10-09 JST

Baseline: Draft #344 exact 765d0396a5079486a2c0eabc25dcfca834a3d248.

This adds a build-side candidate app inspection/assembly entry point, not a new
runtime trust/receipt schema. The existing externally anchored generation graph
must already describe all app-relative bytes. No wrapper binary is copied from
CI or approved by path/name. No relocation of a previously approved graph occurs.
The same approved graph must bind Contents/Info.plist, its Contents/MacOS
CFBundleExecutable, Helper, runtime, stdlib, installed packages, native libraries,
model/config/license/web files. The generation manifest and closure keep their
existing root-relative control paths. This is an inspectable candidate layout,
not a decision about final distribution or runtime launch integration.

```sh
python3 tools/music-audio-pipeline/unsigned_app.py \
  --root APPROVED_APP_ROOT --manifest APPROVED_MANIFEST \
  --anchor EXTERNAL_MANIFEST_DIGEST --build EXACT_APPROVED_BUILD \
  --architecture x86_64
```

Use arm64 for a separately approved Apple Silicon candidate. The existing Mach-O
parser selects the specified slice, including fat images; these tests do not
prove that real dependencies support universal2. Optional --destination stages
only a disk-complete candidate via #344's assembler and verifies its app layout
again. Failed post-copy app validation removes the newly created output.

Checks:
- existing authenticated generation/RECORD/license/stdlib/executable checks;
- exact graph-bound Info.plist and safe CFBundleExecutable basename;
- wrapper must be graph kind EXECUTABLE, executable mode and actual MH_EXECUTE;
- bounded candidate tree: no unsafe symlinks, nonregular or unbound extra files;
- all graph files retain exact digest/size; all actual Mach-O images are parsed;
- existing signature material / selected-slice LC_CODE_SIGNATURE rejected, never stripped;
- explicit architecture and static loader-relative/rpath routes within graph;
- absolute routes never silently permitted (Apple system candidates identified
  separately as POLICY_REQUIRED, not a new system allowlist);
- executable-relative/unresolved/ambiguous routes stay open;
- nested Mach-O and script executable lists; deepest nested signing candidates,
  containing framework/app/xpc/appex code containers, outer app last.

The candidate signing order does not select Developer ID, Team ID, certificates,
entitlements or notarization credentials, and is not a codesign invocation.
No launch, dynamic native load, signing, install, download or API call occurs.
complete=false / publicationEligible=false / runtimeAcceptance=UNVERIFIED remain
even when unsignedDiskComplete=true. CLI success describes only scoped unsigned
disk completeness; missing assets or routes exit 2 with INCOMPLETE. Final
production backend/policy/launcher/device acceptance is not promoted.

Actual app-relative approved manifest/graph/native Wrapper/runtime/dependencies/
models/license material remain MISSING. Existing unapproved source/build CI apps
are not input production assets. Native/shared closure PARTIAL/UNVERIFIED;
Basic Pitch MISSING / LICENSE_UNCONFIRMED; Demucs htdemucs_6s MISSING /
EXTERNAL_LICENSE_VERIFICATION_REQUIRED. Exact actual remaining external paths
and signing targets cannot be confirmed until approved local bytes are supplied.

B: actual approved bytes (Wrapper/private CPython/stdlib/site-packages/native/
models/config/notices).
C: exact redistribution/model/native/system-library policy and license evidence.
D: Intel/Apple Silicon/iPad/Safari/Gatekeeper/real native isolation/ML/accuracy/
performance/Logic/Keystation physical acceptance.
E: signing/notarization/distribution identity and external approval.
parentLaunchAuthenticated=false; parentKernelOriginVerified=false;
mappedBytesVerified=false; exact interruption UNVERIFIED.
formal A 0/30; Stage 2 OPEN; Stage 3 NOT PASSED. Software estimate approx 99%,
unofficial and not measured. No lifecycle/receipt/audit/state/publication changes.

Next safe work without user judgment: build-side conversion of an explicit local
Wrapper build inventory into the existing graph format as unapproved evidence,
and an app-relative missing-slot report. Never mint an approval anchor or promote
CI source/test artifacts. Runtime launch integration/policy remain separate.
