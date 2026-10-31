# Project-source Auto-Finish and session reconnection

Date: 2026-10-31 JST. Baseline: PR #548 official HEAD `fcdd7df8597dcc700389ea684165947232284802`, tree `d359c5f388e33fee35982f773d07bf7991fc916e`.

The previous local `fix/music-finish-production-20261031` worktree remains clean at `b179b062932e6d684cafc980c4a109acdd616893`. Its tree exactly matches the official baseline tree despite different local commit identities. Work is in a separate checkout and independent branch `fix/music-project-stems-reconnect-20261031`. Remote publication uses the official baseline as parent, not the divergent local ancestry. Protected PRs and main are unchanged.

## Production changes

- Export offers explicit selection of 2–16 project MIDI tracks, PCM assets and durable WAV/recorded Takes, with role and additional start offset per source. It does not guess which recordings, instrument samples or previous masters belong in a mix.
- `autoFinishPrepare` renders MIDI through the existing production streaming instrument scheduler. Recorded Takes reuse their saved trim, gain, timing and latency settings; other audio uses the saved Mix processing. Sources are read only, durable WAV hashes are verified by the existing loader, and mono sources become stereo through the existing final-export mixer.
- Each selected source becomes PCM16 stereo, 48 kHz, padded from timeline zero to the same final frame. Invalid role/selection/offset, unsupported rate/channel, nonfinite/clipped conversion, incomplete MIDI frame output, changed sources, storage conflicts, too-short output and capacity overflow refuse publication. Padded output is bounded to 480 MiB total and one hour. The existing MIDI renderer has its own 480-second musical-content limit.
- Prepared files go directly to the existing authenticated loopback helper and Auto-Finish CLI. `project-render` provenance is accepted across the transport and downstream CLI validators. No paid AI API is called. A source change during upload prevents processing; previously saved sources and helper workspaces remain.
- Authenticated session discovery scans the existing persistent helper workspace by project ID. A fresh Runtime recognizes a formerly running session as interrupted and resumable; completed candidates and adoption metadata remain on disk. No lifecycle token is stored in project metadata or reused after restart.
- Explicit reconnect obtains current helper credentials and verifies project ID and audio revision. Other-project/changed-revision/incomplete-upload sessions are retained but refused. A loaded session can resume or show the existing A/B/C and approval-gated WAV actions. Saving into a changed project revision is refused.
- Existing approved-WAV import, Mix/Mastering, export and Full WAV Archive restoration are retained. Cache versions are updated consistently for the standalone entry and hosted Studio loader.

## Evidence and scope

- Node Auto-Finish GUI tests: 15 passed, 0 failed. Includes wrong identity/revision, new-helper authentication, changed-source upload cancellation and existing save/error/operation-lock regressions.
- Project preparation tests: 3 passed, 0 failed. Real application processing of generated PCM fixture projects verifies alignment, stereo, source immutability and rejection of incomplete MIDI renderer output. MIDI test injection verifies the production call boundary; it does not prove real OfflineAudioContext sound quality.
- Durable application/repository tests filtered to Auto-Finish: 2 passed, 0 failed. Authenticated stored WAV plus recorded Take -> aligned stems; approved WAV -> durable save -> fresh repository -> Master edit -> re-export -> Full WAV Archive restore, with original bytes and MIDI retained. The repository uses the existing transactional IndexedDB test model, not physical browser persistence.
- Python helper tests: 11 passed, 0 failed. Includes a new Runtime on the same workspace and real loopback HTTP discovery rejecting the previous token and accepting the fresh token.
- Combined cache/entry/Home compatibility tests: 82 passed, 0 failed (see final PR for the final whole-suite result).
- Existing native CLI Auto-Finish integration: success with developmentFixture=true, including measured stems, A/B/C rendering and adoption gates. Native C++20 engine and section meter compiled locally. These generated tones are regression fixtures, not a user production song or a professional listening verdict.
- Syntax and diff whitespace checks pass. Full Node-suite and remote CI results are recorded in the PR after execution.

## Unfinished acceptance

No user-owned production song is present in this checkout. User-song end-to-end behavior and audible quality: 確認できません. Actual full app quit/relaunch on Intel Mac/WebKit, real OfflineAudioContext instrument rendering, bundled helper relaunch and live GUI -> CLI -> A/B/C -> adoption -> saved WAV -> archive cycle require physical acceptance. The automated Runtime-recreation and UI-reconnect tests establish their separate software boundaries; they are not a claim of physical Mac acceptance.

Changed-revision sessions intentionally require recreating stems; incomplete uploads are not resumed. Session discovery is an explicit button, not automatic candidate adoption. Arbitrary resampling, implicit recording selection, model-quality AI composition and complete natural-language production orchestration are not added here. Existing voice generation and AI composition were not declared complete merely because their MIDI/audio can enter this path.

Thirty-feature verdict remains partial. Full-requirement certified complete: 0/30 under the current master-plan criteria; this does not mean no implementation exists. No percentage or completion date is inferred.
