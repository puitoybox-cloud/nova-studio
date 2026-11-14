# Installed RECORD and production assembly binding — 2026-10-07 JST

## Result and current checkpoint

The starting GitHub read on 2026-10-06/07 JST found #322 already present:
`848a3dd1e73f3b027e0f0e52a815bb9597eb6a9d`, Draft/Open/mergeable,
base #321 `d0ecf98c932d2955eb0c6fea2c3401a4cc17a6e2`.
All three exact-head Actions were completed SUCCESS. main was
`552d56eafddfd192970c09f7d6278696cf8775c3`. Therefore this independent
branch continues exact #322, rather than duplicating or modifying #321/#322.

Two concrete production assembly gaps were repaired:

1. The existing installed distribution check compared its RECORD-derived file
   footprint with approved files, but did not check the authenticated CSV's
   internal hash/size values. `verify_closure` now verifies exactly one RECORD
   beside the authenticated METADATA, checks every row against the same exact
   approved file graph, and rejects missing/duplicate/extra/escaping/unsafe rows,
   invalid CSV, wrong sizes/hashes, altered bytes and budget violations.
   Installed optional hash/size fields remain explicit omissions, never evidence.
   Every file still receives independently anchored SHA-256 byte verification.
   Declared SHA-256/384/512 hashes are supported; other algorithms are rejected,
   without fallback. Metadata is bounded to 1 MiB, rows to 4096; file reads use
   64 KiB chunks and the existing bounded artifact verifier/cache.
2. The offline assembler had manifest-to-graph identity checks that the actual
   launcher did not use. That existing logic now lives in `verify_assembly` and
   is shared by offline inspection and `prepare`. Missing local bindings are
   explicitly rejected. Exact dependency versions, model revisions and
   executable/native/model/source file digests/sizes cannot disagree with the
   caller's anchored manifest. The actual Popen source preflight now rechecks
   the entire assembly, in addition to the existing executable and source checks.
   A changed/incomplete assembly fails before the actual spawn call.

An original-source regression reproduced the first gap: an authenticated RECORD
with a deliberately incorrect internal file hash passed #322's assembly checker
and is rejected by this implementation. Only disposable local synthetic files
were used. No fixture becomes a production runtime or model.

The installedRecordInventory reports distribution ID/version, artifact digest,
RECORD digest/size, row count, declared hashes and explicit omissions. It does
not confer approval, license permission, compatibility or mapped-native integrity.
Existing License-File material inclusion remains separately reported.

## Source and scope

Primary specification checked 2026-10-07 JST:
https://packaging.python.org/en/latest/specifications/recording-installed-packages/
The installed RECORD is CSV with path/hash/size, relative paths are based at the
parent of dist-info, and hashes/sizes can be omitted. This strict product assembly
supports safe relative script paths within its explicitly approved generation;
it rejects absolute external paths and unsupported hash algorithms. All selected
files must be explicitly approved even when the packaging specification permits
an omitted hash or optional generated file.

This work adds no candidate graph, trust schema, dependency, endpoint, secret,
model/runtime download, system installation or policy choice. #322's native
x86_64/arm64 executable resolver, authenticated artifact hashing, model slots,
source/license separation and owned kqueue exit observations remain intact.

## Validation and remaining limits

Local Node 1831/1831 PASS, fail/skipped 0. Python 310 total, 305 PASS with five
unchanged existing unavailable-dependency skips; no test was deleted, newly
skipped or weakened. Thirteen new tests cover RECORD integrity and actual
launcher/offline gate wiring. Synthetic fixtures now include genuine disposable
RECORD CSVs; prior identity/license/stamp assertions are preserved.
Exact-head Actions supply macOS Python, Swift/build and Chrome evidence in PR.

| Requested production area | Current scope |
| --- | --- |
| Private runtime layout | Existing generation-root/native resolver and explicit inventory; actual CPython/stdlib/native payload is not present. No private runtime completion claimed. |
| Intel/arm64 resolution | Explicit separate current-CPU binding and actual image verification inherited from #322; physical native/translated execution unverified. |
| Byte identity | Bounded per-file verifier plus strengthened actual installed RECORD and anchored manifest binding; no unbounded asset read introduced. |
| Installed dependency/native closure | Approved actual files required; metadata candidate 65-node/110-edge profiles are not approval. Native loader/transitive execution remains unverified. |
| NOTICE | Authenticated installed license material inclusion inherited; record footprint also covers included materials. Full redistribution/NOTICE/native scope remains open. |
| Basic Pitch/Demucs slots | Anchored digest/size/revision mismatch now reaches actual launcher gate. Actual weights remain MISSING; permission/compatibility remain unverified. |
| Private Swift delivery | Existing hooks remain SOURCE_ONLY/PARTIAL; no installed owned pipe endpoint or private Swift delivery claimed. |
| Exact owned live-handle | Retained Popen/kqueue exit observation inherited; interruption-capable exact descendant handle remains UNVERIFIED. |
| Stop boundary | Authenticated graceful stop and bounded wait retained. No hard interruption without an exact owned live handle; no PID/group signal added. |
| Strict eligibility | Actual package mismatch fails before spawn. Runtime/native/network/model/physical gaps remain fail-closed. |

Basic Pitch exact weights permission remains LICENSE_UNCONFIRMED; Demucs
htdemucs_6s permission remains EXTERNAL_LICENSE_VERIFICATION_REQUIRED. No new
model permission evidence was established here. #322's primary source evidence
is retained; source licenses are not weights/native redistribution approval.

Reviewed repository-only software gaps discovered here: **2 repaired**; remaining
known gaps in this reviewed assembly scope: **0**. This is not an exhaustive claim
that private native delivery, all OS adapters or the complete product are finished.
A/B/C/D/E retain #322's categories: A reviewed scoped software fixes complete;
B assets/anchors open; C ready user decisions 0; D physical pending/unverified;
E private delivery/OS-native execution and exact handles open.
Formal A **0/30**, Stage 2 **OPEN**, Stage 3 **NOT_PASSED**.

Next shortest safe checkpoint: connect the existing native_host/final_sink hooks
through creator-owned bounded inherited pipes to the Swift lifecycle, and verify
its scoped shutdown acknowledgement without promoting it to native containment
or a termination handle. Independently approved per-CPU runtime/model/native
bytes and their license material still need exact inspection when available.
No current user decision or Mac/download/install action is needed.

main, #321, #322 and earlier PRs are not modified. Saved songs and real Backup
are not accessed or modified. Physical-device byte equality cannot be confirmed.
No Ready/Merge/Auto Merge/force push or distribution/signing/notarization/PKI/
storage/retention/GC decision is made.

ティアが今やること：ありません。次のWorkへ進めます。
