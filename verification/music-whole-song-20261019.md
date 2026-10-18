# Whole song production increment — 2026-10-19 JST

Parent checkpoint #461 / 66bc61e43d1102726f0643f9f3e2c63564d1e9d2. main remains 552d56eafddfd192970c09f7d6278696cf8775c3. Existing screens/data retained.

Production changes:
- Explicit contiguous Section coverage across editor song length (1–256 bars); missing/overlapping/outdated sections refused.
- Each bar runs real local model A/B/C sequentially, then combines the three full-song candidates. No automatic adoption or deterministic model fallback.
- Prompt uses the selected melodic track's first 64 overlapping notes per bar; held notes clipped in prompt only; silent bars omit prefix. Source melody is unchanged.
- Per-bar start Key/Tempo/Meter is used. Immediate meter event boundaries use the existing A timeline. Intra-bar key/tempo changes are explicitly refused; intra-bar chords remain unimplemented.
- Confirmed chord review reused only when its MIDI signature is current. A review covering fewer bars leaves other bars without chord conditioning, explicitly visible in candidate details.
- Explicit Section instrument/density/target settings preserved. Existing part replacement retains locked/crossing/outside notes. Fully protected bars remain unchanged.
- One new destination per role is reused across bars. New MIDI drum classification handled by capabilities as well as legacy alias.
- Whole-song Preview/Listen, bar/role partial adoption, atomic MIDI snapshot Undo/Redo, saved candidate reopen and full JSON backup recovery.
- Cancellation, model error, stale source/workspace/project/music discard pending generation; previously published candidates/source retained. Stop discards an in-flight response; it does not terminate server inference.
- Finite Japanese commands require explicit Section: Aメロ/Bメロ/サビ/イントロ/間奏/アウトロ + 静かに/豪華に/ベースだけ作り直す/ストリングスを追加する/もう少し切なく/ピアノ中心に. Unsupported clauses reject the whole preview. Preview lists changes; Set applies workspace settings through Undo and Save. Bass regeneration requires an explicit existing destination. Strings addition generates only new Strings. Piano-centered means Piano-only generation, displayed in UI. Melody preservation clause acknowledges the whole-song hard protection; it does not add a new arbitrary-track lock.
- Rule chord voicings favor a range below the canonical melody. Existing destination ending pitches guide voice leading; first beats interpolate velocity across boundaries. Rich bass alternates root/fifth. These are rule improvements, not independent model instrument composition or proven naturalness.
- Blank bar fields now still honor an explicit role choice. Replacement description corrected. Both entry-point script caches updated.

Verification:
Focused full-song/legacy candidate editing passed 17/17, including stale/stop/failure, Japanese preview, partial adoption, locks, immediate meter boundary, key/tempo changes, Undo/Redo and candidate backup/reopen. Python audio suite ran 509 (504 pass, existing5 skip), local-generation 15/15. Python fixture ResourceWarnings and intentional HTTP failure logs remain; not claimed warning-free. Final full Node run and exact-head CI must be checked separately. JS syntax and git diff --check pass. Swift/Chrome/real ONNX/Sinsy unavailable locally; exact-head CI required. Browser fixture extended for real per-bar model A/B/C, finite Japanese controls, audible candidate transport, partial Bass adoption, save/reopen and MIDI→Mix/Master. Four required sizes remain; no results asserted before CI finishes. Playback transport success is not human listening acceptance.

Original specification read in full from Library on 2026-10-19 JST: Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, pages1–5/166 lines, Library modified2026-09-30. All30 rows reviewed against inherited gaps; no complete backend/runtime/policy closure newly certified. A0/B0/C30.

208 known Open PRs/206 Drafts metadata, exact heads/bases, conflicts, filenames and first-page PR workflow results re-fetched. Status endpoint has no additional status entries. Newer-PR date search returned no successor of461. Audit finished after code implementation began; original instruction's before-implementation all-PR requirement was not met. Full historical failure logs/latest commit body on every older PR were not audited. First-page workflow API does not prove all historical checks. See start JSON.

Remaining: whole-track musical structure/phrase quality, end-to-end real song listening acceptance; independent model multi-instrument generation; intra-bar chord editor and fixed-chord rebase on transposition; seamless Strings ties/fills and quantitative comparison UI; completely free Japanese conversation; signed/native distribution/policy closure and all30 inherited production gaps; physical Mac/iPad acceptance. One-bar sequential inference can be slow; 256-bar limit is validation capacity, not a performance certification. Candidate data duplicates bound source metadata; large-project performance/storage and full8-minute song generation not certified. Requires existing prepared engine and assets; no new model/sample/provider.

No main, Ready, Merge, force push, Live Provider calls or user asset deletion. A new Draft PR is the delivery boundary. This increment is not 20–30 independently completed production features or 100% completion.
