# MIDI uncertain completion recovery — 2026-11-06 JST

Recovered three uncommitted files from interrupted Work; preserved local commit bb4ba52 and rebased only the new commit onto PR #591 HEAD 5bf5473e78d5140a925f45fc37977d944362b304. API-published runtime cb5b158c77dd350084d06ec49388b83b44a029ad has exactly the local tested tree cfd405d6e88251b49ca6f70adaeeefe91a88d82f.

Preview-bound attempt identities prevent duplicate projects/receipts after a lost completion notification. Reconciliation accepts only exact persisted project+receipt matches; changed data or retry context is rejected. This in-memory attempt survives same-preview retries, not a fresh process's file reselection. Source projects and history are not overwritten.

Local full regression: node --test, 2886 passed, 0 failed/cancelled/skipped, 114536.280587 ms. Focused new retry cases: 5 passed. Production-history tests: 20 passed. Auto-Finish Python helper: 22 passed. Ledger validated after evidence refresh; no IDs changed.

GitHub real Chromium: workflow 42104696374, job 127516310932, all steps successful, including atomic rollback, public import action with lost notification and temporary read failure, retry, SIGKILL and restart with exact project/receipt/provenance retention. Checkpoint UI/restart step 7 in workflow 42104696705/job 127516312609 also succeeded. Local Chromium download was truncated, so no local browser success is claimed.

MS22-A04 and MS30-A02 remain open: the whole public-entry interruption/history matrix is not complete. 62/135 verified (45.93%), 73 open: 10 full-acceptance gaps plus 63 model/specification/license-dependent requirements. No Mac hardware, physical power-loss or listening acceptance claimed. Existing PR #591 and main unchanged.
