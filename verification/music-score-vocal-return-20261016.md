# Score → external vocal WAV → production vocal editing

2026-10-16 JST. Parent #437 `d62d36149e47545015016d68394268293360a2b8`.

Adds a real user-selected WAV import on each saved lyric assignment. Origin is explicitly chosen: full score including initial rests, or first assigned lyric note. The operation validates the saved score, streams every WAV sample, retains immutable original bytes and the exact score snapshot, calculates a 240-bin waveform, and atomically commits binary plus metadata to IndexedDB. Selected take opens through existing Vocal navigation, trim/gain/move/latency, Undo/Redo, solo and MIDI-synchronized playback, export and Mix preparation. No engine is invoked or inferred from the imported bytes. WAV has a 120-second / 64 MiB import limit; mono/stereo supported by the existing 16/24/32-bit PCM and float32 decoder.

Guards cover pending edits, MIDI start/recording, vocal/PCM/archive/export operations, shutdown, repository replacement, generation cancellation, changed project, storage revision and quota failure. Invalid score or audio never publishes an asset. Full WAV Archive retains score provenance, original binary, selected take and edit history while remapping asset identities. Metadata JSON alone does not carry WAV bytes.

Verification: focused Node tests cover actual original bytes, score-zero/first-note origins, edit/render, repository reopen, full binary archive restore, malformed/oversized WAV, stale score, dirty/recording guards, atomic quota failure, revision race, repository replacement and invalid provenance. Browser fixture uses normal lyric form and file input at 1440/820/390/1180×820; its outcome is recorded by exact-head CI rather than assumed from the fixture. Local Chromium executable is absent; previous browser-install failure is not treated as a pass. Full-suite results are reported in the PR after completion.

Start audit: all 184 Open PRs (182 Draft), current HEAD/base/mergeability/change counts and exact-head workflow snapshots in the adjacent JSON. Latest saved checkpoint #437; main `552d56eafddfd192970c09f7d6278696cf8775c3`. No preexisting PR or main mutation.

Unfinished: direct MusicXML-to-engine execution, validated engine compatibility, automatic synthesis/return, licensed model/voicebank provisioning, actual neural composition, physical iPad Safari/Mac/MIDI/microphone acceptance and all-editor one-screen acceptance. Runtime probe found no torch/onnxruntime/tensorflow/nnsvs. No approved installed weights or voicebank was established. No Live Provider API request, model download or synthetic-AI completion claim. This is a scoped production import, not 20–30 independent completed features. Formal No.1–30 remains C (A0/B0/C30), carried forward without new full-feature certification. Completion percentage cannot be confirmed.

Primary sources checked 2026-10-16:
- https://studio-neutrino.com/faq/ — general production use and application/system embedding permissions are distinct. Integration approval is not established here.
- https://nnsvs.github.io/notebooks/Demos.html — public demonstration is not evidence of approved locally installed models or production execution.
