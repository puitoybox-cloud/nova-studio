# Damaged recording migration, compressed-source retention and finished search

Date: 2026-10-30 JST. Base: Draft #543, b706c9a1c9bfa1abf07166aa0d13eea3b40c22d4. Independent branch: fix/music-recovery-archive-20261030. Existing PRs/main remain unchanged.

## Production changes

- No.12/23: explicit Full WAV Archive export can preserve damaged unfinished recordings. The opt-in `preserveDamagedJournals` path stores original expected hashes, separately observed transport hashes and missing-chunk positions. Restore verifies observed bytes before the existing add-only strict transaction and preserves original damage under fresh project/journal IDs. It never labels the damaged chunks as verified audio. PCM recovery continues to use only the original-hash-verified prefix. Unknown preservation versions, tampering, truncation and oversized records are refused. Preview/result/UI disclose preserved damaged recordings. Existing verified saved WAV checks remain mandatory.
- Automatic backup remains strict: a damaged journal cannot replace a previous normal backup. Manual export and restore safety-copy export use the preservation path. Missing/unreadable metadata, non-byte records, or capacity violations still block export; this is not unlimited forensic recovery.
- No.12: successful decoding of an interrupted compressed container does not establish end-to-end completeness. Recovery now saves the decoded Take and a recovery marker atomically while retaining the original encoded bytes. A second recovery is rejected, including after archive migration/reopen. Source export and explicit confirmed deletion remain available. Decoder output with more than two channels is rejected in both normal capture and journal recovery, instead of silently dropping channels. Decoder failure still retains all source bytes. The codec itself is not repaired.
- No.30: initial and live project searches now share a predicate. Interactive typing previously discarded finished-checkpoint matches and failed to test text against the query. Finished names and project/song/purpose fields support the same NFKC/case/space normalization without altering stored values.
- Cache markers: core 1.4.215, host 1.5.95. Existing IndexedDB stores, archive header/version and ordinary journal descriptors remain compatible. Old software rejects damaged descriptors it cannot read; use this version for preserved damaged journals. Recovery markers are optional journal fields. Older software does not understand duplicate protection for retained compressed sources; do not recover these containers with an older build.

## Validation

Final production code: entire repository `node --test`: 2,722 passed, 0 failed/cancelled/skipped, 112.425 seconds. Targeted recording suite: 96 passed, 0 failed/cancelled/skipped. Checkpoints: 30 passed, 0 failed/cancelled/skipped. Syntax and git diff --check passed.

New cases cover damaged PCM including missing positions and original hashes, quota rollback and retry, transport corruption/truncation/unknown preservation versions with zero writes, migrated verified-prefix recovery, damaged encoded containers never reaching the decoder, multichannel refusal, retained encoded container and recovery marker after full archive migration, and identical initial/live finished-name search. Existing automatic-backup corruption tests continue to protect the previous complete archive.

The Chromium SIGKILL acceptance script now verifies that original encoded bytes are retained, all recovered markers are present and duplicate recovery is rejected after additive archive migration. It still compares decoded PCM and full archive WAV bytes exactly; no byte-equality acceptance was removed. Local Chromium is unavailable; exact-head GitHub CI results are reported separately. This script is not physical microphone or power-loss evidence.

## No.12/23 remaining

Codec-specific reconstruction of undecodable or missing compressed tails is not implemented. Lost/uncommitted samples cannot be reconstructed by this change. Physical power loss, Intel/WebKit microphone permissions, latency, sustained recordings, audible quality and separate-Mac migration acceptance remain. Cloud Sync is not implemented. Preserved original compressed bytes increase storage until the user exports/deletes them explicitly.

## 30-feature progress

The current completion ledger is verification/music-completion-focus-20261030.md (30 rows). This change advances No.12/23 and fixes a concrete remaining No.30 operation; other feature contracts and their unresolved requirements are inherited, not newly certified. All 30 still have outstanding requirements. Partial implementation confirmed: 28/30; No.26/29 remain unconfirmed for their formal requirements. Feature-wide implementation + automatic-test completion: 0/30. Final completion: 0/30. These are acceptance counts, not an implementation percentage. No measured completion percentage or finish date can be confirmed.
