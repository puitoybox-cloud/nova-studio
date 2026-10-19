# Long sequential generation — 2026-10-19 JST

Parent: #466 / 09da6554e036a932911c859691a0518740b2f6a8. Main unchanged.

Production changes:
- Stop token decoding only when the monotonic beat lower bound proves all future events fall outside the requested range. A source-conditioned continuation anchors to its first generated note. Do not stop on a late subbeat alone. Preserve sampled notes inside the requested range; retain the existing 64-event cap and model-session identity verification.
- Return per-candidate events, range termination, ONNX calls and elapsed time. Return RSS where available and the Python process lifetime RSS high-water mark, explicitly distinguished from per-request peak.
- Persist bar runtime measurements in whole-song candidate provenance and display measured per-bar A/B/C total elapsed time and calls after reopen.
- Expire request-ID based composition cooperatively after 240 seconds, including abandoned requests, between existing model checks. Does not interrupt a single native ONNX call.
- Add an actual 480-second/144-bar/576-source-note fixture at BPM72 through the existing production generator: 72 completed bars, durable automatic checkpoints, backup/fresh-session restoration, Resume without redoing completed bars, A/B/C save, source preservation, counts, storage bytes and resource report. Linux CI runs this with fixed licensed real model weights; failure retains a partial artifact. This is a generated fixture, not the user's original music or physical acceptance.

Local verification: initial complete Node2473/2473 PASS (97.835s); focused checkpoint/performance save/backup regression PASS. Python budget5, runtime7, constraints8, cancellation4, HTTPS transport5, startup4 PASS. Audio pipeline509 run/504 pass/5 inherited skips (33.534s), intentional fault logs and existing ResourceWarnings. JS syntax/Python compile and whitespace checks PASS. Full final Node rerun and real-model measurements pending at initial checkpoint publication. Swift/Xcode/Chrome are not locally available.

Initial real whole-song attempt failed before bar1: onnxruntime missing. Isolated scratch runtime provisioning and fixed licensed asset preparation attempted subsequently; results must be reported separately. No estimated speedup, peak-memory reduction, musical-quality completion or eight-minute success is claimed by this checkpoint.

A0/B0/C30 remains provisional and unchanged. Original formal PDF has not been freshly reread in this run, and no entire feature has new closure proof. This work is bounded performance/cancellation/measurement implementation; the requested20–30 independent production items are not completed. Musical voicing algorithms, free-form understanding, HTTPS session renewal, signing/notarization, full Mix/Mastering/Export acceptance and physical listening remain open. Original MIDI/user data/8 screens retained. No Provider calls, unlicensed assets, main/Ready/Merge/force-push changes.

Startup audit:213 Open PRs/211 Drafts; all211 Draft head/base/conflict metadata, latest commits, all changed filenames and exact-head check-runs reread, no pagination overflow. #466 remains latest safe Draft;2 successful execution checks and42 skipped, all on exact09da6554. Older workflow log histories not exhaustively reread.
