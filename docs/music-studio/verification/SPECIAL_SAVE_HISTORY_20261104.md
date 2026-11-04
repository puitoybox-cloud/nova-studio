# Special save history and recovery — 2026-11-04 JST

Baseline: PR #581, a75fbbe72c3dfe614cc3b03134044c067dbbdd91. GitHub connector confirmed 13/13 successful workflows on this exact SHA.

## Production fix

materialCapture and materialImport appended productionHistory but omitted songVersions.edits. An active production session therefore could not attribute these publications to its timeline. Both now publish a material-library music edit in the same compareAndPut transaction as the library. The library is intentionally outside checkpoint adoption fields; an edit does not make a checkpoint replace the reusable library. Failed CAS publishes neither local nor stored history.

## Save-entry and transaction inventory

| Entry family | Persistence boundary | Existing/new evidence | Remaining acceptance gap |
| --- | --- | --- | --- |
| Project form/autosave, MIDI/lyrics/instrument edits, PCM processing, vocal settings/comp | compareAndPut | Node regression, existing checkpoint/history tests | Real process interruption for every public entry |
| Session, daily history, checkpoint save/apply/undo | versionCommit / compareAndPut | Existing special-entry tests; real Chromium interrupted daily save | Every checkpoint action and uncertain commit boundary |
| MIDI material capture/import | compareAndPut | New session attribution, quota rejection, backup restore; real Chromium SIGKILL before transaction commit and retry for both | Uncertain commit boundary |
| Material create, finished fork, Logic MIDI return | compareAndFork | Existing fork/source conflict/history tests | Real process interruption |
| Vocal recording, imported WAV/reference, rendered Comp/replacement, Auto-Finish WAV | putLongWav | Existing recording byte equality, journal recovery, archive tests | Real process interruption of binary transaction families |
| Dependency binary recovery | putLongWav | Existing dependency repair checks | Complete special-action timeline policy/evidence |
| New/duplicate/import/AI projects | put / compareAndFork / compareAndPut | Existing import/fork tests | Full entry inventory acceptance including new-project provenance |
| JSON backup / complete archive restore | bulk atomic restore, binary and journal stores | Existing additive restore/atomic failure/reopen tests | Real process interruption during each transaction family |
| Automatic backup | putAutoBackup with owned archive bytes | Existing unfinished-journal and history-signature tests | Real process interruption during backup writes and pruning |
| Recording journal append/recovery/deletion/rescue import | journal transactions and atomic binary adoption | Existing recording regression suite | Real process interruption per transaction family |
| Settings, MIDI transfer history | Separate repository stores | Existing persistence tests | Real process interruption and cross-store receipt policy |
| Final export preparation/delivery | compareAndPut | PR #581 export-only session history regression | External file write and receipt are distinct boundaries |

The table groups entries to expose transaction gaps; it is not a claim that every public entry has passed crash acceptance. MS22-A04 and MS30-A02 remain open. Counts remain 60 verified / 135, 75 open (44.44%).

## No.12 / No.23 review since PR #541

Reviewed the baseline ancestry from 9cdae8517a07950a93449c4bff894ecc2008cf62 through PR #581. Changes include automatic archives containing unfinished journals (ac4c700), atomic rescued-recording import (b706c9a), damaged archive/source preservation (f62f7dc), bounded encoded-tail salvage (6221ebc), diagnostic repair (3956be6), portable material libraries (05ac5ef), and later vocal correction (8bc4ae9).

Latest production still retains corrupt/encoded sources, prevents duplicate recovery, stores valid PCM prefixes, imports rescue bytes atomically, and includes unfinished recordings in automatic archives. The recording regression suite exercises these paths. No additional recording-byte defect was established in this review. The discovered material timeline omission affected backup continuity and is fixed here. The Full WAV Archive regression now explicitly checks restored session-linked material edits alongside exact unchanged Take bytes.

## Validation

Full local Node regression: 2,843 passed, 0 failed (252,868 ms). Acceptance proof hashes refreshed for the tested sources; requirement statuses unchanged.

- Targeted production tools / special history / recording suite: 130 passed, 0 failed.
- Updated Full WAV Archive + Take + session-linked material regression: 1 passed, 0 failed.
- Real Chromium persistent-profile test: 1 passed, 0 failed. Normal restart, committed SIGKILL, interrupted daily save, material capture and import; exact previous project retained and retry successful.
- Local runtime initially lacked the default Playwright executable. Reused installed isolated Playwright at /tmp/nova-browser-test/node_modules with its matching Chromium; successful run used NODE_PATH for that installation. No test bypass.

Checkpoint browser regression also passed locally on this runtime (completed=true, errors=[], external=[]); checkpoint acceptance proof hashes refreshed from that run.

Intel Mac, microphone hardware, power-loss and listening acceptance remain separate.
