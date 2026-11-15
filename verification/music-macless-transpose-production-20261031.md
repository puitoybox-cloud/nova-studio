# Music Studio Macless production acceptance — 2026-10-31 JST

Baseline: PR #550, `5a08add6e8296f6e7076b91d69cc90825e5e0638`.
Independent branch: `fix/music-macless-transpose-production-20261031`.

## Result

135 A requirements; 45 evidence-verified, 90 open (33.33%). Added/deleted requirements: 0. B remains 30, C remains 18. This is scoped software acceptance coverage, not final certification of the 30 features. No Mac operation or paid AI API was used.

Eight requirements newly verified:

| IDs | Production path and acceptance |
|---|---|
| MS01-A02–A05 | Whole-song transpose includes core Bass and every melodic MIDI track; drums stay unchanged. Project major/minor Key, absolute/slash chord symbols, and MIDI key-signature modulation move together. Fixed notes/measures, pitch overflow, unsupported metadata, stale source and modified Preview are rejected before changing the song. One history transaction includes harmony metadata. |
| MS02-A02 | Existing MIDI state transition tests verify disconnect/reconnect, obsolete callbacks, retained notes on quota failure and successful retry/reopen. |
| MS13-A03 | Existing real-PCM Comp crossfade tests verify stereo seam continuity, Undo/Redo, persistence, archive recovery and quota/conflict refusal. |
| MS18-A03 | Existing named Mix path plus two independently saved variants rerender byte-identical WAVs after fresh repository reopen. |
| MS19-A04 | Existing named Master/archive/comparison paths plus two saved Master targets rerender byte-identical WAVs after fresh reopen. |

No.1 saves use the existing atomic compare-and-put repository. Concurrent harmony edits are rejected without overwriting storage. Changes made while saving stay pending; save failure retains the editor transaction. JSON export, backup, reopen and pre-shutdown save are exercised. Original note timing, velocity and extension fields are retained. This operation transposes MIDI and declared harmony; it does not pitch-shift existing recorded WAVs.

Additional production improvements (no extra completed requirement claimed):

- Auto-Finish project import verifies the entire received WAV SHA-256 against the immutable approval digest and checks for approval changes before importing. Damaged data leaves the original project and completed candidates intact. The actual WAV integration test uses an independently calculated digest and exercises import, reopen, Mix edit and Full WAV Archive.
- Local singing refuses a storage-only score conflict before dispatching synthesis. Cancellation during preflight launches no synthesis. Existing generation, source protection and atomic import paths are reused. This does not certify composition, arrangement, lyric-generation or vocal-model quality requirements.
- Cache identities advanced consistently in standalone and host entrypoints; CI now triggers the full Macless suite for changed production editor, application and Auto-Finish sources.

## Validation

- `node --test --test-concurrency=2 tests/*.test.js`: 2,767 passed; 0 failed/cancelled/skipped; 214,451.821723 ms.
- `python3 -m unittest discover -s tools/nova-au/tests -p test_auto_finish_server.py -v`: 22 passed.
- Focused final production/cache suite: 117 passed.
- Two named Mix/Master version acceptance cases: 2 passed.
- Real completed-WAV save/edit/archive acceptance: 1 passed.
- Baseline counterfactual: the seven whole-song transpose cases run against the unchanged PR #550 editor yielded 3 passes and 4 expected failures; current editor passes all seven. This demonstrates the Bass, harmony/lock and Preview-protection regressions.
- `python scripts/music-macless-ledger.py --write` and the read-only validation both passed, checking accepted names, source/runtime hashes and rendered counts.
- `git diff --check`: passed.

Hash-bound complete Node execution evidence: `verification/music-macless-node-summary.json`. The helper runtime and test bytes are unchanged from the existing helper evidence; the 22 cases were rerun this session. Physical browser persistence, crash/power-loss behavior, listening quality and Intel Mac/Logic operation remain unverified here. The repository tests use transactional storage fixtures and generated audio, not physical devices.

## Triage of the initial 98 open requirements

| Classification | At start | Still open |
|---|---:|---:|
| Implementation needed | 11 | 7 |
| Related implementation exists, acceptance incomplete | 24 | 20 |
| C-dependent specification decisions pending | 63 | 63 |

Every original open requirement retains its stable ID and classification in `MACLESS_REQUIREMENTS_V1.json`; the rendered ledger includes all 98 triage rows. C-dependent A requirements remain in the denominator. Common save/cancel code can still be improved before model decisions. Missing dedicated acceptance paths are not certified merely because generic UI/DSP exists.

Next priorities: actual reference-vocal/Take pitch and timing comparison and corrective navigation (MS15-A02–A04); Vibrato correction (MS13-A02); performance diagnosis and safe reduction (MS24-A02–A03); natural-language view routing (MS28-A03). Then audit the 20 remaining model-independent existing paths, especially all-format song Mix, complete save-entry recovery and final-version immutability. The 63 dependent A items require the recorded C contracts before full acceptance.

PR #550 CI at recheck: 26 workflows, 23 success, 3 in progress, no reported failures. New PR CI is reported separately after publication.
