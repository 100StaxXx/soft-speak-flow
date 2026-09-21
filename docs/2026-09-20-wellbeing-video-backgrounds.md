# Mind / Body / Soul video backgrounds

## Cause and local fix

The companion screen composes a transparent portrait over habitat artwork in the UI. The wellbeing video worker previously sent only the portrait to the video provider; a preservation instruction could not preserve scenery absent from the input.

The worker now flattens that same portrait over the same element/tier artwork before submission. All 42 habitat files are bundled with the function, because the public website can return SPA HTML instead of these assets. Shared habitat selection keeps client and worker paths consistent. The image compositor uses pinned ImageMagick WASM, requires raster inputs, bounds download size and image resources, and writes a separate opaque JPEG. Original portraits remain unchanged. A missing habitat prevents paid submission rather than falling back to a cutout.

Prompt version 2 selects new cache entries and explicitly retains landscape throughout the clip. Old video files are not deleted. New preparation follows the existing entitlement checks, generation budgets, and paid-submission safeguards.

## Verification

- 22 backend tests passed, including real PNG/WebP composition, opacity/pixel checks, exact parity of all bundled habitat assets, missing scenery, and old-cache version replacement.
- 32 focused frontend tests passed across habitat rendering, wellbeing prompts, and video service behavior.
- App TypeScript checks and diff whitespace checks passed.
- Visually inspected a local storm Buttercat source-frame composition: the mountainous landscape is present behind the unchanged animal. This is a source-frame check, not inspection of a newly generated video.

## Release boundary

Not deployed or uploaded. Deploy only the reviewed `companion-wellbeing-video` function, with its configured static habitat files and pinned WASM dependency. Verify WASM initialization and bundled asset reads in the deployed runtime before claiming the live fix complete. Existing clips cannot gain backgrounds retroactively; the new version requires fresh generation and visual review. No production generation or storage deletion was performed during this repair.

## Disk cleanup

With user authorization, removed regenerable Xcode module cache, Deno/npm package download caches, and Chrome default-profile webpage/code caches. Approximately 1 GB reclaimed; about 1.1 GiB free afterwards. Source, installed project dependencies, signed archives, browser account data and personal files were preserved. Deleted caches are not in Trash but rebuild/download automatically when needed.
