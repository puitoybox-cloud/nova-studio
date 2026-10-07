# Private runtime unified checkpoint — 2026-10-07 JST

## Source evidence and integration choice

Fresh GitHub reads: main `552d56eafddfd192970c09f7d6278696cf8775c3`; #326 `6c46910c2915c3b7e3810aaa5eeac629cd4e7396`; #327 `96c7d8698847a22afd53dc991c61b0110d5d3902`; #328 `1491d6732155f500cb929d4e927bf9a5cb83eaae`. All three PRs were Open/Draft/mergeable. #327 and #328 share #326 as their exact base, not each other. Initial open list: 73 Drafts (#256–#328), plus #35/#10; latest all-state PR #328. Both exact source HEADs have three successful Actions runs. Sources: https://github.com/puitoybox-cloud/nova-studio/pull/327 and https://github.com/puitoybox-cloud/nova-studio/pull/328.

Select #328 as the independent new branch's exact parent/base because its authenticated source startup command, source-only imports, command budget, worker symlink rejection and deterministic native inventory order are complementary strengths. Integrate #327's private default distribution routing, CPython implementation/version checks, JSON/sysconfig stdlib footprint, preloaded foreign-module rejection and launcher/main activation into the same #328 resolver/preflight authority. Do not keep two activation implementations. Original branches/PR metadata/main are read-only.

| Classification | Observed behavior |
|---|---|
| Both | -I/-S, exact runtime version/executable, private stdlib/package roots, PathDistribution, existing METADATA/RECORD/License-File and architecture verification, Helper/Demucs native-wrapper acceptance, privatePython inventory, fail-closed asset gates |
| #327 only | Safe default verify_closure/verify_assembly lookup; explicit CPython implementation guard; JSON/sysconfig stdlib declarations; rejection of foreign preloaded modules; launcher main activation; eight additional regressions |
| #328 only | -B, approved source embedded in bounded -c startup; source-only loader rejects unbound cached pyc; worker symlink rejection; encoding utf_8 bootstrap; normalized distribution identity; independent child preflight; deterministic parent/child native order; request inventory digest regression; seventeen additional regressions |
| Same purpose, different implementation | #327 runtime.activate_private_python vs #328 private_python_layout/command/preflight; #327 private_distributions vs #328 private_distribution_lookup |
| Actual textual conflict | Read-only git merge-tree shows conflicts in START_AUDIO_PIPELINE.command, demucs_child.py, demucs_parent.py, local_distribution_entry.py, mac-app/NovaMusicAudioHelper, server.py (six files). Nine files overlap; runtime_inventory/scoped_closure/test_native_verification have overlap without textual conflicts. |
| Semantic conflict | A mechanically combined merge would leave two startup authorities, retain ambient default metadata lookup in #328, or lose source-only command/native ordering from #328. #327's post-import activation alone does not provide #328's authenticated source/pyc startup boundary. |
| Complement | Use one private_distribution_lookup; one private_python_layout; one private_python_command; one private_runtime_preflight. Launcher configures paths only after identity/module/assembly validation; Helper and Demucs independently require already-selected exact paths. |

## Software corrections and regression preservation

- Default closure/assembly metadata resolution never consults host-installed distributions; missing private metadata cannot be filled by the host. Exact metadata selection is reused; no new resolver authority.
- CPython implementation and 3.11 identity are checked in the actual child startup body and in-process preflight; JSON/sysconfig and encoding bootstrap belong to the authenticated runtime footprint.
- Preloaded non-builtin/non-frozen modules must be SOURCE/PYTHON_RUNTIME graph files. Assembly failure occurs before launcher path configuration. All scoped files are rechecked/stamped into existing inventory.
- Launcher rejects a foreign interpreter and activates the same preflight before starting hosted production work. Helper and Demucs preflight before further evidence/model initialization. Demucs metadata version lookup now follows startup validation.
- Existing Basic Pitch/Demucs model, native-wrapper executable architecture, RECORD actual bytes and license gates are reused. No model/native/library/runtime files downloaded or adopted.
- Retain all eight #327 and seventeen #328 test method identities; #327 fixtures/assertions are adapted to the single stronger preflight rather than retain a duplicate activation API. Additional two tests cover JSON/sysconfig missing footprint and foreign Demucs startup before metadata lookup. No test removed, skip added or rejection assertion relaxed. #328 existing modifications to launcher/child source-tamper tests retained. Commands now use -I/-S/-B/-c, so #327's old -I/-S direct-script assertion is superseded by stronger actual command/source checks.
- Existing #324–#326 owned stop/EOF/NOTE_EXIT/private child return/summary/Swift receive/validation/one-shot signed ack/COMPLETE+valid ack CLOSED paths remain; no signal or new interruption adapter.

## Production truth and eligibility

Launcher → private runtime/stdlib/installed distribution/assembly → Helper → Basic Pitch or Demucs → existing decoder/resampler/writer/result → existing Swift lifecycle/shutdown/summary/ack chain remains fail-closed. Inventory startup proof is PARTIAL/disk-startup scope, productionReady=false, never installed ML or mapped-native acceptance. MISSING/PARTIAL/UNVERIFIED/unapproved licenses cannot become production-ready.

| Required production asset | Status |
|---|---|
| Private CPython candidate | CANDIDATE_ONLY; approved actual executable MISSING |
| Actual private stdlib | MISSING |
| Installed production dependencies | MISSING |
| Native/shared approved bytes | MISSING / PARTIAL |
| Approved installed native-wrapper delivery | MISSING |
| Actual Basic Pitch model | MISSING |
| Basic Pitch weights license | LICENSE_UNCONFIRMED |
| Actual Demucs model | MISSING |
| htdemucs_6s license | EXTERNAL_LICENSE_VERIFICATION_REQUIRED |
| Creator-owned interruption-capable exact live handle | UNVERIFIED |

No fixture/CI dependencies are production assets. No storage/distribution/signing/notarization/PKI/retention/GC decisions. Formal A 0/30; Stage 2 OPEN; Stage 3 NOT_PASSED. A scoped software verification; B approved assets/full installed integration open; C current user decisions zero, policy categories open; D physical acceptance pending; E interruption/native proof UNVERIFIED. Whole-repository unknown defect count cannot be confirmed. Next shortest safe checkpoint: verify existing approved asset availability and connect actual approved private runtime/native/backend delivery, without manufacturing asset approval.

## Validation

Local and exact-head Actions evidence is recorded in the new Draft PR body after final CI completes. Local runtime/model fixture tests do not establish Intel/Apple Silicon/iPad/Safari/Gatekeeper/notarization/real ML/performance/native isolation/six-note/Logic/Keystation acceptance. Existing unavailable-audio-dependency local skips remain five; macOS test CI supplies its established TEST_ONLY dependencies. No new skips.

Songs and real Backups were not accessed. main/#327/#328 and preexisting PRs were not mutated. Physical-device byte equality cannot be verified remotely.
