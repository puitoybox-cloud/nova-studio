# MS-10 Melody editor UI shell

## Goal

Move the Version 0.1 editor toward the approved layout without changing the MIDI data contract, IndexedDB persistence, or the shared Melody / Drums / Bass operations.

## First implementation

- Remove the persistent selected-note inspector from the rendered editor.
- Give the Piano Roll the full editor width.
- Add a compact top bar for existing project, shortcut, MIDI round-trip, connection, correction, Undo, Redo, and save actions.
- Render top-bar menus as overlays so opening them does not move the Piano Roll.
- Add a Logic Pro-style loop-range bar above the Piano Roll.
- Group existing controls below the Piano Roll into editing, display/edit helpers, and playback.
- Keep the existing part workflows available below the new shell during the incremental migration.

No storage schema, project normalization, MIDI parsing/export, audio scheduling, or Logic Pro integration code is changed by this step.

## Responsive contract

- Desktop: three bottom groups share one row and the Piano Roll uses all available width.
- iPad-sized viewports: bottom groups use two columns, playback spans the row, and popovers become fixed overlays inside the viewport.
- Narrow viewports: bottom groups stack and top actions wrap into two columns.
- Existing coarse-pointer note targets and two-axis Piano Roll scrolling remain unchanged.

## Follow-up candidates

These controls are intentionally not rendered until their behavior exists:

- draw, split, merge, duplicate, and octave buttons
- note-name, keyboard-lock, velocity-display, and bulk-duration toggles
- previous/next transport controls
- favorites and editor-history menus
- loop enable/disable and draggable loop boundaries
- correction strength, key, scale, Swing, chord-aware correction, scoped correction, and scale-preserving transpose

The next implementation should extract the existing part-workflow panels into the approved menus one capability at a time, with state and persistence regression tests for each move.
