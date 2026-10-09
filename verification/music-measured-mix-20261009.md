# Measured local mix proposals — 2026-10-09 JST

## Result and source

Close the absent production binding for measured long-WAV mix suggestions. Base is PR #363, exact commit `84e8064e77049f2a268bc305da36c9474c63a4eb`, tree `325fcc1c130a8636fbda9010188c1b7c8e8f53bc`. Fresh API inventory: main `552d56eafddfd192970c09f7d6278696cf8775c3`, 110 Open PRs / 108 Draft, latest #363 Draft/Open/mergeable. Re-read PR details, heads/bases/conflict state/statistics and first pages (up to 100) of commits/files/exact-head Actions for all 110 PRs; no API errors. Historical pagination/all historical job logs are not exhaustive. Immutable inventory is in `music-measured-mix-current-audit-20261009.json`.

Independently re-read and decoded #363 run 37940704239 jobs 113854038918/113854039320: software/native SUCCESS, Node 1966, Python 503 + 5 existing skips, Swift 54 and both unsigned builds success. No previous PR or main writes.

## Actual implementation

- Bounded `mixMeasure` accepts real PCM chunks/async WAV decoding. RMS and sample peak/dBFS, clipped sample count, crest factor, 100ms RMS-window percentiles/dynamic spread, and 200/2000Hz bilinear one-pole crossover energies. State persists across chunks. Histogram memory is constant (161 bins); band measurement is approximate, not LUFS, FFT, source separation or perceptual scoring.
- Two local rule-based editing preferences (-20/-16 dBFS RMS target, -3dB peak headroom target) derive settings from measured RMS/peak, crest/dynamic spread and band energy. Targets are visible preferences, not a measured ideal or a learned AI model. Gain/EQ/compressor settings change with the input. Conservative candidate retains saved timbre/compression; second candidate attenuates dominant approximate band and compresses only large crest. Mono/stereo channels are measured separately before energy aggregation.
- Analyze original and saved A; render and measure both proposed outputs before presenting them. Explicit Japanese explanation, real output metrics and settings. Never publish candidates for silence, source clipping, output clipping, corruption, conflicting/stale state, malformed data, format changes or cancellation.
- Actual UI selection of whole proposal, Gain-only, EQ-only or Compression-only. Every partial combination is rendered through the existing bounded DSP before becoming B. Original raw WAV, saved A and rendered B use authenticated actual Blobs. Stop/Cancel revokes URLs and clears candidates/proposals.
- Save/Undo/Redo/reopen/processed WAV/full archive reuse #363's atomic validated mix history; no writes from analysis or selection. MIDI, unknown fields, original bytes, prior backups stay intact. Small PCM can use the bounded analysis API; its automatic proposal UI is still unimplemented.
- Host and standalone asset versions move to 1.4.125; version assertions move in sync.

## Verification

Local final product tree: `node --test` **1974/1974 PASS**, +8 tests from #363. Added known sine RMS/peak/crest and band discrimination, identical results across uneven chunking, silence/NaN/format/clipping/cancel failure, input-sensitive distinct candidates, partial/all selection, fresh reopen/Undo/Redo/archive/export and original/MIDI preservation, >2M-frame bounded-read analysis with mid-analysis cancel, quota/conflict/tampered candidate failure, real Original/B Blob difference/lifecycle and corruption/concurrent-metadata failure.

`python3 -m unittest discover -s tools/music-audio-pipeline -p 'test_*.py' -v`: 508 run / **503 PASS / 5 existing skips**. All 180 tracked JavaScript syntax, 53 Python compile and five shell syntax PASS; final edited JS syntax and `git diff --check` PASS. Python cache files are not committed.

Swift/unsigned macOS/iPad builds unavailable locally: dedicated offline create-event Actions workflow performs these at exact final HEAD; final PR body reports authoritative remote results. No installs/downloads/signing/provider requests are introduced by this workflow; repository checkout and existing compiler/build actions only. macOS Xcode may resolve existing project components as in the unchanged baseline workflow.

1440/820/390px, browser Console error/warn and browser external traffic **UNVERIFIED**: attempted existing Playwright script, Chromium executable absent. No browser installation/download. Source addition has no fetch/provider/remote-network calls; source inspection does not prove runtime zero traffic. Actual audibility, Mac/iPad permissions and restart durability, memory/quota/concurrent tabs, long output download, archive recovery and native device acceptance remain physical verification. Full output binary Blob parts still consume resources; no unlimited memory/file-length claim. Transactional IDB/Audio test doubles are not physical persistence/audibility evidence.

## Specification and completion accounting

Read current `Music_Studio_最終機能仕様書_v1.pdf` fully on 2026-10-09 JST, confirmed 2026-09-30; 5 pages / 166 extracted lines. No.18 still requires spatial analysis, accompaniment collision and vocal audibility analysis. They are not implemented or counted as complete. Short-PCM auto-proposal UI, measured LUFS/mastering and batch Master/Instrumental/Stem exports also remain incomplete; No.23 external dependency binary archives and automatic binary recovery remain unsupported.

At least one production feature gap closed: real measured local long-WAV suggestions connected to comparison/partial adoption/persistent history. This is a software increment, not formal completion of No.18. Formal A increment **0**; previous recorded global status **0/30**, not a new exhaustive 30-feature formal certification. Software completion percentage, physical-check readiness percentage, percentage delta and global remaining subrequirement count **cannot be confirmed** without a fully evidenced denominator; no guessed percentage or 100% claim.

Next priority: short-PCM proposal UI binding with unified adoption/history, then actual spatial/collision/audibility processing; external binary archives/automatic recovery remain separate required work. Physical checks are collected above, with no device-action request during implementation.

Draft only. No Ready/Merge/Auto Merge/force push/main or prior PR mutation, unauthorized downloads/installs/signing, live provider calls, saved user songs/backups or sales actions.
