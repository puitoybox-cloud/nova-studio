# Recording recovery, unfinished archives and capture metadata

Date: 2026-10-30 JST. Base: PR #540, `1ee250445297b5a83666c5f77366d975c2d670e6`, tree `6750339d80594375e46c0733c4c1bedd0f790703`. The base's 12 workflows were all confirmed successful through the connected GitHub API.

## Production changes

Full WAV Archive now includes unfinished recording journals, ordered binary chunks, hashes and recording metadata. Export refuses active journals, corrupt/missing chunks, frame/byte mismatches, missing owners and concurrent changes. Restore verifies all bytes, checks capacity, creates fresh project/journal identities and commits projects, audio binaries, MIDI histories, settings and journals in one strict transaction. Failed restoration leaves existing data unchanged. Old archives without journals remain supported. The Backup UI and pre-restore safety copy select a full archive when unfinished recordings are known to exist.

PCM capture persists the same recording plan and cycle metadata used by ordinary Take saving. Recovery retains input compensation, start/end positions, accompaniment and lyric settings. Gapless capture is reconstructed at the original frame boundaries with correct Take numbers, including after an earlier Take was committed. Legacy journals without these fields retain the prior single-Take recovery behavior. Damaged PCM tails remain retained and only the verified prefix is consumed.

MediaRecorder now requests one-second data events, queues hash-verified binary journal commits using the existing stores/strict journal transaction, bounds queued work and stops on persistence failure. Stop awaits journal writes; if journal persistence fails, decodable in-memory audio remains eligible for the existing pending-Take retry. Restart recovery seals the journal, verifies all committed encoded chunks, decodes the committed container and uses the existing atomic Take/journal-consumption save. Decode failure or corruption retains the source journal and does not create a Take. Full archives preserve encoded journals without requiring successful decoding during migration.

No new database version. Cache version 1.4.212 is used consistently by standalone and host entrypoints.

## Validation

Seven added fault/recovery tests cover separate-database unfinished PCM archive migration and byte identity, atomic quota rollback/retry, active/corrupt/truncated export/restore refusal, gapless frame boundaries, encoded restart recovery, undecodable/corrupt container retention, and encoded archive/failed-save retry. Fifteen focused journal/capture tests passed. Additional storage-failure checks confirm pending audio is retained.

A second real-browser CI acceptance runs MediaRecorder with a synthetic microphone, SIGKILLs Chromium while encoded chunks are committed, launches a fresh process with the same profile, waits for the real heartbeat expiry, migrates an unfinished archive, and compares decoded PCM before and after recovery. The existing PCM SIGKILL acceptance remains enabled. No Chromium executable is installed in this local environment; browser success requires the new CI result, not the mock decoder tests.

Final local whole-suite regression: 2,702 passed, 0 failed, 109.711 seconds. Syntax and whitespace checks passed.

## Remaining / completion boundary

No.12 and No.23 are still partial. Physical power loss and storage hardware failure are not guaranteed recoverable. Uncommitted tail data is outside recovery. An unfinished compressed container may be undecodable, including codec/browser dependent cases; retained bytes are not a successful recovery. Intel/WebKit and physical microphone acceptance, real recording quality/latency/permissions, full production migration acceptance and explicit unfinished-recording deletion/export controls remain incomplete. Automatic metadata-only backups do not independently include these journal binaries; Full WAV Archive is the complete migration path added here. Legacy gapless journals cannot reconstruct metadata that was never stored.

The 30-feature ledger remains: partial implementation confirmed 28/30, formal partial implementation unconfirmed for No.26 and No.29; all requirements implemented and automatically verified 0/30; final completion 0/30. This is a feature-level acceptance count, not an implementation percentage. See `verification/music-completion-focus-20261030.md` and `docs/music-studio/COMPLETION_MASTER_PLAN_V1.md` for the unchanged broader requirements.

Independent branch/Draft PR only. Existing PRs #510 and #537–#540 and main are not modified. No Ready, Merge, force push or physical Mac operation.

CI follow-up: initial recording recovery run https://github.com/puitoybox-cloud/nova-studio/actions/runs/41056223791 passed the existing PCM SIGKILL test (61,440 committed frames, 48 kHz, byte-identical recovery/archive). The new MediaRecorder harness initially rejected its asynchronous start-event wait state before recording began; allow that state while polling. This is a test harness correction, with production code unchanged. Final browser result still requires the corrected-head run.
