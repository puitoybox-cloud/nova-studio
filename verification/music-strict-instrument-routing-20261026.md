# Japanese instrument routing — 2026-10-26 JST

Base: Draft #514, b5d571997bdce3401d6eed8bfaf763979517ecd1.
Stable physical acceptance remains #510, 27bfc24a013fa5377821fc30791ea9270882bcc4.

## Implemented production changes

Instrument requests now consume a supported complete sentence instead of matching an instrument keyword anywhere. Negation, deletion, MIDI transpose, mixed families, contradictory/multiple actions and trailing unknown operations cannot issue an instrument plan. Supported legacy examples remain covered. Optional quoted Track name/ID must identify one Track and agree with the selected Track. Track identity retains exact Unicode; only command text uses NFKC normalization. Preview also verifies requested family/ownership against the actual entry. Unsupported compound operations are rejected as a whole; this is not an arbitrary multi-action planner.

A new instruction rejects the previous MIDI approval before any audio/instrument dispatch. Instrument compare/undo/error dispatch removes previous adoption buttons/plans. A/B/C ranking, explicit adoption, immutable baseline proofs, MIDI data, assignment registry/history and existing backup formats remain.

## Scope and formal completion

All 30 requirements/residuals reviewed from verification/music-audio-integration-30-features-20261024.json (original specification transcription/evidence ledger; original PDF not independently reread). A0/B0/C30 retained. No.5/20 instruction/target/approval gaps are narrowed; no complete formal feature is certified. No.18/19 DSP and source/comparison formats are unchanged. No.22/23 existing save/reopen/JSON/backup/export paths are covered by the full Node regression, not new crash/power-loss certification.

Local targeted suite first passed 82/82; after adding exact Unicode identity regression the full final suite must be read from CI/final PR report. Tracked JS syntax and diff check passed. Portable DSP/analysis tests passed (5 DSP rates / 6 analysis rates). New browser scenarios cover unsupported/negated/compound/unknown-target/compare/undo replacement at 1440/820/390/1180px, followed by approval, save/reopen, backup restore, MIDI ZIP and Undo.

Local browser execution unavailable: browser binary absent; download returned truncated/non-ZIP content. Browser and actual Intel/Swift/AU results must be verified in CI, not inferred from older heads. CI/final report supersedes pending statements here.

## Physical acceptance and remaining work

Use only the previously selected #510 package on 2026-10-27. New branch is development, with identical AU identity; do not co-install versions. Actual Logic recognition, macOS/Logic versions, UI/IME, actual automation/multiple instances, commercial instruments/recorded vocals, listening, copied-project save/quit/reopen and complete Logic export/remeasurement remain unverified. Arbitrary Japanese planning, broad musical-quality acceptance, power-loss/migration, signing/notarization and distribution acceptance remain open. Main/#510/#514 unchanged; no Ready/Merge/force push or Live Provider calls.
