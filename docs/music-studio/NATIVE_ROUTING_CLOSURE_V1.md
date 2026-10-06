# Native routing closure v1

確認日: 2026-10-06 JST.

Base is Draft #310 exact HEAD `5023ba50b4474843c0b0dad6c85b7c2b74f7e142`. Main and all existing PRs are intentionally unchanged.

## Implemented

- Declared Mach-O routing now records LC_RPATH values and resolves only candidates that expand through `@loader_path` to artifacts already authenticated by the runtime contract.
- `@loader_path`, declared-only `@rpath`, and exact absolute paths are matched against the declared artifact index. `@executable_path`, undeclared system libraries, ambiguous candidates, and unsupported routes stay unresolved.
- No filesystem search path, dyld image list, process list, environment lookup, subprocess/tool lookup, or system library probing is used.
- Static load-command routing remains evidence only. It does not claim a verified runtime parent/child loader edge or mapped-page integrity.
- Per-processing-call receipts now validate requested native IDs against the authenticated native contract and bind only those declared handles into a bounded mapped-evidence digest.
- Missing/duplicate/unknown requested native IDs fail closed. Observed exact handles remain `OBSERVED_UNVERIFIED`; they are never promoted to VERIFIED because mapped bytes and runtime routing are not authenticated.
- Existing request/session/input/runtime/model/codec/network/output binding and one-shot response rules remain unchanged.

## Still open pure software boundaries

1. Fat Mach-O slice handling and ELF DT_NEEDED/RPATH/RUNPATH routing are not yet implemented by this adapter.
2. Runtime loader-edge authentication and unexpected native image detection remain unverified.
3. Native syscall/socket/DNS/fetch containment remains unverified. Python audit evidence is not promoted.
4. Basic Pitch / Demucs native dispatch needs actual approved artifact evidence for decoder/resample/inference/torch/writer routes.
5. Swift-owned authenticated launcher result/stop channel, bounded renewal and hard native interruption remain open.
6. Strict browser hashing above the existing 64 MiB cap remains open.

## Separate blockers

Production/backend: approved assembled assets, anchors, concrete binary/generation/selected-pointer publication/reload/cleanup/quota adapters.

Physical: Intel Mac, Apple Silicon, iPad/Safari, Gatekeeper/notarization, real native isolation, real ML/performance, six-note Audio-to-MIDI, Logic and Keystation.

Policy: storage/A-B-C/schema, provider/model/license, distribution/trust/signing/notarization/PKI, retention/GC.

Formal 30-feature A remains 0/30 until full production/backend/policy/physical acceptance is met. Stage 3 is not entered by this software-only change.
