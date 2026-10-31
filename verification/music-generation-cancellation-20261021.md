# Music Studio generation cancellation — 2026-10-21 JST

Original source: Music_Studio_最終機能仕様書_v1.pdf, 2026-09-30, Library libfile_fea4127fde5c81919fee8296d5c7647d, all 5 pages / 166 lines read this Work. The adjacent original-number 30-feature ledger compares every requiredContent and residual. Formal A0 / B0 / C30; no percentage or whole-feature completion claim.

## Production implementation

No.11 AI仮歌・対話修正 / No.25 AI実行環境・作品保護: the existing score/lyrics screen now exposes generation-in-progress and Cancel singing. Each Sinsy request has a unique identity. Cancellation has its own authenticated endpoint and singer registry, separate from composition. Cancellation before arrival leaves a bounded tombstone; reused IDs reject. The client rejects late responses after cancellation, changed metadata/MIDI/lyrics, or repository switches. Duplicate generation is excluded. HTTP failure sends a best-effort server stop request. Normal output still enters the existing durable, source-preserving vocal import path.

Sinsy now runs in an owned OS process group. Cancellation checks occur before launch, during timed waits, after child completion, before WAV return, and before response publication. A 120-second process deadline bounds unreachable-client work. TERM escalates to KILL after one second, children are reaped, descendants are terminated, temporary files are discarded, and the shared compose/sing lock releases on failure. Errors retain a bounded 2048-byte stderr tail. Browser cancellation dispatch has an independent 5-second abort; the original fetch has a 130-second deadline. Import publication uses the existing guarded atomic transaction and is not interrupted by the new network cancel button. Shared job cleanup only runs when begin succeeded.

No new model, sound, service, account, authentication method, price or storage destination chosen. Existing paired HTTPS/cookie/origin/token checks remain. No Live Provider call. Host disconnection can prevent delivery of cancellation; the backend process deadline then bounds termination. Abrupt host power loss is not covered by this in-memory request registry, and unfinished recordings are not made durable by this change.

## Verification

- Full local node --test: 2551 passed, 0 failed/skipped, 160.462 seconds. Initial run: 2549 pass / 2 cache-version assertion failures. Escaped expectations updated to 1.4.199 and entire suite rerun successfully.
- Focused score cancellation / home / external import: 50 passed. Final cancellation-only rerun: 5 passed after notice severity correction.
- Python generation: 43 passed. Actual OS-child tests cover success, bounded failure, before-launch cancellation, active cancellation/reaping, deadline and TERM-resistant child. TLS socket tests cover authenticated singer cancellation, pre-arrival cancellation, composer/singer isolation, shared-lock release, replay and malformed input. These control tests do not claim actual model inference.
- All local JS syntax and git diff --check passed. Final changed JS checked again.
- Local Chrome absent; browser download failed (invalid/truncated download). Local Swift absent. The new-head CI must verify real ONNX/Sinsy, Intel/native/Swift, browser four sizes, full archives/reopen, eight-minute Stem/Mix/Master/Export. Prior #484 exact HEAD 13021ac52dc0121cea63b64dea1c82cb2eba18ae has 14/14 success; this is inherited evidence, not this patch's acceptance.
- Existing browser checkpoint workflow now adds a controlled same-origin HTTP cancellation race at 1440/1180x820/820/390, original project equality, unique request IDs and cancelled-result refusal. Separate real-generation workflow continues actual Sinsy generation. Screenshots and console/external-request reports belong to CI, not a local browser claim.

## Checkpoint and boundaries

Fresh main: 552d56eafddfd192970c09f7d6278696cf8775c3. Latest checkpoint #484, Draft/Open/mergeable, HEAD 13021ac52dc0121cea63b64dea1c82cb2eba18ae, base109a539c1bcc5a5fa715290fc4c936816afb6b60. All231 Open PRs (229 Draft) retrieved with HEAD/base/mergeability, complete changed-file names, immutable commit metadata and returned workflow/status snapshots; start snapshot is adjacent. Workflow retrieval is first-page only, not an assertion that all historical runs were enumerated.

Git HTTPS push has no credential in this environment. Publish final tested tree through the connected GitHub blob/tree/commit/branch tools; do not use force push, rewrite old branches or include local generated Python bytecode. New Draft only. Existing PR/main/Ready/Merge untouched.

## Remaining work and physical preparation

B remains 0: No.11 still requires natural-language partial revision and full production acceptance. No.25 still requires standalone Intel/Apple Silicon distribution closure, verified signing/notarization and cross-device policy acceptance. Signing requires the owner's approved Apple Developer identity/certificate/private-key access and notarization credentials; no such credentials are configured or invented here. No.23 cloud sync still needs user-approved destination/encryption/conflict/offline architecture. No.30 inherited implementation now has green checkpoint CI, but standalone runtime/distribution/policy acceptance is not certified. Other per-function residuals remain in the 30-feature ledger.

Physical tests stay with Tia: use an approved standalone build on Intel Mac; verify Keystation capture/Stop/save/quit/relaunch, actual audio playback and Logic round trip. For singing, load a saved kana-assigned score, generate/cancel, confirm original audio remains, retry, save/reopen, full archive restore and Export. On iPad use the existing paired HTTPS host with a trusted IP-SAN certificate; verify suspension/reconnection, 1180x820 touch and device-local storage. No new hosting/auth/storage decisions were made. Immediate next priority is final-head acceptance followed by concrete standalone runtime/distribution closure, then the nearest feature whose original requirements can all be evidenced.
