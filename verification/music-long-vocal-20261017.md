# Long vocal window replacement — 2026-10-17

Parent #449 / 58a012a0cc15fcdd11b5eb7c11f88143e369ba24. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3. Initial inventory contains all 194 open Draft HEAD/base/mergeability/workflow lookups; no newer Draft. Parent exact-head 11/11 check runs SUCCESS. Inventory does not certify every old Draft's changed files or every commit's check runs.

## Delivered runtime behavior

External score-linked WAV imports now accept >120 seconds within the existing 64 MiB file bound. Local generated imports retain the 120-second guard. Measure replacement reads canonical PCM16 headers and only the selected dry/wet frames using reads of at most 16,384 frames. It validates RIFF sizes, PCM code, sample rate/channel count/alignment and sample count against metadata before indexing audio. Source and candidate outside the requested window are not decoded into full Float32 arrays. Candidate resampling retains absolute project/tempo-map/sample alignment and includes one interpolation lookahead sample. Selected window remains <=125 seconds and combined dry/wet <=12,000,000 channel samples. Original source duration is no longer part of that budget.

The replacement Blob combines original prefix, quantized replacement window and original suffix. Header, length and every byte outside the selection remain unchanged. Crossfade 0–100 ms and gain -24..+12 dB remain supported. Waveform/clipping metadata is measured in bounded chunks across the completed Blob. Before/After uses the same saved trim/gain processing; small sources retain pitch-region preview. Long sources with pitch regions must render those edits first; time-stretched base and edited candidates remain refused. All original/candidate/previous adopted takes remain available. Atomic compare-and-put, generation/repository/dirty/state guards and existing quota-abort behavior remain active. Undo/Redo, fresh reopen, editable take saving, explicit Save for Mix, complete archive/restore remain connected.

Landscape tablet measure comparison opens as a compact dedicated panel inside the viewport, with one spacing scale, >=44px controls, Japanese instructions and visible select → compare → adopt(auto-save) → Mix steps. Summary or Escape closes it. This is improvement of the vocal replacement workspace, not certification of all MIDI/AI/Mix/Mastering screens fitting one screen.

## Validation

Local Node 2383/2383 PASS, zero failures/skips (full suite before final cache-key edits; affected cache-contract suite rerun after edits). Target vocal production 24/24 PASS including 180-second import/replacement, outside byte equality, Before/After equality, undo/redo, reopen, Mix and archive equality. Window reader verifies bounded reads, >125-second selection refusal before IO and cancellation. Existing quota/stale/score/history checks retained. Malformed oversized asset metadata now correctly fails format validation instead of the removed whole-source capacity limit. External WAV >120 seconds is supported; generated imports still reject oversized generated audio.

Python pipeline 509 run / 504 passed / 5 inherited optional-dependency skips. Local generation constraints 6/6, transport 3/3, startup 4/4 passed. Swift/Xcode unavailable locally. Local Chrome installation failed (download archive); no local browser PASS claim. Existing four-size browser script extended to 180-second source and 1180x820 replacement-panel viewport/no-inner-scroll assertions. Real ONNX/Sinsy CI script now adopts a real generated selected measure into a 180-second original, verifies preserved outside bytes and full archive restoration. These final-head CI jobs must pass before claiming their results.

## Remaining

Not 20–30 independent feature completions. All-screen one-viewport certification, >120-second absolute-timeline Sinsy generation, long pitch/time correction, unrestricted WAV encodings, long-recording duration, transport/reconnect full acceptance, distribution/signing/notarization closure and full 30-feature production requirements remain open. Physical Intel Mac/iPad Safari and audible naturalness are unverified. No whole-feature B promotion based on isolated subpath tests: A0/B0/C30 conservatively inherited, not a fresh full certification.

## Later physical check

1. Open an existing song; import a >125-second PCM16 score-linked WAV with explicit origin.
2. Generate a supported selected measure, select original take, open Replace measures.
3. At 1180x820 compare Before/After, set fade/gain, adopt, Undo/Redo; original stays available.
4. Close/reopen, edit/save, Save for Mix, export complete archive, restore as copy; compare sound and placement.
5. Cancel and test unavailable capacity on disposable copies; verify originals remain selectable.

No main/old PR modification, deletion, live Provider call, unlicensed asset, force push, Ready or Merge.
