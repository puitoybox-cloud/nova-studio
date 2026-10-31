# Music Studio production mastering — 2026-10-20 JST

Original specification: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, Library libfile_fea4127fde5c81919fee8296d5c7647d. Re-read all five pages /166 lines. Formal names/numbers retained in the adjacent 30-feature ledger. A0/B0/C30; no full-feature or physical acceptance promotion.

Base: Draft #477 / 3f104b0d3aeb2543b8e01c4f6f50b0243e0d03ae. Main unchanged at 552d56eafddfd192970c09f7d6278696cf8775c3. Retrieved all 224 open PRs, all 222 Draft metadata/head/base/mergeability, individual latest commit, complete changed filename lists (none over 100) and exact-head checks. No newer checkpoint; #477 has 17 successful exact-head checks. Start snapshot contains each result. No changes to previous PRs.

## Production changes

- No.19 AIマスタリング: quiet PCM and final multistem masters can use measured headroom above the previous 24 dB cap, bounded to 60 dB, still verified after PCM16 encoding for true peak and clipping. Silence/short/nonfinite measurements fail closed. Peak protection and gain-cap limitation are distinguished; actual target attainment/difference is visible.
- No.18 AIミックス支援 / No.19: long-WAV final gain now follows saved EQ, compressor and spatial DSP. It does not alter the compressor's input detector. Additive postGainDb history defaults to zero for legacy records; legacy +/-24 dB input gain remains unchanged. Manual long Mix exposes and retains output gain. Existing versions, comparison, undo/redo, reopen, full binary archive restore and processed export carry the setting. A nonzero post gain cannot take the unchanged-WAV shortcut.
- No.19 / No.21 最終書出し・配信パッケージ: explicit optional stereo-bus Master compression is available in Export, with threshold/ratio/attack/release controls. Continuous linked detector state crosses chunks. The compressed bus is measured before gain calculation, and the actual quantized master is measured again. Mix.wav, Instrumental, Vocal and individual Stem outputs keep their original bus processing. Bypass defaults and old plans remain compatible.
- No.22 保存・曲バージョン管理 / No.23 バックアップ・復旧・移行: master-bus settings are part of saved plans/history, Retry, JSON and complete backup. Quiet long master output is byte-identical after undo/redo and complete archive recovery in regression tests. Invalid settings, stale/cancel and quota protections retained.
- Production host/standalone asset version synchronized to 1.4.192, corresponding cache tests updated. Existing eight-minute browser acceptance checks target attainment or explicit peak limitation and tests acoustic Master compression, reopen, full restore, byte equality and ZIP verification at 1440/1180/820/390.

These are related production subrequirements, not 20–30 independently completed major features. No new listening song or comparison is requested or produced by this change.

## Validation boundaries

Focused initial regressions: 146/146 PASS. Bus-specific preservation/backup/retry/invalid/bypass regressions: 2/2 PASS. Final full-suite, Python, Swift, real ONNX/Sinsy and browser evidence must be read against the final PR HEAD. Local Chromium/Swift are unavailable; do not claim a local execution. Exact-head CI supplies their evidence when completed.

Remaining: independent loudness/true-peak standards conformance and listening quality, full original-spec evidence closure across all 30, native signing/notarization/distribution, HTTPS connection acceptance, long archive restore performance, and physical Mac/iPad acceptance. Gain-only mode still respects peak ceiling and cannot guarantee every arbitrary target. Optional compression is explicit and may alter dynamics; it is not a guarantee of perceptual quality. Existing saved projects should be reopened with this or a newer runtime to interpret additive postGainDb/masterCompressor metadata.

Next priority: finish original-spec requirement closure in a feature with only a small concrete software residual, including standalone runtime/connection and recovery. Do not spend the next increment on more listening fixtures.

The eight-minute acceptance submits the real Export form, including bus controls, and verifies that those controls exist at all four widths. Intermediate-head CI is not attributed to the final head.

## Encoded-output correction

The 4226690 acoustic eight-minute run correctly failed its target requirement: -18.17338499 LUFS at -2.23740809 dBTP, clipping 0. The absolute loudness gate admits additional quiet blocks after amplification; a single pre-gain measurement does not guarantee the requested encoded-output LUFS. No tolerance was weakened. Short PCM, long Master and final bus now re-render from the unchanged source/DSP using measured output feedback, at most three passes, with 0.1 LU target tolerance and the existing 0.002 dB ceiling tolerance. Bounds, cancellation/stale guards and clipping rejection remain active on every pass. Exact saved version recall remains one-pass to preserve its settings. A real quiet PCM fixture with changing absolute gate membership reproduces the issue and passes after more than one render. Full corrected-source Node and new exact-head CI results are pending until explicitly recorded in the PR.

## Full archive restore guard cost

Restore previously serialized every current project and setting again at every WAV decode/hash/Blob staging guard. The acoustic project contains sample PCM metadata, making these comparisons expensive. Chunk work now checks cancellation/unsaved/repository guards immediately and bounds repeated full metadata checks to 50 ms; a frozen or backwards clock cannot bypass the forced exact comparisons before preview publication, before the durable transaction, after binary staging, and in every transaction callback. The strict single add-only transaction, stored-settings comparison, original bytes and rollback remain unchanged. Three new regressions prove bounded metadata reads, byte recovery, and zero writes when in-place state changes occur during reads or at the transaction boundary with a frozen clock. Actual acoustic eight-minute restore time requires final-head CI measurement; no device-independent speed claim.
