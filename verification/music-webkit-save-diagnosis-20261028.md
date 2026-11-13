# Music Studio WebKit save-test diagnosis — 2026-10-28

## Starting point

- Repository: `puitoybox-cloud/nova-studio`
- Source branch: `agent/runtime-self-contained-e2e-20261028`
- Source HEAD: `0ec3b7503e3f7eebe04e4fd01e30b157a9cbdd60`
- Source parent: `2acad165a1fd14c8a874933cc16699e76e768344`
- The branch, commits, origin and clean worktree were verified before testing.

## WebKit result

The three save/storage tests still stop in `SERVER_READY` for 20 seconds because this Codex execution environment cannot create the sandbox extensions required by the WebKit child process. The diagnostic log repeatedly reports failures for `com.apple.gputools.service`, `com.apple.coreservices.launchservicesd` and `com.apple.webinspector`. No navigation completion or navigation-failure delegate callback is delivered.

Loading the same disposable HTML with `WKWebView.loadHTMLString` instead of `loadFileURL` produced the same result. That experiment was reverted completely. This isolates the failure from the temporary HTML path and page contents: WebKit navigation is unavailable in this execution layer. No production change and no test skip was added, because either would hide rather than fix the unavailable WebKit process.

## Verification

- Swift tests excluding `MusicStudioFileStorageTests`: 104 executed, 1 environment-dependent contained-component test skipped, 0 failures.
- Full Swift run: 104 passing non-WebKit tests, 3 WebKit save/storage tests failing after `SERVER_READY`, and 1 contained-component test skipped because `NOVA_TEST_COMPONENT` is absent.
- Node full suite: completed with dot reporter and no failures.
- Audio-helper Python suite with the bundled Python 3.12 runtime and loopback permission: 512 executed, 5 expected skips, 0 failures.
- Running that suite with the macOS/Xcode Python 3.9 is not valid: it lacks `hashlib.file_digest`; running without loopback permission also produces bind errors. Neither is a product regression.

## Safety and remaining acceptance

No product source, original Stem, session workspace, token, artifact allowlist, approval/save path, helper lifecycle, existing branch, PR or `main` was changed. The previously built staging component was not present in the retained workspace, so it was not guessed or reconstructed. A SwiftPM Mach-O executable was available, but not a launchable `.app` bundle for GUI automation. Therefore Stem selection through completed WAV saving by GUI clicks, human A/B/C listening quality, long-song acceptance, and Intel Mac Logic Pro 12.3 import remain unverified in this run.

To close the three tests, rerun the unchanged full Swift suite in a normal signed macOS app/Xcode test environment where WebKit child-process sandbox extensions are available. To close GUI acceptance, retain or rebuild an approved staging component, launch the packaged `.app`, and use copied 48 kHz Stems while preserving the original hashes.
