# Companion habitats and clean motion

The main portrait layers generated element scenery behind the existing animal cutout. Eggs retain their own scene until hatch. Older art with an opaque embedded scene retains its original backdrop. Cutouts used for icons and animation generation are unchanged; no user's animal or progression is replaced.

## Generated assets

Built-in image generation created 42 backgrounds: six elements across seven evolution forms. Final assets are in `public/companion-habitats/`, optimized to 768px WebP (about 4.5 MiB total), bundled for offline use. The hatchling form uses `{element}.webp`; later forms use `{element}-{tier}.webp`. Full prompts for the 36 later-form assets are saved in [companion-stage-habitat-prompts.json](companion-stage-habitat-prompts.json).

The backdrop follows the companion's claimed form, not unclaimed XP: hatchling levels 1–4, initiate 5–12, awakened 13–20, guardian 21–35, champion 36–55, mythic 56–80, and ascended 81–100. Eggs retain their existing art. Missing later-form assets fall back to the matching element's hatchling landscape. Unknown elements do not receive an unrelated backdrop.

All 42 assets were visually inspected together for elemental consistency, quiet central space, and progression. Existing animal art and progression are preserved; opaque legacy portraits still cover the layered scenery until they receive transparent artwork.

Prompt template used for each asset:

> Use case: stylized-concept. Asset type: square mobile fantasy companion portrait BACKGROUND, environment only. [SCENE] Cohesive premium painterly 3D fantasy game art, softly detailed and atmospheric, not photorealistic. Eye level view, wide open quiet central 65% where a large animal will be composited later. A subtle natural ground at bottom 20%, gentle diffuse light from upper left, restrained contrast behind the center. Landscape fills the entire square, no borders, no lettering, no logos, no animals, no eggs, no people. Deliver one square environment image only.

Scene substitutions:

- Fire: A volcanic valley with distant glowing lava rivers, dark basalt outcrops at the edges, warm amber embers and a soft copper sky.
- Ice: A glacial valley with translucent blue ice formations at the edges, a frozen lake, pale cyan aurora and distant snow peaks.
- Storm: A windswept mountain overlook with indigo storm clouds, distant restrained lightning and misty blue cliffs.
- Nature: An enchanted emerald woodland clearing with ancient mossy trees framing the edges, ferns and soft green sunbeams.
- Void: A mysterious violet cosmic landscape with distant floating stone islands, a soft purple nebula and sparse stars.
- Light: A luminous golden sanctuary landscape with distant ivory ruins, warm sunrise rays, pale clouds and softly glowing grasses.

## Clean controls and motion

- Animate the animal, not the landscape/frame. Respect reduced motion and hidden tabs.
- No portrait button overlay, bright border, beams or decorative particles. Quiet Replay hatch/evolution text below the photo retains a 44px touch target.
- Hatch/Evolve/Reveal stays below readiness/progress and above Color/Spirit/Element, with restrained static styling.
- Replay has native video controls and recoverable connection errors.
- Reveal playback rejected with NotAllowedError/AbortError offers Play animation instead of returning a completed video to preparation. Paused reveals can also resume.
- The custom video is still required for a reveal. Rigged Rive character assets are not configured; this work improves existing image motion and video access, not skeletal animation or new idle clips.

## Earlier clean-motion verification

159 frontend tests and 40 backend tests passed, and the production build passed. Tests cover hatch, later evolution, pending reveal recovery, blocked autoplay, pause/resume controls, replay errors, button placement and element selection. Backend tests use mocked workers. A browser preview was inspected using the real habitat/image components with bundled Buttercat artwork. Live read-only checks confirmed the affected first hatch video succeeded and was marked presented. A subsequent video availability check could not run because the database management query timed out; actual device playback was not verified. No progress reset or paid regeneration was requested.

Changes require a new app build and do not automatically update an installed TestFlight version.
