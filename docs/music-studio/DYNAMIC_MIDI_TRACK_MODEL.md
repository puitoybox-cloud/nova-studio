# Dynamic MIDI Track Model / Capability Registry Foundation

## Scope

This foundation separates Track identity, technical type, musical role, core compatibility slot, display name, and derived capabilities. It does not connect the model to UI, Playback, Recording, MIDI Input Routing, Correction, or Partial Edit.

## Classification catalogs

- Technical Track Type: `midi-melodic`, `midi-drums`, `audio`, `unknown`.
- Musical Role: `unassigned`, `melody`, `drums`, `bass`, `vocal`, `piano`, `guitar`, `strings`, `synth`, `fx`, `other`.
- Core compatibility slot: `melody`, `drums`, `bass`.

`id` remains Track identity and `name` remains the display name. Assigning a role never changes either field.

The optional `trackType` field is preserved when valid. Missing values remain missing in saved data and are resolved at runtime. Classification normalization removes only an invalid `trackType`; it does not delete the Track, backfill the field, repair `roleAssignment`, or mutate its input. No database or schema migration is used.

## Resolver rules

- `resolveTrackRole(track)` uses a valid explicit `roleAssignment`, then the core compatibility slot, then `unassigned`.
- `resolveCoreTrackSlot(track)` accepts only an exact `part` or canonical core Track ID. Assignment, name, channel, Program, and order cannot create a core slot.
- `resolveTrackType(track)` uses a valid explicit `trackType` first. Core Drums and legacy channel 10 / `drumCandidate` may resolve the technical type to `midi-drums`; this never changes role, `part`, or core slot. Other MIDI-shaped Tracks resolve to `midi-melodic`, while Tracks without technical MIDI evidence resolve to `unknown`.
- `resolveTrackDisplayName(track)` reads `name` without deriving it from role.
- `normalizeTrackClassification(track)` returns an independent classification-safe copy.

No resolver infers Musical Role from Track name, MIDI channel, Program, or Track order.

## Role cardinality registry

External assignments for `melody`, `drums`, and `bass` have a maximum of one. `unassigned`, `vocal`, `piano`, `guitar`, `strings`, `synth`, `fx`, and `other` are unbounded. This is future registry metadata only: the current External Track Review / Assignment UI and validator still expose only Unassigned, Melody, Drums, and Bass.

## Capability matrix

| Track classification | Edit notes | Record MIDI | Play MIDI | Pitch correction | Drum labels | Partial Edit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Core Melody | yes | yes | yes | yes | no | yes |
| Core Drums | yes | yes | yes | no | yes | yes |
| Core Bass | yes | yes | yes | no | no | yes |
| External melodic MIDI | yes | yes | yes | no | no | no |
| External drum MIDI | yes | yes | yes | no | yes | no |
| Audio | no | no | no | no | no | no |
| Unknown | no | no | no | no | no | no |

Capabilities are derived and are not saved. They are intentionally not connected to runtime behavior in this change.

## Legacy compatibility and safety

`trackPart()` remains unchanged as the legacy core normalization heuristic used by current Compatibility Track loading. It is a future deprecation candidate. New classification resolvers do not call it.

External Track IDs, names, notes, channels, Programs, order, unsupported-event metadata, `roleAssignment`, and valid `trackType` survive editor normalization and JSON / IndexedDB / backup paths. External Tracks are not copied or promoted into core Tracks, and All MIDI export keeps each source Track once.

`APP_VERSION` remains `1.4.0`, project `schemaVersion` remains `1.0`, and IndexedDB remains unchanged.

## Not included

- Dynamic Track Selection UI or Dynamic Track tabs
- Playback or Recording changes
- new-role Assignment UI, including Vocal / Piano / Guitar / Strings / Synth / FX / Other UI
- Correction or Partial Edit expansion
- Audio editing, Stem separation, or Audio-to-MIDI
- Provider API calls
- Logic Pro direct control or macOS Automation
- schema migration or existing Track data migration
