# Recording tail salvage, read-only diagnosis and focused vocal layout

Date: 2026-10-30 JST. Base: Draft PR #544, f62f7dcf1919498f496c90d1f5182ca9e5db55af. Independent branch: fix/music-recovery-layout-20261030.

## Confirmed cause and production changes

The exact-base vocal-layout job 124088002921 failed while a disclosure was open: its fixed rectangle was top 12 / bottom 808 inside the 820px viewport, while document scrollHeight was 837. Fixed disclosures remove elements from the underlying grid and change its remaining row sizing. Bound the landscape vocal shell to the viewport with internal scrolling, preserving all controls and 44px touch targets. The fixed disclosure keeps its existing scroll container. No overflow-hidden clipping or reduced test threshold is used. Other pages and portrait layouts retain their existing behavior. Physical iPad/WebKit acceptance remains separate.

No.12/23: add an explicit “末尾を除いた復旧を試す（原本保持）” action for encoded journals. Normal recovery remains unchanged. Only after whole-container decode fails, this action probes prefixes excluding 1 through at most 8 final committed chunks, with a cumulative 32MiB probe-byte budget. All source chunks must pass the original hash/size checks first. It does not repair codecs, synthesize missing samples, or join across corrupt/missing chunks. Successful output is named Recovered-prefix, disclosed as partial, and saved through the existing atomic Take+recovery-marker transaction. Original bytes remain intact, and a migrated recovered source still rejects duplicate recovery. If every probe fails, no Take is created and all original data stays available for export/reimport. This is useful only when a decoder accepts an earlier prefix; it does not promise recovery of any particular format or tail.

No.24: add read-only journal diagnosis through the existing guarded source reader. It reports hash matches/mismatches, missing positions, observed byte count and valid unsaved PCM prefix frames. Encoded audio is explicitly not certified complete or decodable by matching checksums. Diagnosis does not seal, delete, decode, download, migrate or repair data. The journal metadata is rechecked after reads to reject concurrent changes.

No.22/30: reviewed recovery's existing save path; it already updates the selected Take and automatic production history in the same project/binary transaction. Preserve that path instead of adding a competing storage/history implementation. Existing checkpoint/finished-version/search/archive tests remain part of the full regression run. No feature-wide completion claim is made for these functions.

Cache keys: core 1.4.216, host 1.5.96, compact CSS 1.0.14; version assertions follow those keys. No IndexedDB schema or archive format changes.

## Validation

New tests exercise explicit prefix salvage after default decode failure, exact original-tail bytes, partial naming/warning, duplicate rejection after source rescue/reimport, bounded unsuccessful retries with zero project changes, and read-only diagnosis of missing/corrupt data with unchanged journal metadata and project bytes. Full regression and exact-head CI results are recorded in the PR.

Local Chromium executable is unavailable; the actual layout acceptance runs in GitHub Actions. Node/fake-decoder tests prove orchestration and storage contracts, not real-codec salvage quality. No physical microphone, power-loss or Mac test was performed here.

## Remaining requirements and completion categories

No.12: codec-specific reconstruction, missing/uncommitted tail samples, real microphone permissions/latency/long recordings/audible quality and Intel/WebKit acceptance remain. No.23: Cloud Sync, unidentifiable legacy dependencies, update/separate-device/physical power-loss acceptance remain. No.24: product-wide performance diagnosis and safe repair remain. No.22/30: audible checkpoint A/B, full special-save-path coverage, packaged-app operation and migration acceptance remain.

The 30-row ledger is verification/music-completion-focus-20261030.md, supplemented by verification/music-damaged-journal-migration-20261030.md. Inherited acceptance categories: partial implementation confirmed 28/30; No.26/29 formal implementation remains unconfirmed. All-requirements implementation + automated verification complete 0/30; final complete 0/30. This iteration advances No.12/23/24; it does not re-certify all 30 or compute a completion percentage. Existing PRs #510/#537–544 and main are unchanged; no Ready, merge or force push.
