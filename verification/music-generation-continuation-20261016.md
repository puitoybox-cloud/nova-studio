# Music generation continuation — 2026-10-16 JST

Parent PR #429: 05bebf78a422202572165a8a6bad2d1f557d2775. Fresh main: 552d56eafddfd192970c09f7d6278696cf8775c3. All 174 open Draft HEAD/base/mergeability and exact-head check runs fetched; latest remains #429. The parent has six successful workflows/eight executed successful jobs. Existing #427–429 and old worktree are retained.

## Product changes

- Optional reproducible local Melody / Continuation recipes use an explicit seed (0–999999) and low/mid/high register. A/B/C interior scale degrees and rhythm change, cadence and phrase slots remain. No seed preserves the existing generator.
- Generation settings live in candidate values. Family identifiers include the recipe to reject mixing families from different recipes. Actual MIDI Preview/Apply, editor history, MIDI save/reopen and full backup restore use existing production routes. Existing selected-note edits retain their timing; rhythm recipes affect added notes in empty targets.
- The compact existing A/B/C panel has English/Japanese recipe controls. This is a deterministic rule generator, not a model-backed composer or singer.
- Sample zones can be partitioned by their manually declared root pitches, separately per exact velocity layer. Midpoint splits cover MIDI 0–127 per layer. Duplicate roots in one layer reject without changes. Existing source PCM is untouched; editor Undo restores all original mappings.
- Coverage reports actual current Track notes, separating available assignments, key/velocity gaps and unavailable samples. Display caps details at 32 notes; counts include all notes. It does not certify sample musical quality or trim audibility.
- Saved presets can be renamed and duplicated through compare-and-put with repository/editor guards. Track snapshots remain independent; PCM is retained. The 32-preset capacity rejects atomically.
- Existing Sound popup and AI focus panel remain the only entry points. New controls remain within existing scrollable popovers/panels.

## Verification

Eight added Node tests cover deterministic variations/invalid recipes/family identity, actual generated notes plus saved/restored recipes, layered partitioning and nonmutation, coverage, atomic preset rename/duplicate plus restore, capacity and Undo. An older generic DOM fixture was narrowed to its intended fields. Full results and exact-head browser/native CI are recorded in the PR after completion.

Extended real Chrome fixture exercises the new controls at 1440/820/390/1180×820, IndexedDB, retained PCM, recipe restore, actual sample scheduling, console/network and page overflow. Local Chrome binary is unavailable; browser evidence comes from CI and is not claimed before success.

## Remaining work and formal status

AI model composition, AI vocal/Japanese singing synthesis and approved model/runtime distribution remain incomplete. This change adds no model or voice runtime and makes no provider call. No sample pack is supplied. Physical iPad/Safari, Intel Mac/Keystation/microphone acceptance remains unverified.

The previous specification mapping is retained in music-multisample-30-features-20261016.json: No.1–30 C, A0/B0/C30. This is carried-forward conservative status, not a fresh full certification of all 30 feature groups. No completion percentage or 20–30 completed production items is asserted.

No main update, Force push, Ready, Merge, Auto Merge, Live Provider API communication or existing-screen/data deletion.
