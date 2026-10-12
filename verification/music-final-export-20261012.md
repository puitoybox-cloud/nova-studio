# Music Studio selected-audio final export — 2026-10-12 JST

The Mix editor now connects explicit source selection and routing to real audio mix, mastering, aligned stems, MIDI and one ZIP package. Preview never changes the song. Save explicitly adopts the routing recipe and records a prepared-package history. The original assets remain intact. Source waveform edits are still performed in their existing editors.

## Production behavior

- Select sources explicitly; no automatic inclusion of all takes or duplicate masters.
- Classify each selected source as vocal or instrument. Muted sources are excluded.
- Set each source's additional position and gain. Vocal edits and stored recording synchronization are applied before the additional offset.
- Render inline PCM with its saved Gain/EQ/Compression/spatial chain; render durable WAV using saved continuous DSP; render vocal Take/Comp edits with their existing processed path.
- Mix sources in bounded 16,384-frame stereo chunks. Mono feeds both channels; silence pads source offsets and trailing positions. No source truncation or resampling is hidden.
- Measure full selected mix using the existing 48kHz K-weighting, gates and estimated true-peak path. Generate a dynamics-preserving gain master and remeasure actual quantized output. Peak-limited targets are displayed.
- Before/After audition compares actual Mix and Master WAV without adoption.
- Produce Mix.wav, Master.wav, Instrumental.wav and Vocal-Stem.wav when that role exists, plus independently aligned individual source stems.
- Include inspected Type 1 MIDI only when explicitly requested and valid. No synthetic preview tone is silently promoted to a finished instrument sound.
- Package real binary files in a standards-based uncompressed ZIP with CRC32, directory and Manifest.json. Independent direct downloads remain available.
- Save routing settings and a prepared output history atomically with project metadata; a browser download request is not reported as successful delivery to the user's filesystem.
- Recreate output from saved sources/settings on fresh reopen. Full WAV Archive restores original bytes and remaps WAV route identities when assigning new asset IDs.
- Cancellation, changed project/storage, dirty editing and quota errors reject stale output/adoption. Source metadata and audio are retained.

These are connected capabilities within the export workflow, not twenty completed major functions. The requested 20–30 production-item target and whole-product 100% are not established.

## Limits that remain visible

48kHz mono/stereo input only; no automatic resampling. Maximum one-hour timeline, 32 routed sources and 512MiB ZIP (a conservative 480MiB output estimate is checked). Source processing must already be capable of producing an unclipped rendered WAV; the original mix and all stems reject clipping. Reduce source/saved processing gain if required. The master adds gain only, not a new limiter. Existing true-peak estimation has not passed a standards conformance suite.

MIDI notes are exported separately. Final MIDI instrument audio requires explicit rendered WAV import and routing; automatic sound-library rendering remains open. Missing vocal/instrument groups do not produce misleading silent group files. ZIP is a delivery package, not a replacement for Full WAV Archive. Download completion is unverified in ordinary browsers; saved history is marked `prepared`.

## UI audit and verification matrix

| Requested surface | Current evidence |
| --- | --- |
| Home, project list, create/edit project | Existing render routes retained; common CSS/control dimensions reviewed. Existing UI browser script covers these routes. |
| MIDI editing/recording | Existing route and popup-close wrapper retained; shared 44px control rule reviewed. Existing MIDI/capture browser regressions configured. |
| Vocal recording/editing and lyrics | Existing project/lyric routes retained; source-level interaction checks; existing vocal/lyric scripts configured. |
| AI Assistant | Existing embedded support retained; no new provider calls or automatic adoption. Existing AI browser regression configured. |
| Harmony and Mastering | Existing panels retained inside Mix. Final package mastering adds real whole-selected-mix measurement. |
| Mix and export | New compact bilingual routing fieldsets, measurement and audition/adopt/output/history controls. Dedicated real-browser script covers three widths and actual downloads/reopen/archive. |
| Backup/Restore and settings | Existing routes retained. Archive WAV route identity remapping added. Existing browser script covers routes. |
| Dialogs/popups/hidden states | Source paths reviewed; exhaustive visual/interaction coverage is not established. |

Shared label gap 4px, button padding 6px/10px, panel padding 12px remain. Controls now ensure 44px minimum on desktop/iPad as well as narrow screens. Checkboxes sit inside 44px labeled hit regions. New input controls use common typography, dark contrast, wrapping and focus indicators. Existing screens are not rebuilt.

Creation-time evidence: dedicated Node export suite 14/14 PASS; Python 504 PASS + five existing dependency skips. All-JavaScript syntax 196 PASS and whitespace PASS. Final local full Node: 2168 PASS, zero failures/skips. Exact-head/browser/native results must be appended after completion. Local Chrome acquisition failed (invalid/truncated remote browser archive); no local visual/browser success is claimed. CI runs the new script at 1440/820/390 in addition to existing ten-route screenshot and vocal/MIDI/AI regressions. Screenshots are verification artifacts, not physical-device acceptance.

## Formal scope and remaining work

Official Music_Studio_最終機能仕様書_v1.pdf, confirmed 2026-09-30, freshly read all five pages / 166 lines on 2026-10-12 JST. The scoped thirty-feature ledger retains A0/B0/C30 without promotion. No.21 still requires full sound-library/instrument rendering and distribution checks; No.19 still requires full multiple-master/finish-check scope. This patch does not close other major-feature obligations.

Software remaining: automatic measured microphone latency/device compensation; gapless recording loops; formant/vibrato; complete vocal finish assessment; complete instrument synthesis/final package checks; approved Intel singing runtime/Japanese model/voicebank/phonemizer/vocoder/license assets; smart work modes/favorites and native production/distribution closure. Singing assets are not assumed or downloaded.

Physical-only acceptance: Intel Mac/iPad mic/headphones and measured synchronization, human-voice quality, permissions/suspension/restart/storage pressure/touch/Japanese typography, Keystation/Logic interchange, and Gatekeeper/signing/notarization.

## Current source and safety

Main reacquired at 552d56eafddfd192970c09f7d6278696cf8775c3. All 152 Open PRs enumerated; all 150 Drafts independently read for HEAD/base/mergeability/latest commit/all changed filenames/exact-head runs. Twenty-two historical unsuccessful runs and twenty-two failure/cancellation-job logs retrieved; compact dated evidence and log hashes/excerpts are saved in the start snapshot. PR #405 was independently confirmed Draft/Open/mergeable at 33c87c1b8903fa73234d5d488ec2189a65ef4e61 with six successful workflows. New branch is based on exactly that HEAD.

No main/other PR edits, Ready/Merge/Auto Merge/force push or Live Provider API. No existing user song, asset or backup is overwritten. Current sources are stored only in the new Draft branch; cache versions are advanced coherently for host and standalone entry.

Lifecycle follow-up: shared Stop, route departure and pagehide release final audition objects/URLs; other audio owners stop before final audition. Compact input/button baseline explicitly uses 44px. Initial browser regression compared entire ZIP bytes across a metadata-only saved revision change; manifest revision and its ZIP CRC legitimately change. Corrected regression compares every WAV/MIDI byte across fresh reopen while independently validating the real downloaded ZIP. No audio comparison is weakened.
