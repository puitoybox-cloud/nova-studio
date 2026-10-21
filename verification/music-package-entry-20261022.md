# Package-contained engine entry — 2026-10-22 JST

Partial implementation. This change does not produce a standalone AI app or certify any formal feature as B.

## Source checkpoint

GitHub API read: main 552d56eafddfd192970c09f7d6278696cf8775c3; latest #486 Draft/Open/mergeable, head 2d1ebf1e320168277ccd2d0e594cd5e7cc211c08, base 8ace98f5fbe0877b00d1f8067f63f684b0e0bc63. All three Open PR pages read: 233 Open, 231 Draft. No newer checkpoint. #486 latest commit changes 7 files: launch.py, diagnostics.py, verify_model_load.py, two lifecycle/model tests, generation workflow and startup verification note. Its Intel generation job succeeded; Linux real-generation was still in progress at this observation. Skips are not passes.

## Production code

- Added `MusicStudioEngine`, a foreground package Helper with no PATH/venv/system Python fallback. Missing package files fail closed. Executes isolated Python, with an empty inherited environment and fixed system utility PATH. No credential or trust change.
- Added `package_boot.py`: restricts interpreter and prefix to the app's Python tree, dependency origins to that runtime, Python search paths and assets to Contents. Rejects external symlink targets, host Python and unsupported OS/architecture. Removes inherited Python/dyld/developer asset overrides. Only port and explicit TLS/LAN connection options are accepted; no asset-path override.
- Existing launch and model gate now spawn isolated `-I -B` children with only the fixed engine code directory added. They retain existing model verification, real inference/voice generation routes, cancellation and owned process-group shutdown.
- Existing serving code resolves package Web resources separately from engine assets. Missing/escaping Web resources fail; models/runtime are not made the static server root. Development layout remains supported.
- Generation CI runs package-entry regressions on Linux/Intel; native CI now triggers on engine changes to build the existing Mac/iPad app and test Swift.

Required approved package layout (not assembled by this change):

- Contents/Helpers/MusicStudioEngine (executable)
- Contents/Frameworks/Python/bin/python3 plus relocatable stdlib and fixed packages
- Contents/Resources/MusicStudioEngine/code (existing engine Python modules, vendor files, locks and these entry modules)
- Contents/Resources/MusicStudioEngine/assets (existing prepare.py layout)
- Contents/Resources/MusicStudioWeb (existing staged web resources and licensed instrument assets)

Existing unsigned_app/unsigned_generation assembly and externally approved graph remain authoritative for approved bytes/licenses. This entry does not create an approval anchor, bypass those assemblers, download or copy unapproved dependencies. It has not been bound into an approved graph or the native app's automatic lifecycle yet.

## Local validation

Generation Python: 51 tests PASS, including four new real subprocess/path regressions. Fixture paths are not AI/Mach-O acceptance. Audio Python: 509 run, 504 PASS, 5 existing skips. Full node --test: 2551 PASS, 0 fail/skip. All 256 JavaScript files pass node --check; changed Python compilation, Helper shell syntax and git diff --check PASS. Existing audio ResourceWarnings were observed; no claim of warning-free Python execution. node --check and git diff --check results recorded separately.

## Unresolved mandatory work

No runtime/model/sound bytes were bundled in this change. Runtime assets and Swift are absent on this Linux host. No Intel native build, Mach-O closure, clean package launch, package-origin ONNX inference/Sinsy generation, UI save/reopen/backup/restore, four browser sizes, or physical-device acceptance is certified locally.

The two ONNX files remain fixed by model-lock.json (Apache-2.0 recorded there): 821713887 and 116661381 bytes; total 938375268 bytes, excluding config/runtime/sounds. Their bytes/hashes/licenses were not newly obtained or verified here. Sinsy/HTS/voice notices and source hashes remain in vendor/source-lock; binary dependency redistribution closure is still open. No new sound or model substituted.

Before B: supply and approve a relocatable Intel Python/ONNX/numpy/Pillow/Sinsy/dictionary/voice/runtime library tree; bind entry/code/resources/licenses into the existing approved graph; assemble with existing app; connect owned native lifecycle and UI authorization to the engine; run real package-origin inference and voice generation, cancellation/restart, storage and production acceptance. Complete signing policy and distribution requirements. No.25 is directly improved; No.11 benefits from the same isolated engine path. Other requirements are not recertified.

Last known formal count remains A0/B0/C30; no promotion. The September 30 original specification was not re-read here; the October 21 repository ledger is prior evidence only.

Signing/notarization not performed. Remaining user-controlled inputs: authorized Developer ID Application signing identity/private key in Keychain, Team ID and approved notarytool profile/credentials. None acquired, used, committed or changed. Hardened Runtime/entitlements and nested signing must be validated against the final actual Python/native library tree; no blanket disable-library-validation entitlement added. Physical Intel Mac/iPad, LAN address and certificate trust acceptance remain with Tia.

