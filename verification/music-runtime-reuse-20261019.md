# Music model runtime reuse — 2026-10-19 JST

Parent: PR #465, 9f474e2185ea984bf2b52aee9b96d7fc5605043c.
main remains 552d56eafddfd192970c09f7d6278696cf8775c3.

## Production change

Whole-song bar requests previously rehashed 938,377,284 bytes of fixed model/config
files and built two ONNX sessions on every request. Retain one verified CPU session
pair across requests, avoiding repeat hash/load for unchanged files. Single-entry
cache with file/manifest invalidation, initial SHA-256 verification, post-load file
change rejection, cancellation checks and no fallback after errors. Per-request
prompt/tokenizer/RNG/KV buffers/results remain fresh; no generated content cache.
Existing server generation lock, checkpoints, resume, backup, source protection and
four-instrument postprocessing are unchanged. Retained session memory lasts until
host exit or replacement. One session load/inference call is still noninterruptible.

Expose measured load/total seconds, actual base/token ONNX call counts and MIDI
byte totals in compose responses. Existing real model CI now asserts cold then warm
session use on distinct requests and positive actual ONNX calls. Mock lifecycle
tests do not prove real model performance or musical quality.

## Validation

Local node --test: 2473/2473 PASS, fail/skip 0, 87.472 seconds.
Runtime lifecycle: 7/7 PASS (mock sessions); constraints 8/8, cancellation 3/3,
real HTTPS transport 5/5, startup 4/4 PASS. Python compile, changed JS syntax and
git diff --check PASS. Audio pipeline: 509 run / 504 PASS / five existing skips (32.475 seconds).
Existing ResourceWarnings and intentional HTTP error-path logs remain.
Real model script attempted locally: FAIL, onnxruntime missing. No model assets,
Sinsy, Swift/Xcode or Chrome available locally. No substitute fixture counted as
real inference. New exact-head real model/Sinsy/Swift/browser checks are pending CI.

## Eight-minute acceptance and remaining work

No eight-minute real-model run completed here: duration/measures/output notes/
ONNX calls/seconds/peak memory/checkpoint bytes for such a run are UNVERIFIED.
No new musical-quality acceptance. 64-note source context remains limited; no
full-song learned structural understanding added. Long audio audition/Mix/Master,
source locks, checkpoint reopen/resume retain prior implementation, but are not
newly proven over eight minutes. No external provider calls or new assets.

Formal 30-feature status stays A0/B0/C30; no feature has new proof closing all
nonphysical runtime/backend/policy requirements. Twenty to thirty independent
production items were not completed. Next: actual eight-minute sequential ONNX
resource acceptance, broader source context, interruption/backup-resume at that
length, musical listening quality, HTTPS recovery and signed distribution closure.

## Start inventory

210 open Draft PRs re-read: head/base/mergeable/latest commit/changed files and
exact-head check runs. Latest is #465, with 11/11 completed success check runs.
All file lists fit first page; check-run history beyond first 100 is not audited.
Inventory: music-runtime-reuse-start-20261019.json. Existing PRs/main not changed.
