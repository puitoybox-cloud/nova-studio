# Runtime startup follow-up — 2026-10-22 JST

Base: PR #485, 8ace98f5fbe0877b00d1f8067f63f684b0e0bc63.
Main re-read: 552d56eafddfd192970c09f7d6278696cf8775c3.
Open PR pages 1–3: 232 Open, 230 Draft. Latest remains #485; Draft/Open/mergeable, base 13021ac52dc0121cea63b64dea1c82cb2eba18ae. Base exact-head checks 15/15 SUCCESS. These are inherited checks, not this change's validation.

## Implemented production behavior

- Existing launch.py diagnostics now open both fixed-identity ONNX model graphs through the existing production load_runtime implementation and require CPU sessions. Missing assets or fixed dependency mismatches block model-load success.
- Actual loading runs in a disposable offline Python process with a 180-second deadline. The launcher does not retain another model pair while the engine starts.
- The report exposes modelsLoaded separately from assetsVerified, CPU-provider availability and signedDistribution. This field establishes model-load evidence only; no distribution/publication eligibility is granted.
- Engine startup uses the script directory rather than the caller's working directory.
- Launcher shutdown forwards TERM to its owned engine process group, bounds waiting and escalates to KILL, reaps the leader and removes surviving descendants. Regression exercises a real OS child ignoring TERM.
- Linux and Intel Mac generation workflows run the new model gate and launcher lifecycle regressions before real inference validation.

## Local evidence

Python generation: existing 43 plus launcher 2 = 45 PASS; model gate 2 PASS separately. Model gate doubles are explicitly not real inference evidence.
Audio Python: 509 run, 504 PASS, 5 existing skips. Existing ResourceWarning diagnostics occurred.
All repository JavaScript node --check completed successfully; git diff --check and changed Python compilation PASS.
Full node --test was started; completion had not yet been observed when this checkpoint was written.

## Not completed

No redistributable Python/ONNX/native/Sinsy/model/sound package was assembled or accepted. No native Mach-O closure, actual package model load, new real ONNX generation, Sinsy generation, 8-minute production/browser acceptance, Swift/native build, signature or notarization is claimed by this change. Local Swift is unavailable. Physical Intel Mac/iPad acceptance remains with Tia. No signing identity, secret or trust setting was created or changed.

Affected formal areas: No.25 startup/runtime ownership; No.11 benefits from bounded engine teardown. All other requirements are inherited, not recertified. Original specification was not freshly retrieved in this follow-up; prior checkpoint's 30-feature ledger is evidence of previous assessment only. No formal B promotion. Last known A0/B0/C30 retained pending a full requirement reassessment.

Next common requirement: assemble the approved Intel runtime inside the app, inspect actual Mach-O closure and licenses, wire native app lifecycle to the packaged engine, verify package-origin ONNX/Sinsy/sound execution, then complete signing/notarization and physical acceptance. This checkpoint is a partial implementation, not completion of the requested common distribution closure.
