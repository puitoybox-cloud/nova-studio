# Music restored Export and durable Logic return — 2026-10-23 JST

Source checkpoint: PR #493, 7e923dc25818251a093dc92a2625ffd857ee4920. Main remains 552d56eafddfd192970c09f7d6278696cf8775c3. New work is only on fix/music-restored-export-20261023, Draft PR #494.

## Production cause and correction

Intel job 119874674870 at run 39793379279 failed during native isolated archive restore with `restored final export failed: final-cancelled-or-stale`. Its earlier app assembly, write, edit, and read phases reached the restore phase. Native restore edits and generates AI in the MIDI editor, then calls finalPreview. Progress requestPaint invokes renderRoute on that same non-mixing route; the old renderer unconditionally finalInvalidate()d the active export on every repaint. No corrupt restored project or stale stored revision was established by this error.

Route cleanup now runs when the rendered route changes. Same-route progress does not mutate the final generation, but navigation, explicit cancel, repository identity, serialized project snapshot, dirty MIDI/AI input, recording, archive and shutdown checks remain. Regressions execute real renderRoute on progress paints and reject both navigation and explicit cancellation, preserving the stored project. The complete final-export suite passed 39/39 before the Logic extension. Full node --test at the export-fix tree passed 2568/2568; all 257 tracked JS syntax checks passed.

## Logic return, persistence and archive

The durable Logic WAV return path streams every sample in bounded slices, hashes the complete WAV, checks capacity and authenticates retained binary dependencies. It atomically adds the new version and new binary in a single strict IndexedDB transaction after rechecking the original source. Existing MIDI, musical settings, assets and history are retained. No source song is overwritten. Old short PCM support remains for memory repositories; durable application repositories use the binary-backed path. Full archive restore remaps the audio-return asset correspondence together with the binary identity. A 2.1M-frame regression prohibits whole-file arrayBuffer access, reopens a fresh repository, restores to separate storage and compares every byte. Quota, cancellation and source conflict must publish no fork or orphan binary.

Native acceptance now also returns its actual completed Master WAV through the Logic-return path, exports that separate version, fully exits and reopens it in a fifth app process, then exports again. This is transport acceptance, not physical Logic Pro operation. All original write/edit/read/isolated-restore assertions and real ONNX/Sinsy calls remain. Master, Instrumental, Stem, MIDI, WAV format, loudness/peak/clipping and ZIP integrity production checks remain enabled. Exact-head CI results must be read from PR #494; pending/skipped/failed checks are not success.

## Limits and formal status

The original 2026-09-30 specification (Music_Studio_最終機能仕様書_v1.pdf, libraryFileId libfile_fea4127fde5c81919fee8296d5c7647d) was read in full (5 pages, 166 lines) on 2026-10-23 JST. Formal No.24 is diagnostics/safe repair. No physical acceptance, licensing closure or full-function B closure is inferred from these changes: A0/B0/C30 remains. No.20 still needs comprehensive returned Stem/track mapping and physical Logic acceptance; no inference of track correspondence from filenames is made. No.21/22/23 still require complete product acceptance beyond these scenarios, including update/crash/low-capacity recovery. Source-provenance URLs, source artifacts and redistribution obligations for bundled NumPy GCC/LGPL dependencies remain open; Developer ID, Hardened Runtime signing/notarization and physical trust are not performed. Internal CI candidate remains publication-ineligible.

Default short/one-bar real ONNX can return no audible notes after bounded real-sample retries. Four-bar success is not proof of repairing it. Existing three-attempt distinct seed/cancel/error behavior remains; no fabricated notes, prerecorded results or Live Provider API calls are introduced. Musical commercial quality remains a separate listening acceptance.

Local Python model/constraints/retry/cancellation/transport/package/assembly/native-launch units were run. The actual OS synthesis child suite failed locally (1 failure, 2 errors); this Linux virtual host did not establish OS cleanup acceptance. Swift, app assembly and actual Mac execution must be assessed using Intel CI, not this host. Final PR description records exact-head outcomes.
