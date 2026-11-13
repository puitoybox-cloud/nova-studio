# Music Studio production tabs — 2026-10-17 JST

Parent #451 / 1d2e91ce2bde934f5309da94a442b0231f0a5d1d. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3. Start inventory: 198 open PRs, 196 drafts, fully paginated PR collection; each draft HEAD/base, mergeability, changed files and exact-head check-runs fetched (file/check collections first page only). Parent exact-head 11/11 success. Snapshot: music-production-tabs-start-20261017.json.

## Shipped behavior
- Eight project-preserving production tabs: MIDI, AI, Lyrics/voice, Vocal, compact Mix, compact Master, long WAV Master and Export. Previously Mix/Master opened the long all-tools page and Lyrics lacked these tabs.
- Dedicated AI route shares the real MIDI session, candidate rendering, track selection, Undo/Redo and save; it opens the AI panel without requiring a scroll past the piano roll. The piano remains available through MIDI. Landscape AI panel scrolls proposals internally and keeps production navigation outside the drawer.
- Lyrics route retains encoded project identity and exposes the same stage navigation. The landscape form uses a compact six-column layout; assignment tables are bounded. Buttons retain 44px minimum target height.
- Active stage is labelled with aria-current. Native and standalone route handling reuse existing guard logic, including unsubmitted AI inputs, active recording, dirty MIDI and pending AI adoption. Navigation additionally rejects a pending lyric save.
- Fixed an existing null dereference when opening long Master with no WAV/candidate. A beginner can now open that screen and see the existing import instruction.
- Updated cache bindings for changed Studio/AI panel assets.

## Verification and limits
Local transaction test proves shared AI/MIDI edits, Undo/Redo, blocked dirty navigation, saved navigation, fresh repository backup restoration and exact MIDI equality. All eight tabs render, including empty long Master. New browser acceptance traverses every tab at 1440/1180/820/390, measures overflow and button height, records document height and monitors error/warn and external requests. It does not equate bounded navigation with all editing fitting one screen.

Local Chrome launch could not run: browser executable absent; attempted Playwright browser download returned invalid/truncated ZIP. Swift/Xcode and actual ONNX/Sinsy assets are absent. New-head CI requests browser, real Linux/Intel generation and native checks. Physical Mac/iPad acceptance remains pending. No assertion of 20–30 feature completions or 100% production completion.

## 30-feature status
Names transcribed from repository COMPLETION_MASTER_PLAN_V1.md (2026-10-04 audit of 2026-09-30 v1). Original five-page specification was not available locally for fresh comparison. The table below is a conservative retained classification, not a fresh full-requirement audit. U=UI, B=backend, R=runtime, S=save, X=restore, P=policy, H=physical. Unverified cells mean evidence is insufficient for a complete feature; they do not mean zero implementation. See the parent plan and feature-specific verification for known partial implementations.

| No. | Feature | U | B | R | S | X | P | H | Grade |
|---|---|---|---|---|---|---|---|---|---|
| 1 | MIDI・Track編集 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 2 | MIDI録音 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 3 | 曲構造・音楽情報 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 4 | AI新曲スタート | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 5 | AI制作アシスタント | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 6 | AI安全編集・変更管理 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 7 | AI作曲・曲展開 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 8 | AIアレンジ支援 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 9 | AIコード支援 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 10 | AI歌詞・メロディ制作 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 11 | AI仮歌・対話修正 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 12 | ボーカル録音 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 13 | ボーカル編集 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 14 | ボーカル生成・Harmony | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 15 | ボーカル完成チェック | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 16 | Stem Separation | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 17 | Audio-to-MIDI | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 18 | AIミックス支援 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 19 | AIマスタリング | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 20 | Logic Pro往復連携 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 21 | 最終書出し・配信 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 22 | 保存・曲バージョン | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 23 | Backup・復旧・移行 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 24 | 診断・安全修復 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 25 | AI実行環境・作品保護 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 26 | AI料金管理 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 27 | AIモデル管理・互換性 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 28 | スマートUI | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 29 | 素材・テンプレート | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |
| 30 | 完成版・制作履歴 | partial/unverified | unverified | unverified | partial/unverified | partial/unverified | unverified | pending | C |

A0/B0/C30 retained. No B promotion: routing and a transaction round-trip do not close all subrequirements of a major feature. Conversation AI quality, comprehensive voice editing, long recording, distribution signing/notarization, HTTPS reconnect and other parent-plan gaps are not completed here.

## Physical acceptance checklist
1. MIDI: connect Keystation; record with count-in, disconnect/reconnect; Stop/save; close/reopen; edit and Undo/Redo; save again.
2. AI: open the AI tab; generate actual ONNX A/B/C; audition; partially adopt; switch to MIDI; compare exact notes and save/reopen.
3. Lyrics/voice: assign kana, export/check score, generate actual Sinsy voice, change readings and regenerate selected late-song measures; compare/adopt without changing other takes.
4. Vocal: grant microphone permission; record/Stop; save take; edit timing; publish to Mix; close/reopen and compare synchronization.
5. Mix/Master: import short and long WAV; compare original/saved/candidate; apply; Undo/Redo; generate short and long masters; export and listen.
6. Backup: export full WAV archive; restore in a fresh browser profile; reopen all MIDI/lyrics/takes/PCM; verify editable history and audio synchronization.
7. iPad 1180×820: switch all eight tabs; check save/history access, input keyboard and dialogs. Record any document scrolling; all-editing-one-screen acceptance is still pending.

No main mutation, Ready/Merge, force push, Live Provider API or unlicensed asset addition.

First new-head browser CI passed all 8 tabs at all four sizes with Console error/warn 0 and no external requests. Existing focused Mix test found 5px vertical overflow at 1180×820 caused by added navigation padding; removed that padding while retaining 44px touch targets. Final-head CI must reverify the correction.
