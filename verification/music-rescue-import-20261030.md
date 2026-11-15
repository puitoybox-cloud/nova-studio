# Recording rescue import and disclosure persistence — 2026-10-30 JST

Base: Draft #542, ac4c70042e47e52a9f8d8d6444d8949c12fb5224. Existing PRs/main remain unchanged.

Production: .nova-recording import is available in the vocal recovery panel. Validate bounded header, metadata, sequence, contiguous offsets, observed digests, exact container length and capacity before storage. Attach to an explicitly selected existing project under a fresh journal ID. Preserve original expected digests, missing positions, consumed frames and encoded bytes; corrupt audio never becomes verified by import. Commit metadata and chunks atomically with an in-transaction destination-project comparison. Reject busy/unsaved/repository changes. Quota or later-chunk failure rolls back all imported records. The existing prefix/codec recovery path performs Take creation separately; source project, Takes, WAV, MIDI and production histories are not rewritten by import.

Repaint now captures the live checkpoint panel's open state and ignores detached-node toggle events. Base CI run 41058986540 failed waiting for the finished Open copy button after browser restart; preceding archive, MIDI, safety-copy and dependency assertions passed. The disclosure race is covered locally; the exact CI failure is not considered resolved until the new browser acceptance passes. No timeout extension or acceptance assertion removal.

Validation: full Node suite 2,714 passed, 0 failed/skipped/cancelled, 114.355 seconds. Subsequent targeted checks: checkpoint 29/29; rescue import/partial-transaction rollback 7/7. Syntax and git diff --check passed. Cache core 1.4.214 / host 1.5.94. Physical browser/Mac verification is not claimed.

Remaining: corrupt journals still cannot enter verified Full WAV Archive; rescue import preserves damage, it does not repair codecs or reconstruct missing samples. Power-loss/uncommitted-tail guarantees and physical Intel/WebKit microphone/latency/permissions/quality acceptance remain. No.12/23 and all-30-feature final completion remain unproven. CI outcome is reported separately for the resulting exact HEAD.
