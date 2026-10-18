# Existing MIDI remake — 2026-10-18 JST

## Production behavior

The normal SMF import/editor remains the entry point; its multitrack data, tempo/meter maps, note lengths and velocities are retained. This increment uses the existing AI candidate, partial-edit, lock, history, IndexedDB and full-archive paths rather than replacing the editor.

The local paired/loopback ONNX engine now accepts a bounded prefix of the selected source phrase. Its tokenizer consumes actual notes before inference. Prefix notes are removed from generated output, and the generated continuation is rebased to the selection start. This is real source-conditioned model inference; rebasing, pitch assignment, scale/chord projection, mood/genre sampling settings and change-fraction selection are explicit rules, not natural-language model capabilities.

Revise maps generated pitches in sequence onto 25/50/100% of editable source notes, preserving their IDs, onset, length and velocity (existing explicit sample fitting/preview edits remain visible). Layer adds generated notes to the same or another explicitly selected existing melodic Track; it does not erase the melody. Bass pitch range is available. It does not create instruments/Tracks automatically or generate drum arrangements. Delete creates an explicit deterministic note-deletion proposal, including selected drum Tracks. It does not claim AI decided which notes to remove.

Model source scope is 1–256 notes; the first 64 are used as input and that limit is displayed. Delete allows up to4096 notes. Crossing source notes are rejected so a bar selection cannot silently alter sound outside the chosen range. Empty/unsupported/old-engine responses fail closed. Full pre-remake MIDI is retained as an immutable JSON snapshot inside the saved candidate; original external MIDI files are not rewritten. This baseline is evidence/recovery data, not a new whole-project rewind feature.

A/B/C is preview-only until Apply. Exact Track IDs, baseline signatures, source-note snapshots, MIDI range boundaries and existing locks are checked. Layer candidates pin both source and destination; changing the source after preview rejects adoption. Candidate audition renders the proposed selection together with other existing Tracks. A fully empty deletion result is explicitly reported as silence. Partial bar adoption, Undo/Redo, explicit save, fresh reopen and backup restoration reuse the existing guarded APIs. An adopted candidate becomes stale against its old baseline; regenerate before another adoption.

## Verification and source evidence

Parent: #455 /83a65aaf1224e87916c8175bc38b261c8c7a77be. main was freshly read as552d56eafddfd192970c09f7d6278696cf8775c3. Startup snapshots cover203 Open PRs /201 Drafts (including this newly created #456); all Draft HEAD/base/mergeability/changed filenames/latest commit and pull-request workflow-run pages fetched without tool errors. Search was repeated after saving this task, so #456 is included. Workflow pagination is the connector's first pull-request page, not an exhaustive historical job-log audit. Metadata is in music-midi-remake-start-20261018.json.

Initial source-conditioned checkpoint b581e2534c7f3f185cf6f977e80edcb77504c294, tree f9033fe6a003e7890663b3296eefd56f9a652557: actual Linux/Intel ONNX/Sinsy workflow succeeded. Linux real remake produced15/48/38 notes in A/B/C; original timing/velocity and Undo/Redo passed. Four-size real-browser generation/voice passed. The initial full-Node CI failed an old panel cache-key expectation; subsequent panel/app entry expectations were corrected. Those older successes are not represented as final-HEAD certification.

Final changes also add a separate existing-Track layer test, explicit drum deletion, late-source rejection, cache invalidation through index/host loader, and exact-head native wrapper triggers for changed bundled AI assets. The actual-generation browser script now verifies remake→audition→partial adoption→Undo/Redo→save→MIDI WAV rendering→Mix/Master final package→full WAV archive byte equality at1440/1180/820/390.

Local Python audio pipeline509 run/504 pass/existing5 skips; generation constraints8, transport3, startup4 pass. New and affected Node tests, whole-repository Node, JavaScript syntax and whitespace are run; exact final counts and final-HEAD CI belong in #456. Chromium executable and Swift/ONNX/Sinsy assets are unavailable locally, so CI establishes those results. CI and simulator results are never physical Mac/iPad acceptance.

## Remaining scope and formal status

Current formal original Music_Studio_最終機能仕様書_v1.pdf (2026-09-30) was freshly read, all5 pages/166 lines. All30 rows remain A0/B0/C30; see music-remake-30-features-20261018.json. No feature is promoted on tests alone.

Free Japanese conversation/function planning, automatic instrument creation, coordinated multitrack/drum AI arrangement, arrangement-quality acceptance, long advanced vocal correction/Comp, recording-in-progress crash recovery, Cloud Sync, distributable runtime/policy closure and other documented formal gaps remain. Eight-minute PCM and MIDI rendering are retained from the parent; no new eight-minute physical microphone or maximum-memory claim. No new models/samples, external Live Provider calls, main edits, Ready/Merge or force push.
