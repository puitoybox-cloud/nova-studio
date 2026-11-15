# Music Studio backend bundle evidence — 2026-10-06 JST

Baseline: #318 exact `042090a4cec078b4a3e2460da9ed70ce5a7a2c52`.
This report records actual assets, not a new trust/eligibility contract.

## Conclusion

The existing Helper package is inspectable and contains the seventeen checked
source/resources, but it is not a self-contained ML backend. No approved production
Python/runtime/model/native package is supplied in the tracked repository or this
Helper ZIP. Source adapters do not make those missing assets runtime available.
No newly discovered asset qualifies for safe processing integration without the
missing identity/license/architecture evidence. Existing strict gates stay closed.

No user decision is ready now. Exact asset selection and external license evidence
verification are engineering/research work, not a request for the user to approve
unknown libraries. Distribution/signing/storage/trust ownership may require later
choices, but asking those before viable options exist would be premature.

## Fresh GitHub and package evidence

- main `552d56eafddfd192970c09f7d6278696cf8775c3`.
- #318 Draft/Open/mergeable, one commit, seven files +725/-2; base #317
  `8b1a4640be4960e99a8e040caf6615f3a68bc72e`.
- All 65 open PRs re-read: 63 Draft/mergeable; #10/#35 non-Draft/conflicting.
  Latest all-state PR search returned #318; no #319+ at start.
- Exact-head Actions 37441261631 / 37441260657 / 37441260594 completed success.
- Helper artifact 11401107783 from run 37441260657 was inspected without launch.
  Outer ZIP SHA-256 `03a333c77a05ea774a527b449c08ca1534f5dd2a252a90cf041ee793f610c6b2`
  matches GitHub's artifact metadata. All 17 resource size/digests match its
  packaged-source-inventory. The inner ZIP includes signatures, scripts and
  resources; no Python runtime, ML model, third-party backend or license notice.
- `verification/music-backend-bundle-evidence-20261006.json` retains the exact
  resource identities, named missing assets, model fields and anchor candidates.

