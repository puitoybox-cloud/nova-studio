# Checkpoint audible comparison and acceptance review — 2026-11-06 JST

Baseline: PR #593, `33b3bec5dbafc38c7035c561d9e35c9dc8d499bc`. GitHub API confirmed 13/13 workflows successful. Work is isolated in Draft PR #594; existing PRs and main are unchanged.

## Production behavior

Checkpoint comparison offers A (current saved project), B (selected adoption candidate) and Stop. It renders the authenticated comparison snapshot without saving audio, changing the project revision, or adding delivery/history records. MIDI uses the existing OfflineAudioContext renderer; PCM applies saved edits; WAV/Take bytes are authenticated against the selected snapshot's hashes before streaming saved processing, trims, regions and timeline position. A missing or corrupt historical binary fails closed. The current project's asset metadata is never substituted for historical metadata.

Saved Export plans select sources, mute, gain, offset, compressor and Master targets. Without a plan, MIDI and saved audio are combined; saved MIDI render assets are excluded when synthesizing the live MIDI to avoid doubling the same performance. Reference attachments are not playback tracks. Unplanned playback preserves dynamics and only reduces peaks above -1 dBTP. Capacity is checked before source encoding and after MIDI duration becomes known. Each preview is bounded by the existing compact-export budget.

Cancellation, changed comparison, changed project/repository/route, pending edits and persisted conflicts refuse publication of playback. Switching A/B stops and releases prior playback. Stop also cancels an in-progress render. These actions perform no project write. Hardware listening remains separate from automatic software acceptance.

## Completed acceptance

MS22-A02, Checkpoint可聴A/Bの統合: production entry, actual PCM A/B difference, no writes, stale/cancel refusal, real Chromium MIDI+PCM rendering and HTMLAudioElement playback, adoption and reload Undo/Redo. The browser additionally checks saved routing/offset/compression/Master targets. Source/runtime hash-bound execution evidence is committed separately. No requirement text, denominator or reference tolerance is changed.

64/135 verified; 71 open; 47.41%. Open: 0 implementation gaps, 8 validation gaps, 63 specification/model/license dependencies. This is acceptance coverage, not a percentage of product implementation or final quality.

## Remaining eight validation requirements

| ID | Review result and blocker |
| --- | --- |
| MS12-A02 | PCM and MediaRecorder SIGKILL/restart/Archive regressions exist. All long-duration recording modes and every save/recovery/replacement/Comp entrance do not yet have a complete interruption and history matrix. |
| MS18-A02 | MIDI/PCM/WAV/Take preparation and whole-song mixing exist. All material formats, combinations, offsets and failure/restart boundaries have not been accepted together. |
| MS19-A03 | Independent clipping and steady-state reference checks pass. The hard-onset 12 kHz fixture still differs by approximately 0.53 dB; discontinuous-edge reference agreement is unresolved. |
| MS22-A04 | Added real SIGKILL-before-commit/restart/retry for checkpoint adoption, Undo and Redo. Existing recording journals, Archive and backup checks remain. Full public-entry coverage is still incomplete. |
| MS28-A02 | Existing route/dirty-state/recording protections pass, but every editing state × work-mode transition has not been exhaustively accepted. |
| MS28-A04 | Keyboard and accessibility checks exist for selected workspaces. The complete route/control/focus/announcement matrix has not been accepted. |
| MS30-A02 | Added checkpoint adopt/Undo/Redo interruption and successful retry checks for Session, edit history and daily-record preservation. Remaining special save/publication entrances lack the complete interruption/uncertain-commit/history matrix. |
| MS30-A03 | Finished checkpoints and protected forks survive backup/reload. Every mutation/publication entrance has not been verified against frozen snapshots. |

The grouped public-entry inventory remains `SAVE_ENTRANCE_CONTEXT_20261105.md`; it is not replaced by a lexical call count. This batch's new checkpoint tests do not certify all entries. Node, process crash and actual hardware/power loss are distinct evidence.

## True Peak investigation

Exact existing generated float32 input: `hard-onset-12000`, 48 kHz, phase-offset 12 kHz, amplitude 0.9. Existing production Annex 2 FIR estimate: -0.8325013528 dBTP; committed FFmpeg ebur128 reference: -0.3 dBTP. Additional independent command `ffmpeg -f f32le -ar 48000 -ac 1 -i input.f32 -af aresample=192000 -f f32le output.f32` produced -0.3149370869 dB at output sample 10, near the start boundary. An exploratory reflected-boundary input to the existing FIR produced -0.4029176606 dB, versus -0.8325013528 dB with zero extension. These experiments locate the disagreement around boundary treatment; they do not establish that changing the meter's boundary semantics is correct or prove conformance. Production metering, reference fixture and tolerance remain unchanged. MS19-A03 remains open.

