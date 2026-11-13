# Music Studio Durable Recovery Hardening — 2026-10-28 JST

## Scope

PR #530 HEAD `92024387c911f486d97e8682d39fef9dcf6b1e7d` was used as the immutable base. This change does not modify PR #510, #527, #528, #529, #530 or `main`.

## Production change

All generic IndexedDB writes for Projects, settings, automatic backups, MIDI export history and MIDI import history now use read-write transactions with `durability: strict`. Atomic Project/settings metadata Restore uses the same durability request. A write is acknowledged only from transaction completion. The existing Full WAV Archive restore already commits remapped Project metadata, settings and verified binary Blobs in one strict transaction; that contract is retained.

No IndexedDB version, object store, Project schema, JSON/Backup format or Full WAV Archive format changes. Existing MIDI, PCM, vocal/audio, legacy/opaque fields and production history remain data, not migrated or rewritten.

## Verification intent

- normal Project and settings save/read/reopen
- automatic Backup and MIDI history persistence
- atomic metadata Restore rollback and retry
- Full WAV Archive binary hash/metadata equality and additive restore
- quota, stale state, cancellation and repository replacement refusal
- tracked JavaScript syntax, whitespace and complete Node regression

Strict durability reduces the interval in which a browser/OS crash can lose an acknowledged write. It does not certify physical power-loss behavior on every device or filesystem. Pagehide cannot guarantee completion of a newly started asynchronous transaction; the existing awaited native `prepareForShutdown()` path remains the controlled shutdown contract.

## Formal ledger

Formal 30-function result remains `A=0, B=0, C=30`. No.22 and No.23 improve, but physical forced-exit/power-loss acceptance, separate-Mac distribution, Cloud Sync decisions and remaining dependency migration coverage keep both at C.
