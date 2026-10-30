# Music production roundtrip follow-up — 2026-10-23 JST

Base: PR #495, f2d500ed697f0ec6807b64b7f1af864335c8d73c.
Original specification read in full through Library on this date: Music_Studio_最終機能仕様書_v1.pdf, 2026-09-30, 5 pages / 166 lines, libfile_fea4127fde5c81919fee8296d5c7647d.

## Production changes

- Returned MIDI track identity is no longer implied by track order, parser ID, name or MIDI channel. Candidate evidence includes quarter-note-normalized note/velocity content, name, channel and program. Renames, reorders and changed IDs remain reviewable. Empty tracks do not constitute note identity evidence.
- Every candidate remains unconfirmed until the user explicitly selects its original track. Unknown tracks remain separate. Duplicate original-track bindings and stale/unknown selections fail before publication. The atomic MIDI duplicate stores confirmed/unconfirmed correspondence alongside note/velocity, tempo and meter differences and retains source project/revision history. Original notes, audio, AI candidates and source project are unchanged.
- Long Master and final Export retain each actual encoded measurement pass: applied output gain, measured LUFS/True Peak/clipping, remaining target gap and peak headroom. At most three records are retained. Final Manifest and saved Export history carry the same trace, through reopen and backup/restore.
- Peak-protected Master UI now explains that further gain would exceed the True Peak ceiling, asking the user to review balance/compression. Processing, target tolerances, peak ceiling, gain caps, compression defaults and audio bytes are unchanged. No forced loudness standard or extra limiter introduced.
- Host and standalone cache version synchronized at 1.4.200.

## Validation and limitations

Local Logic suite: 147/147 PASS including renamed/changed IDs, PPQ-normalized candidate evidence, ambiguity, duplicate/stale manual selection refusal, source preservation, fork/reopen and metadata backup restoration. Focused Export suite: 40/40 PASS including encoded trace/save/restore. Earlier focused combined suite 185/185 PASS before the final manual-confirmation additions. JS syntax and full current-head checks require the final validation record below/PR.

Earlier full-suite run failed because the expanded peak explanation omitted the existing `ピーク保護` label; the label was restored without changing the existing assertion. Earlier failures are not passes. Full final Node, Python, native and real-AI results must be read from exact-head CI; pending/incomplete results do not inherit PR #495's success.

Formal A0/B0/C30 unchanged. The previous all-30 ledger was reviewed against the original specification; this focused production change closes no complete formal feature. No.20 still needs full stable export identity and comprehensive repeated MIDI/Stem roundtrip/native binary restore acceptance. No.18/19 need independent meter conformance and musical listening acceptance; peak-safe gain alone cannot meet arbitrary LUFS targets. No.21 needs complete current-head long-package acceptance. No.22/23 update/crash/forced-exit migration is not newly implemented or certified here. No other formal function is promoted.

Distribution source/license closure (including GCC/LGPL), Developer ID signing, Hardened Runtime entitlements, notarization/stapling and physical Intel Mac/Keystation/iPad/Logic tests remain open. Credentials were not used. No claim of a sale-ready build. No Live Provider calls, new model/sound/demo, Ready/Merge, force push, prior PR/main modifications or original-data deletion.

Follow-up validation: manual confirmation is captured before save-start repaint, tested with a renderer that clears the DOM selection. Logic/home/cache targeted tests 192/192 PASS. First cache-bumped full Node run 2584 total /2582 PASS /2 FAIL (old escaped cache-version expectations); fixed expected versions without removing assertions. Local audio Python 509 run /504 PASS /5 SKIP; skips are not passes. All257 tracked JavaScript syntax checks PASS. Final exact-head CI remains authoritative for native/real-audio acceptance.
