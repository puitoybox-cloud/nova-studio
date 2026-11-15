# Owned startup probes — 2026-10-22 JST

Partial implementation, not standalone package completion. No formal B promotion.

Source: main 552d56eafddfd192970c09f7d6278696cf8775c3; #486 head 2d1ebf1e320168277ccd2d0e594cd5e7cc211c08 Draft/Open/mergeable. Its real-generation workflow 39687243924 completed SUCCESS. Newer #487 head 093974f5b58e03856149b911890a4428159f7659, base #486, Draft/Open/mergeable, selected as source. #487 native workflow 39689600057 SUCCESS; generation workflow 39689600087 FAILURE: Intel job 119532212950 failed package-entry path comparison (/var versus /private/var), subsequent Intel inference steps skipped. Linux job 119532213235 SUCCESS is development-runtime evidence, not packaged inference. Search returned Open PRs; complete per-PR metadata/file/check enumeration was not completed in this session.

## Production change

ONNX startup model-load and native Sinsy execution probes now own separate process groups. Timeout, interruption, failed loader and normal exit all terminate descendants and reap the direct child. TERM escalates to KILL after one second. SIGINT/SIGTERM end startup with a nonzero exit rather than becoming a recoverable check failure. Error messages retain at most 2048 stderr bytes; probe output over 1 MiB is refused (checked during polling and after exit). The budget is a detection threshold, not a hard disk quota. Output uses disposable files instead of unbounded in-memory capture. No new songs, assets, credentials or external Provider communication.

The Intel path comparison now compares canonical paths, retaining the existing escaping-symlink rejection. Both Intel and Linux generation CI execute real OS process regressions before asset preparation.

## Validation

Generation Python before final output-budget test: 54 PASS. Final focused process regressions 4 PASS and package-entry regressions 4 PASS; changed Python compilation and git diff --check PASS. Full Node, JS syntax and audio suite were started; final results are recorded in the PR after completion. Local Swift/Xcode/Chrome and actual runtime/model bytes are unavailable; no local Intel/native/browser/package acceptance claim.

## Still incomplete

No app, runtime, model or instrument bytes assembled by this change. No package-origin ONNX inference or Sinsy voice generation executed. No clean package launch, native automatic engine lifecycle, package save/reopen/backup/restore or new device/reconnection acceptance certified. Existing graph/assembler approval gates remain intact. Actual relocatable Intel Python, fixed ONNX/numpy/Pillow, Sinsy/dictionary/voice and native dependency/license closure must be supplied and bound through the existing approved graph; development pip installations are not a distributable runtime.

Signing/notarization not performed. Authorized Developer ID Application identity/private key in Keychain, Team ID and approved notarytool credentials/profile remain user-controlled prerequisites. No credentials acquired or used. Packaging, hardened runtime and nested signing validation still require the actual final dependency tree.

Directly improves No.25 startup ownership; No.11 uses the same engine. This does not satisfy either entire formal feature. Original September 30 specification not re-read, so no fresh 30-feature certification. Last known A0/B0/C30 retained, not independently recertified; no progress percentage. The 20–30 substantive improvement target and standalone production goal remain unmet.

Next priority: assemble the approved Intel runtime/model/voice/sound tree with the existing native app and prove package-origin inference and singing, then storage and shutdown/restart, before formal B consideration. Physical Intel/iPad trust and network acceptance remain Tia's checks.
