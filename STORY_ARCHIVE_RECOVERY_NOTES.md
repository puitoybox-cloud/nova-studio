# Story Archive white-screen recovery

- Adds a non-destructive recovery layer loaded after `app.js`.
- Keeps existing `state.storyArchiveCards`, images, IDs, and localStorage keys unchanged.
- If one card fails normalization, the remaining cards still render.
- If the main Story Archive view throws, a recovery list is shown instead of a blank screen.
- Detail view also falls back to a read-only safe view when a helper throws.

This is intentionally a minimal recovery change before the next image-first UI redesign.