## Evidence and limitations

Full local Node regression and Auto-Finish helper run results are recorded in `verification/music-macless-node-summary.json` and `verification/music-macless-helper-summary.json`. Local Chromium failed to launch because socket() is not permitted. Browser success is claimed only for identified GitHub Actions executions against matching runtime/source hashes.

An initial IndexedDB workflow failed with `material-busy`: the test injected the app script and invoked material publication before `state.loaded` became true. The production busy guard is unchanged. The browser test now waits for initial loading at initial and restarted entry points. Later CI verifies the real public entry and the extended checkpoint interruption tests.

## Review of all 63 decision-dependent requirements

All 63 open A requirements still have explicit C dependencies in the authoritative ledger. Existing common cancellation, history, atomic saving and recovery paths can be exercised without selecting a model; the full Node/helper suites were run. Passing those common paths does not establish model quality, deployment rights, provider pricing, sync conflicts or Logic protocol acceptance. No dependency was removed or treated as automatically approved.

| Decision | Dependent A IDs | Unresolved contract |
| --- | --- | --- |
| MS03-C01 | MS03-A02, MS03-A03, MS03-A04, MS03-A05 | 音声解析方式と品質閾値 |
| MS04-C01 | MS04-A02, MS04-A03, MS04-A04, MS04-A05 | 文章理解・作曲モデルとライセンス・品質基準 |
| MS05-C01 | MS05-A02, MS05-A03, MS05-A04 | 会話理解モデルと実行権限契約 |
| MS07-C01 | MS07-A02, MS07-A03, MS07-A04, MS07-A05, MS07-A06 | 生成モデルとSection配置方針 |
| MS08-C01 | MS08-A02, MS08-A03, MS08-A04, MS08-A05 | Destinationと音源生成モデルの契約 |
| MS09-C01 | MS09-A02, MS09-A03, MS09-A04 | 実音声コード解析モデルと品質基準 |
| MS10-C01 | MS10-A02, MS10-A03, MS10-A04, MS10-A05, MS10-A06, MS10-A07, MS10-A08 | 歌詞生成モデル・読みアクセント方式 |
| MS11-C01 | MS11-A02, MS11-A03 | 歌唱モデルの配布ライセンスと品質基準 |
| MS14-C01 | MS14-A02, MS14-A03, MS14-A04, MS14-A05 | 本人声モデルと同意・ライセンス |
| MS16-C01 | MS16-A02, MS16-A03 | 分離モデルweightと再配布許諾 |
| MS17-C01 | MS17-A02, MS17-A03, MS17-A04 | 変換モデルの対象楽器と精度基準 |
| MS20-C01 | MS20-A02, MS20-A03 | Logic直接操作とlogicxの公式方式 |
| MS21-C01 | MS21-A02, MS21-A03, MS21-A04 | 音源と依存物の再配布条件 |
| MS23-C01 | MS23-A02, MS23-A03, MS23-A04 | Cloud Sync同期先・暗号化・競合・offline方針 |
| MS25-C01 | MS25-A02, MS25-A03, MS25-A04 | 対象モデルの容量・配布許諾・署名公証方式 |
| MS26-C01 | MS26-A02, MS26-A03, MS26-A04, MS26-A05 | 有料Provider・価格根拠・課金取消契約 |
| MS27-C01 | MS27-A02, MS27-A03, MS27-A04, MS27-A05 | Provider交換と旧モデルの互換方針 |
| MS29-C01 | MS29-A02, MS29-A03, MS29-A04 | 文章意味検索モデルとライセンス |

## Final runtime verification

Runtime commit `a10f5d7ebf6a05ea26f67da1cc62389673b61bd1`, tree `c47608f5a6538f7c17df4f90993632bda58d6767`: local staged runtime tree exactly matches the published tree. Final local Node regression: 2,894 passed, zero failed/cancelled/skipped, 227,164.284083 ms. Focused checkpoint suite: 33 passed. Auto-Finish helper: 22 passed.

Exact runtime GitHub Actions: IndexedDB run 42177805786 / job 127760226292 succeeded (steps 6–9: persistent restart/extended checkpoint SIGKILL, atomic MIDI, interrupted deletion, export/history contracts). Checkpoint recovery run 42177805728 / job 127760225736 succeeded (steps 7–9: browser recovery, PCM journal SIGKILL, encoded journal SIGKILL/Archive).

Exact-runtime audible comparison run 42177805765 / job 127760225754 / step 5 succeeded; artifact 13484785857 contains three successful browser cases with matching runtime/source hashes. Supplementary direct production calls also passed saved-WAV rendering, missing historical binary refusal and same-size corrupt-byte refusal (3 checks, separate from the full Node count).
