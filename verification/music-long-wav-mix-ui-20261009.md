# Long WAV production mix connection — 2026-10-09 JST

Connect saved authenticated WAV Blobs to the existing Music Studio mixing route. Each long asset has actual Gain (-24..24 dB), single peaking EQ and linked Compression controls, Preview, A/B, Save, unified Undo/Redo, processed PCM16 WAV download and cancellation. A is saved processing; B is the checked unsaved candidate. Playback uses a Blob URL and HTMLAudio rather than a full-song AudioBuffer. This is manual local DSP, not an implemented AI recommendation engine.

Use the existing continuous bounded DSP over 16,384-frame chunks. Filter state and compressor envelope persist across chunks. Encode each result separately into a binary Blob; no full-input ArrayBuffer or full-song PCM allocation. Output binary parts still consume browser resources; unlimited length/memory safety is not claimed. Yield between chunks when timers exist. Progress reports processed frames. Cancellation, route/repository/project changes and recording/dirty editor state reject output. Re-read stored metadata before and after processing. All original chunk SHA-256 hashes are checked before rendering. Clipping and invalid settings fail closed.

Settings/history are additive project metadata with at most 100 combined snapshots. Atomic compare-and-put validates storage/editor/cancellation state through completion; quota/error abort keeps the original metadata. Fresh repository reopen and Full WAV Archive preserve history, original bytes, MIDI and unknown fields. Archive reads reject malformed history; external referenced binaries and automatic binary backups remain unsupported. No saved user data or existing PR is changed.

## Verification

Node 1964/1964 PASS; four added regressions cover >2M-frame production render/download, Save/Undo/Redo/reopen/archive history, quota/conflict/cancel preservation, corrupt/invalid/clipping rejection, nonzero continuous DSP equality across different chunk sizes, and A/B Blob selection/lifecycle using an Audio test double. Storage is a structured-clone transactional IDB model, not physical browser acceptance. Audio double does not prove audibility or mobile playback permission.

Python 508 run: 503 PASS / existing 5 skipped. All 180 tracked JavaScript syntax, 53 Python compile, five shell syntax and git diff --check PASS. Production cache keys bumped to 1.4.124; explicit cache assertions updated. Browser 1440/820/390, Console error/warn and external network: UNVERIFIED because installed Playwright has no Chromium executable; no browser download/install attempted. Local Swift/Xcode unavailable. New create-event offline workflow will verify exact published HEAD, Swift and unsigned macOS/iPad simulator builds without adding installs, downloads, signing or provider calls. CI final result is recorded separately in the new PR.

## GitHub evidence

Main re-read: 552d56eafddfd192970c09f7d6278696cf8775c3. 109 Open PRs, 107 Draft; metadata/head/base/mergeability/counts fetched, first-page commits/files and up to 100 exact-head runs read for every Open PR. Historical pages/jobs/logs were not exhaustively audited; do not claim complete history review. #362 is newest and safe: b77ff36566ec9b95f06c8b56cdfee3d6d1a9c6ff, base 0ece49e1b1767e221c9ce5708a97bdc823c19eba, Draft/Open/mergeable. Run 37931975806 and both software/native jobs and decoded logs independently fetched, SUCCESS. Inventory JSON contains source endpoints and current identities.

## Completion limits

Source checkpoint report cites Music_Studio_最終機能仕様書_v1.pdf dated 2026-09-30 and identifies No.18 spatial/collision/audibility/multiple proposals and No.23 full dependencies/automatic binary recovery as unfinished. The original specification was not independently re-read in this increment. This change closes the long-WAV manual processing/settings/history/output connection; it does not complete No.18 or No.23. Software completion %, physical-test-start readiness %, prior percentage delta and global remaining-subrequirement count cannot be confirmed from a fully evidenced denominator. Prior recorded formal A is 0/30; this increment adds 0 and makes no new exhaustive formal-A audit claim.

Next priorities: AI mix proposals/spatial/collision/audibility production binding; external dependency binary archives and automatic binary recovery; actual browser acceptance.

Physical checks deferred together: Intel Mac/iPad Safari long-WAV import, real A/B audibility and mobile playback permission, processed download/sample count, browser restart persistence, archive recovery, actual quota/cancellation/concurrent tabs and memory behavior; native package and Audio-to-MIDI accuracy. No user operation requested now.

Draft only. No Ready/Merge/Auto Merge/force push/main/existing PR mutation, live provider calls, installs/downloads/signing or sales.
