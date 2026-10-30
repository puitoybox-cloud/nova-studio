# No.12 / No.23: durable in-flight PCM recovery

Date: 2026-10-30 JST. Base: PR #539, `22b98546a11f0b4d4e342076a5a426fcaedd64af`.

## Confirmed cause and production change

Worklet PCM blocks were only held by the live recorder until Stop. Process death therefore lost all in-flight blocks, even though the existing final Take transaction was atomic.

IndexedDB schema 7 adds two stores without rewriting existing projects, Takes, MIDI histories, backups or binaries. Before PCM capture starts, a journal records the project identity, sample rate and placement. Every validated PCM16 block has an ordered key and SHA-256 digest. The block and frame count commit together using strict durability. Pending journal writes are serial and bounded to two seconds of audio; quota/error/backpressure stops capture and preserves the verified committed prefix. A 15-second transaction timeout prevents indefinite journal transactions. Normal Stop waits for queued writes before handing the WAV to the existing Take save.

Startup discovers unfinished sessions and exposes an explicit recovery action in the Vocal panel. A session still receiving writes cannot be recovered until its heartbeat has expired for 30 seconds. Recovery seals the journal against further appends, verifies ordered chunks and hashes, and creates a canonical WAV from the valid prefix. Saved Take bytes, project metadata and consumed-frame progress commit atomically. Concurrent recovery or retry cannot duplicate a committed segment. A successful complete save removes the journal in that same transaction. A damaged tail remains stored, while the verified prefix is marked consumed. Existing Takes and source WAV bytes are never replaced. Recovery of the unsaved portion of a continuous recording uses one recovered Take; it does not recreate every original cycle's metadata.

## Tests

Eight added fault regressions cover fresh runtime restoration with byte comparison and old Take preservation; active-session/missing-first-chunk refusal; corrupt/missing trailing chunk prefix recovery; quota failure during append; failed final Take transaction followed by another restart; concurrent recovery; abort between chunk insertion and metadata update; and restart after the first continuous Take has committed.

Initial whole JS regression: 2,693 passed, zero failed (145.752 seconds). The two additional fault cases pass with all eight targeted cases. Final whole JS regression: 2,695 passed, zero failed (172.286 seconds). Syntax and whitespace checks pass.

`scripts/music-pcm-journal-crash-browser.js` is wired into the checkpoint CI. It uses a synthetic microphone with actual Chromium and persistent browser storage, sends SIGKILL while recording, launches a fresh process with the same profile, waits for the real heartbeat expiry, recovers the journal, compares every committed PCM byte and the full WAV archive copy, and rejects a second recovery. Local execution is unavailable because no Chromium executable is installed in this environment. CI results must be consulted; no local process-kill success is claimed. The first CI attempt failed in temporary profile cleanup; cleanup now waits for browser-process exit and cannot mask the original scenario error.

## PR #539 CI cancellation investigation

11 workflows succeeded; Music local real generation was cancelled. Its Linux real-generation job succeeded. All Intel test steps through native startup, inference, restart and package acceptance succeeded; cancellation happened in `ditto` while archiving the ordinary Intel app. Job log begins 2026-10-29 16:24:09 UTC and cancellation is logged at 17:09:22 UTC, about 45 minutes later, matching its `timeout-minutes: 45` limit. The new branch raises only that Intel job limit to 60 minutes. The logs do not independently identify who initiated cancellation, so a manual cancellation cannot be ruled out. Original run: https://github.com/puitoybox-cloud/nova-studio/actions/runs/40911127959

## Remaining limits

This is an incremental production implementation, not whole-feature completion for No.12/23. Physical power failure, Intel Mac/WebKit microphone acceptance, and OS/device guarantees beyond an IndexedDB strict commit are unverified. Uncommitted input, the current worklet block and pending writes may be lost. Compressed MediaRecorder compatibility capture has no restart-durable journal. Browser storage deletion/eviction cannot be repaired by a journal in that same storage. Damaged or empty journals are retained for diagnosis and currently have no dedicated deletion/export UI. Recovered PCM has correct source placement and latency, but does not reconstruct the old recording plan/cycle metadata. Full WAV Archive covers recovered/saved Takes, not unfinished journals. Mac operation is not requested.

Independent branch and Draft PR only; existing PRs/main are not modified. No Ready, merge or force push.
