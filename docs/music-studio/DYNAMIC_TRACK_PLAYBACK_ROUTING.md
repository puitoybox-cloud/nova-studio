# Dynamic Track Playback Routing

## Scope

This change connects the selected External MIDI Track to runtime playback by exact Track ID while preserving the existing Core Melody / Drums / Bass transport path.

Included:
- selected External MIDI Track playback by exact Track ID
- melodic and drum playback routing using existing Track Type / role resolvers
- existing Stop path reuse
- Space-key playback for External selection
- existing loop range reuse within the external playback adapter
- no project-data mutation during playback

Not included:
- Dynamic Track Recording
- External Track note editing
- Correction or Partial Edit expansion
- new Assignment roles or role migration
- schema migration
- Live Provider API or external AI API calls

`APP_VERSION` remains `1.4.0` and project `schemaVersion` remains `1.0`.
