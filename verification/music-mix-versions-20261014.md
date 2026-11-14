# Music Studio — named Mix versions and focused PCM workspace

Date: 2026-10-14 JST. Base PR #410: feature/music-landscape-workspace-v1 / 4a5128a1521dc676a45cd626029ad5dcff235a29, freshly Draft/Open/mergeable with six successful exact-head Actions. Main: 552d56eafddfd192970c09f7d6278696cf8775c3.

## Runtime changes

Named inline-PCM Mix versions retain Gain/EQ/Compression/Spatial settings without duplicating or changing original audio. Up to 32 named versions per asset. A complete combination or one processing family can be previewed through the existing real PCM renderer, auditioned with A/B and explicitly adopted via the existing atomic save. Independent Undo/Redo histories remain. Capturing records saved settings, not unsubmitted form values. Partial selection retains other current settings; clipping/stale/tampered previews reject. Invalid version metadata rejects before JSON/Backup restoration.

The new guarded /music-studio/mixing-workspace/:id route retains existing Mix operations and full Mix route. Landscape uses adjacent Gain/EQ/Compression columns; Undo/Redo and AI/Master/Export/long-WAV/version controls remain in disclosures. 4px gaps, 6/10px padding, 12px panels and 44px controls apply to this scope. Expanded production details use internal scroll. Whole-page overflow is not clipped.

## Verification at creation

Six new behavior regressions PASS: actual WAV equality after version recall; partial selection; fresh JSON and Backup Restore with further edits; quota/dirty/conflict protection and retry; legacy/invalid/capacity guards; retained focused-route operations and escaped names. Existing PCM suite 80 PASS. Python 509 executed / 504 PASS / five existing dependency skips. Full final Node, syntax/whitespace and new-head browser/native CI are pending; final PR description supersedes these pending statuses.

Local Chrome install failed with a truncated archive; local browser PASS is not claimed. Local Swift/Xcode are unavailable. The fast exact-head layout job adds real Chrome 1440/820/390 and 1180x820 normal/preview scroll measurement, A/B, settings/version save, fresh document reopen and complete archive byte equality. CI must be read before viewport/native PASS is claimed. Physical iPad/Safari/Intel/audio/MIDI/Gatekeeper acceptance is unverified.

All-editor completion, 20–30 completed production items and 100% are not achieved. MIDI, AI, Mastering and detailed Vocal one-screen closure remain open. Nonphysical blockers include measured microphone/device latency, gapless recording, formant/vibrato, actual MIDI sound-library renderer, approved Japanese singing runtime/models/licenses, cloud architecture, complete conversational execution and native production distribution.

## Formal 30-feature assessment

Original Music_Studio_最終機能仕様書_v1.pdf freshly read 2026-10-14: all five pages / 166 lines, confirmed 2026-09-30. Original scopes retained. Named inline-PCM versions advance No.18/22; they do not establish complete multi-track versions, full-song checkpoints or partial whole-song composition. A requires binding/backend/policy/physical acceptance; B requires ONLY physical acceptance remaining. No promotion: A0/B0/C30.

| No. | Current code evidence | Result | Nonphysical remaining obligation |
|---|---|---|---|
| 1 | music-studio-editor.js; shared Track editing | C | complete target-track/partial-edit product acceptance mapping |
| 2 | music-studio-midi.js; bundled/native MIDI scenarios | C | native distribution/runtime/assets closure |
| 3 | tempo/key/meter maps and transpose | C | real BPM/Key/Scale/section audio analysis quality |
| 4 | music-studio-ai-composition.js | C | practical language/lyrics-driven generation model |
| 5 | music-studio-ai-assistant-panel.js | C | conversational multi-task planning and execution |
| 6 | AI preview/apply/history and edit locks | C | cross-domain specific-change Undo conflicts |
| 7 | AI continuation/family candidates | C | practical full section/time-constrained regeneration |
| 8 | arrangement reference/destination inspection | C | complete regenerated audio/instrument production execution |
| 9 | chord candidates and metadata | C | actual chord analysis/voicing quality |
| 10 | lyrics assignment and guarded previews | C | language generation/accent and practical regeneration |
| 11 | lyric/note data contracts | C | approved real singing renderer and conversational edits |
| 12 | vocalStart/Stop/Save, cycles, Comp, manual latency | C | measured latency and gapless cycle recording |
| 13 | vocalEdit/Render/CompMove and waveform/lyrics correction | C | formant/vibrato correction product implementation |
| 14 | harmony MIDI and preview audition | C | real singing/Double/Chorus assets, consent/license/runtime |
| 15 | vocal analysis and candidates | C | integrated guide-vocal/final-quality decision workflow |
| 16 | Python Demucs adapters and native receipts | C | approved assets/package closure and real quality acceptance |
| 17 | Python conversion/refinement and compare UI | C | approved packaged runtime/assets and full accuracy acceptance |
| 18 | PCM/long-WAV gain/EQ/compression/spatial proposals | C | full non-destructive multiple Mix-version product workflow |
| 19 | productionPreview/master and longMaster/final export | C | multiple Master proposals and measurement quality acceptance |
| 20 | MIDI/WAV import/export retained references | C | full Logic correspondence/difference/roundtrip management |
| 21 | finalPreview/Save/Replay/Download/delivery history | C | real MIDI sound-library rendering and distribution checks |
| 22 | IndexedDB/revision/duplicate/history | C | named checkpoints and partial version composition |
| 23 | full binary archive/restore/legacy validation | C | complete dependency/migration/cloud-sync architecture |
| 24 | scoped diagnostics and validation | C | whole-product performance diagnosis/safe repair execution |
| 25 | offline guards and native processing boundary | C | complete owned native isolation/runtime distribution closure |
| 26 | provider execution remains disabled | C | approved priced-provider ledger/reservations/caps |
| 27 | adapter/provenance/model contracts | C | actual interchangeable approved models/version quality checks |
| 28 | workspace/favorites/project-bound navigation/folds | C | full natural-language UI actions and all-screen layout closure |
| 29 | retained assets/notes/source files | C | complete reusable material save/key/BPM adjustment/text search |
| 30 | production/export histories | C | finished-version locking/search/session/daily timeline |

Safety: new Draft stacked on #410. No main/other PR writes, Force push, Ready/Merge/Auto Merge, Live Provider API or original-data deletion. No guessed assets/licenses. Previous stopped-Work uncommitted state is unavailable in this fresh workspace. Startup enumeration was recovered via authenticated reads after public API rate limiting; retained JSON records Open PRs and each Draft HEAD/base/mergeability/files/latest commit/current-head runs with any failures explicit. Spec excludes arbitrary whole-project historical rewind; this version recall is limited to processing settings and preserves originals.
