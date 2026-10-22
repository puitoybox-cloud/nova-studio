# Music Studio native save integration — 2026-10-22 JST

PR #493 is based on PR #490 and retains PR #491 (81a0dc281eb0f97b01f21410c9fc01efdb3956af) and PR #492 (8f00dcf3f492b76172256024719e406deea54b2e) as the two parents of its integration commit. GitHub integration commit bfc36638b041cdbc7a5bf204d71b0e3f3014d447 has local tree d7fd79796804b0ca7eda51f153eb763e56150040. Two textual conflicts were resolved: shutdownBusy retains all guards, including atomic form saves; shutdown regressions retain both PRs' assertions. Atomic metadata/tempo saves, unadopted lyric/prompt protection, native close retry admission and final Export/lyrics/workspace guards are retained.

## Production fixes

Startup probes no longer send unconditional SIGKILL to a group after its leader has already been reaped. They inspect owned live group members, exclude OS zombies, send TERM then KILL only when needed, wait for the direct child, and verify no live member survives. EPERM is accepted only after a fresh OS snapshot proves there is no live group member. Process-table failures, foreign ownership, surviving descendants and direct-child wait failures remain failures. Signal handlers are restored even if cleanup fails. The reported macOS 15.7.9 Intel failure is confirmed in job 119829833670 at HEAD 81a0dc2; a zombie-only group race is the repair hypothesis, not an observed process table from that failed run.

Native shutdown additionally refuses Checkpoint/version transactions and MIDI Stem batches, preventing a close from interrupting those production writers.

## Actual app acceptance added

An explicit --native-acceptance build flag compiles an isolated CI harness into the Intel candidate; normal builds contain no script execution hook. The inventory marks instrumented candidates, and the launcher forwards exactly three acceptance keys only to such a native UI, never the engine. This artifact remains unsigned and publication-ineligible.

The driver launches the actual app entry four times, imports the existing observed_six_notes_stems.mid fixture, edits notes/tempo, creates real ONNX candidates and Sinsy WAV, saves a checkpoint, closes through the native save gate, verifies owned engine shutdown, reopens/compares complete project and audio bytes, edits/resaves, restarts again, and creates the complete archive. A second persistent WebKit store (same fixed origin) starts empty, restores the archive, checks restored content/audio, edits, runs AI and renders a final Master/Stem/MIDI ZIP. Each phase checkpoints a small JSON report; failed/missing phases are not success. This is CI acceptance using a disposable edited MIDI project, not the user's physical Mac or personal song.

## Verification and limits

Local integrated shutdown tests: 27/27 PASS after the added Checkpoint guard. Cleanup ownership/race unit cases: 4/4 PASS. Intel assembly tests: 4/4 PASS. Package entry tests: 4/4 PASS. Model-runtime: 7/7 PASS; constraints: 8/8 PASS. Python compilation and changed-file JavaScript syntax PASS. Full Node and all-tracked-file syntax runs are still awaiting completion at this checkpoint.

Local real startup-process suite FAILED (2 failures/2 errors after the first OS-table implementation): this virtual environment reports a reaped child as still live, and Python-spawned ps failed. This is not treated as a passing Linux OS cleanup test. Ancestor 5de9c825e168b05e5b6314fb014be2d09950977e CI completed the real startup-process suite on Intel macOS and Linux successfully; latest-head results are tracked separately.

The local host is Linux x86_64 with no Swift or Chrome executable; native/UI/generation acceptance requires CI. No physical acceptance claimed. No new production No.20 Logic long-WAV/Stem import implementation is claimed; No.21 full delivery certification is open. GCC/LGPL source/redistribution closure and Developer ID/Hardened Runtime/notarization remain open. No credentials used. Live Provider calls were not made by this Work; CI zero-network/console assertions must finish before being certified.

The original Music_Studio_最終機能仕様書_v1.pdf (2026-09-30), Library ID libfile_fea4127fde5c81919fee8296d5c7647d, was read fully (5 pages, 166 lines). Formal No.24 is diagnostics/safe repair, not Japanese vocals. All 30 formal names and C judgments are retained in music-native-integration-30-features-20261022.json: A0/B0/C30, no feature promoted on tests alone.

Main and prior PR refs remain unchanged. No force push, Ready/Merge, new sound/model acquisition, new demo song or original-data deletion.
