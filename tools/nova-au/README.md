# NOVA Mix AU — development component, 2026-10-24 JST

This is an actual Audio Unit v2 stereo audio effect, not an inventory executable or MIDI instrument. Stable identity: `aufx / NvMx / NvSt`, Bundle ID `studio.nova.audio.NovaMix`, component version `0x00000100` (0.1.0). SDK factory: `NovaMixFactory`. One input and one output bus, two non-interleaved float32 channels, 22050–192000 Hz; no MIDI input/output bus. Initial Intel build targets x86_64/macOS 12.0, matching the existing wrapper. This does not establish physical compatibility with every macOS/Logic version. The user's Logic version is unknown.

Build on macOS with Xcode: `tools/nova-au/build.sh /absolute/output/directory`. No network dependency fetch, signature identity, notarization, license operation or user-machine installation occurs. CI installs only its own component in the system plug-in directory on its disposable runner to run `auval -v aufx NvMx NvSt`. Do not install it on a user's machine without their instruction. CI artifacts are ad-hoc sealed development components, not a certificate-signed commercial release. Ad-hoc sealing uses `codesign --sign -` and no user/Apple signing identity.

## Real processing

Parameters: 0 Gain −24…+6 dB (default 0), 1 low band −6…+6 dB (default 0), 2 high band −6…+6 dB (default 0), 3 bypass 0…1 (default 0). Targets are quantized to 0.01 dB and published in one lock-free 64-bit atomic; the audio callback snapshots once per block. Values are smoothed with a 20 ms exponential time constant, including bypass. Immediate host automation is supported; scheduled/sample-accurate ramp automation is not advertised. Parameters are read/written through standard AU APIs; UI changes notify AU parameter listeners.

EQ is a deliberately simple first-order parallel-band equalizer: low component from a 180 Hz one-pole filter, high component from the residual of a 4 kHz one-pole filter. Band gain values are not a claim of exact attenuation at arbitrary frequencies; phase/crossover effects apply. Gain 0 and EQ 0 are unity below the output ceiling. Filter tail is advertised as a conservative 50 ms. Processing has a ±0.98 hard safety ceiling, which distorts over-level signals; this is not a transparent mastering limiter. Bypass crossfades to the dry signal and preserves ordinary float audio, including signals above that ceiling. Hostile/nonfinite input is sanitized (finite dry input bounded to ±16). No LUFS, true-peak limiter, compressor or automatic mastering acceptance is claimed.

The callback has no Objective-C, JS engine, mutex, allocations, network, file I/O or inference. Only DSP/filter state, lock-free targets and block peak/RMS stores are used. Control/state operations serialize on a mutex outside the callback. Host reset/reinitialization follows AU host lifecycle rules. UI pause does not gate processing. Output peak and RMS describe the latest rendered block, not integrated loudness or true peak. Proposals remain `audioAnalyzed: false` because their values do not derive from these meters.

## Japanese instructions, approval and context

The AU embeds the exact current `music-studio-logic-instruments.js` source at build time and invokes its new `parseAudioCommand` on the control thread using JavaScriptCore. Existing registry, MIDI planner, batch approvals, backups and ZIP writer are preserved. Instrument recommendation remains separate from this audio-effect route.

Accepted instructions: 「ピアノを柔らかくして」「高音を少し抑えて」 generate A/B/C high-band reductions of 1/2/3 dB, bounded at −6. 「ボーカルをもう少し前に出して」 proposes +0.5/+1/+1.5 dB Gain, bounded at +6; this alone does not guarantee presence or vocal separation. 「前の設定に戻して」 asks the user to approve Undo. Unsupported instructions stop. These are deterministic proposals, not AI inference or measured tonal analysis. A/B/C are parameter alternatives; there is no automatic loudness-matched audition.

Open the existing handoff ZIP yourself and use the AU's file chooser to select `nova-logic-instruments.json`. It is read-only, bounded to 16 MiB, validates the #501 format and rejects duplicate Track IDs. Choose the ID/ch mapping, verify the actual Logic insert manually, and click 対象を確認. Without host Track APIs, neither names nor Track order prove correspondence. The plugin cannot confirm that a registered instrument is installed or is the one sounding in Logic; check the real instrument/version/preset first, stop on mismatch. No instrument is installed, inserted or switched by this AU.

Commands require projectId, trackId and a per-instance UUID. Apply additionally requires an untampered pending proposal, unchanged current values, a matching binding and explicit approval. One grouped Undo restores exactly the prior values, unless later host automation conflicts. Cancellation changes no parameters. Up to 32 in-session Undo entries; pending proposals/history are not restored across reopen. Standard AU ClassInfo retains the host preset name and saves all four parameters and project/Track references. Restoration preserves audio settings but creates a fresh runtime instance UUID and requires explicit Track re-confirmation; this protects duplicated inserts. It does not change Music Studio projects, lyrics, MIDI or Logic project files. Music Studio history is associated by IDs; live bidirectional history synchronization is not implemented.

## Logic and commercial products

The host can read/write this AU's own public parameters. This does not give an insert the ability to find and change sibling inserts, Logic instruments, Patch files or Mastering Assistant settings. Smart Controls and Controller Assignments are documented host-side mapping mechanisms requiring explicit mapping and product/version testing. No such mapping, MIDI CC, keyswitch, internal preset enumeration or GUI automation is sent here. Existing read-only instrument inventory remains detection only. No commercial binary/preset or ownership assumption is included. Unverified products get manual host setup instructions from the existing handoff, never an automatic-success claim.

Suggested insertion after manual confirmation: the matching software-instrument Track's Audio FX slot for its rendered audio, a deliberately selected Bus for group audio, or Stereo Out for the sum. A stereo effect does not provide the instrument itself. Use a copied Logic project, monitor at low level, compare equal playback level and retain independent Logic/Music Studio backups. User confirmation is required for any future Accessibility/helper automation or third-party control adapter.

## Primary sources (checked 2026-10-24 JST)

- Apple AudioUnitSDK, pinned `bd98b31feff57a15989fcfab4cd86dc63382b1ac`: https://github.com/apple/AudioUnitSDK — Apache-2.0, C++23, SDK minimum macOS 11.0. Included notice is retained; only trailing whitespace was removed from AUUtility.h.
- AudioComponent factory/interface: https://developer.apple.com/documentation/audiotoolbox/audiocomponentplugininterface and https://developer.apple.com/documentation/audiotoolbox/audiocomponentfactoryfunction
- AUv2 API: https://developer.apple.com/documentation/audiotoolbox/audio-unit-v2-c-api
- AU properties and state: https://developer.apple.com/documentation/audiotoolbox/general-audio-unit-properties and https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/AudioUnitProgrammingGuide/TheAudioUnit/TheAudioUnit.html
- Logic Controller Assignments: https://support.apple.com/en-mo/guide/logicpro/ctls71c30e80/mac
- Control surfaces and Smart Controls: https://support.apple.com/en-ae/guide/logicpro-css/ctls036b3e21/mac

## Completion boundary

No physical Logic installation/version is available to this task. Actual Logic discovery, Audio FX/Stereo Out load, playback, project save/reopen, owned-product parameter mapping and listening acceptance are unverified. Apple Silicon and iPad are separate requirements. No.5/8/18/19/20 gain implementation evidence only; no formal A/B completion is awarded. Remaining: physical Intel acceptance, signing/notarization/distribution rights review, robust loudness-matched analysis-based proposals and separately authorized, verified host/product adapters. No live provider calls are used.