Sources: [#318](https://github.com/puitoybox-cloud/nova-studio/pull/318),
[Helper CI](https://github.com/puitoybox-cloud/nova-studio/actions/runs/37441260657),
`tools/music-audio-pipeline/requirements.txt`, `server.py`, `demucs_child.py`,
`local_distribution_entry.py`, `mac-app/NovaMusicAudioHelper`, both packaging
workflows and `tools/music-native-wrapper/MusicStudioNative.xcodeproj/project.pbxproj`.

## Actual inventory

Here MISSING means no supplied production payload in the inspected repository and
Helper package. It does not assert that the user's Mac has no installation/cache.
No user device was probed. TEST_ONLY packages are never promoted to production.

| Component | Repository / package status | Actual missing evidence |
| --- | --- | --- |
| Basic Pitch | MISSING; SOURCE_ONLY loader/call adapter; requirements `>=0.4,<1` | exact installed package, inference engine, package metadata/license/native closure |
| Basic Pitch model | MISSING | actual file, format, exact path/size/digest, companions; no supplied model identity |
| Demucs | MISSING; SOURCE_ONLY resident child/loader; requirements `>=4,<5` | exact package and transitive loader/inference closure |
| Demucs htdemucs model | MISSING | actual `.th` checkpoint(s), `.yaml` bag/config companions, path/size/digest and version/license |
| Python executable/runtime | MISSING from product package | macOS x86_64/arm64 interpreter, stdlib, extension libraries, exact metadata/license |
| torch / torchaudio | MISSING | exact packages/native libraries and model-compatible versions; no direct pinned requirements |
| numpy | MISSING from product; requirements `<2`; existing CI installs TEST_ONLY | exact production package/native BLAS closure |
| mido | MISSING from product; requirements `>=1.3,<2`; CI TEST_ONLY | exact writer/import package identity and redistribution notice |
| decoder / codec | soundfile/libsndfile adapter SOURCE_ONLY; soundfile CI TEST_ONLY | exact libsndfile and codec/transitive closure; declared source adapter is not binary availability |
| resampler | librosa/scipy/soxr and Demucs julius call adapters SOURCE_ONLY | exact packages, numpy/native companions and reachable runtime identity |
| MIDI writer | final `mido.MidiFile.save` receipt SOURCE_ONLY; browser SMF writer SOURCE_ONLY | mido/Basic Pitch pretty_midi exact backend; browser own writer is a different path |
| stem writer | Demucs `save_audio` / soundfile encoder adapters SOURCE_ONLY | actual Demucs/soundfile encoder package/native identity |
| native/shared libraries | MISSING from Helper product | complete approved loader graph; no `.so`/`.dylib` payload supplied |
| Helper executable/resources | PACKAGE_AVAILABLE: verified 17 copied inputs | interpreter/models/third-party libraries not included; shell entry is a Bash script |
| Swift/native wrapper | SOURCE_ONLY baseline; existing CI builds/packages application | wrapper package CPU/linkage evidence recorded by this PR CI; no embedded Python/ML/browser resources |
| runtime config / manifest / closure / child config | fixture/source construction only | assembled real production identities and external approved anchor |
| installed private native delivery | SOURCE_ONLY hooks; MISSING installation | actual launcher→Swift startup/final acknowledgement channel |

`setuptools<82` is another declared dependency; its package/license remains part
of the required closure. No lockfile with exact resolved production versions was
found. Basic Pitch engine choice cannot be inferred from an absent model format or
absent installed metadata. onnxruntime/tensorflow are diagnostic candidates, not
newly adopted production requirements.

## Models

Both actual models are MISSING. Exact path, size and digest cannot be confirmed;
format and model identity are UNKNOWN. The source refers to externally declared
model bindings, but there are no supplied model bytes to bind or package.
The six-note WAV/MID and the owned-audit JSON are FIXTURE_ONLY; synthetic model
files created by tests are TEST_ONLY. Neither is an actual ML model or trust anchor.
No model or remote binary was installed for this work. The existing Helper source
artifact was read as packaging evidence, never launched.

## License evidence

The tracked repository supplies `MS-00C_LICENSE_REGISTER.md` (updated 2026-07-20),
not third-party model/package license texts or approved redistribution notices.
The inspected Helper ZIP has no bundled third-party notices or dependency metadata.
Requirements ranges are not license evidence.

All missing production third-party packages/models: LICENSE_UNCONFIRMED.
Next action: EXTERNAL_LICENSE_VERIFICATION_REQUIRED against the exact candidate
versions/weights. This is not a user policy approval and no common-library license
is inferred. Model licenses must be checked separately from code licenses.

This PR reads *installed* CI package METADATA/WHEEL/RECORD, Requires-Dist, explicit
license fields/classifiers and actual license/notice files, retaining path/size/hash.
It does not import ML packages. The package files belong to the CI TEST_ONLY
interpreter, even when the Helper package is inspected in the same report. Local
evidence presence is not redistribution approval. Requires-Dist markers are retained
unevaluated; this diagnostic cannot certify a resolved production dependency closure.
License text/notice coverage and legal obligations of a future assembled production
bundle still need verification. No unknown dependency is adopted.

The existing own browser SMF writer entry MS-LIC-006 identifies self-written code,
not permission to bundle mido or pretty_midi. Existing images/code entries remain
unconfirmed; this PR does not add them to any distribution.

## Architecture

The Helper entry is a Bash script, not a Universal Mach-O binary. That fact does
not establish that its absent Python/ML backend works on either Mac CPU.
Production backend architecture: Intel x86_64 UNKNOWN, Apple Silicon arm64 UNKNOWN.

This PR records `lipo -archs`, `file` and `otool -L` on the actual CI-built macOS
and iPad Simulator executables. These are compiled wrapper/linked-framework facts,
not real-device acceptance or proof that ML dependencies support those CPUs.
Exact package reports separately hash all regular files and leave unexplored
architecture UNKNOWN. Symlinks are recorded without following them. No arbitrary
runtime/package is executed by the inspector. Native reports are sidecars; no
test interpreter/metadata is inserted into a product as if it were approved.

## Actual reachable processing chain

| Edge | Existing source connection | Runtime/package closure |
| --- | --- | --- |
| Helper shell → Python | strict external `NOVA_LOCAL_PYTHON` / isolated entry | MISSING supplied approved Python |
| Python → decoder/resampler | soundfile/librosa receipt adapters | MISSING exact installed backend/native identities |
| Python → Basic Pitch | authenticated retained Model → predict | MISSING package/model/engine closure |
| Python → Demucs | retained owned child pipes → local repo/model → separate | MISSING package/checkpoints/child config |
| Demucs → torch/native | declared import/native/loader observations | MISSING approved native closure; internal kernels UNVERIFIED |
| inference → MIDI/stem writer | final mido save; Demucs/soundfile writer adapters | MISSING exact package/native identities |
| result → Swift stop/final acknowledgement | validators and adapter hooks | installed private native delivery MISSING |

Thus no complete production runtime closure is RUNTIME_AVAILABLE. The existing
legacy setup can call pip and a hosted page; it is not self-contained and was not
run. Strict startup blocks installation/fallback. Wrapper Xcode resources phases
are empty; Package.swift declares source targets and Apple framework usage, not
bundled backend/browser/model resources.

## Anchor candidates and private delivery

| Candidate | Classification | Limitation |
| --- | --- | --- |
| exact #318 Git HEAD/tree and source digests | TECHNICALLY_USABLE; adoption APPROVAL_REQUIRED | source membership only; no complete backend trust root |
| exact Helper ZIP digest / 17 resource identities | TECHNICALLY_USABLE; adoption APPROVAL_REQUIRED | partial source package identity, not runtime/model/architecture approval |
| fixture manifest / fixture model / audit transcript | NOT_USABLE | TEST_ONLY / FIXTURE_ONLY |
| complete backend manifest/build/architecture anchor | NOT_USABLE currently | MISSING; no candidate ready for adoption |

No anchor was formally adopted. A Git SHA or CI signature does not authorize a
model or prove runtime closure. Selecting a future trust owner is a later policy
decision after a concrete full-bundle candidate exists.

The launcher owns Python Popen and Demucs pipes, but neither pipe connects to
Swift. `native_host` / `final_sink` are caller hooks, while actual `main` chooses
`webbrowser.open`. Swift environment handoff consumption and
`receiveOwnedShutdown` validation do not supply the missing adapter. No installed
XPC/private callback/native handle transport was identified. Existing authenticated
loopback control traffic is not the missing final private channel after transports
close. No public endpoint, secret-to-browser handoff or distribution/security
policy is created. Creating a new delivery ownership/bootstrap arrangement remains
POLICY_REQUIRED once technically viable choices are established.

## Changes and remaining blockers

The actual existing package/build pipelines now emit read-only backend/package,
license-metadata and architecture/linkage evidence. Six tests ensure model-looking
fixtures, missing distributions, unknown CPU and notice presence cannot become
approval. No new abstract contract, eligibility field in production, or unsafe
asset connection is added. No newly inspected asset met all integration conditions;
processing/runtime behavior stays unchanged.

| Category | Current result / next evidence owner |
| --- | --- |
| A repository-only | reviewed #317 scoped checklist remains 0; not an exhaustive claim about all future integration work |
| B backend/assets/anchors | development must identify exact Basic Pitch model/engine; Demucs htdemucs checkpoints/companions; two Mac Python runtimes; torch/torchaudio/native; decoder/resampler/MIDI/stem package closure; production config/manifest/anchor; private native delivery and durable adapter. All named gaps above; licenses are external verification work |
| C policy | future storage/distribution/signing/notarization/trust ownership/retention/GC choices; no actionable user choice established now |
| D physical | Intel Mac, Apple Silicon, iPad, Safari, Gatekeeper/notarization, real ML/performance/isolation/six-note accuracy/Logic/Keystation PENDING/UNVERIFIED |
| E OS/runtime | exact descendant live-handle ownership; internal kernels; successful authenticated loader edges; mapped-memory/hidden/transient coverage; native syscall networking UNVERIFIED |

Formal A 0/30; Stage 2 OPEN; Stage 3 NOT_PASSED. Scoped software evidence never
promotes a feature to formal A. Next shortest safe checkpoint: verify the exact
candidate backend/model versions and their primary license/distribution evidence
without installing models/binaries, then develop the concrete assembly/delivery
options. Do not request permission to approve unknown assets or add more fixture
contracts to manufacture closure.

## ティアが今決める必要があること

**今はティアが決めることはありません。**

- 【決めること】今すぐ必要な決定は0件。配布方法などは、まだ決める段階ではない。
- 【これは何？】単独で動くためのAI本体・学習済みデータ・実行部品をそろえる作業。
- 【なぜ決める必要がある？】現時点では、判断できる実物と利用条件がそろっていないため、判断を求める根拠がない。
- 【選択肢】確定していない。外部の正式な資料と具体的な構成候補を確認する。
- 【おすすめ】先に開発側が、使える部品と条件を確定する。
- 【おすすめの理由】ティアの許可だけでは、部品の不足や利用条件の未確認は解決しない。
- 【決めない場合どうなる？】調査は続けられる。実物・条件が確認できるまで、単独AI処理の完成判定は保留する。

Main/#318/old PRs/saved songs/real Backup are not written. Real device byte
equality cannot be confirmed; device data is not accessed. No Ready/Merge/Auto
Merge/force push, live provider/AI calls, model installation or OS-wide changes.
Validation and final exact-head CI IDs are recorded in the new Draft PR.
