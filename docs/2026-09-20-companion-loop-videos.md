# Companion loops — build 360 release

## Behavior

- Every eligible current companion appearance gets seven version-3 jobs: four different 4-second idle clips (breathing, looking around, resting, greeting), plus three 5-second Mind/Body/Soul clips.
- Existing accounts prewarm on their next app visit, and new forms prewarm when their revealed portrait is saved. No clips are queued for an egg. Hatch/evolution generation remains separate and unchanged.
- The server composites the existing animal and its stage/element habitat, using the exact same opaque JPEG for start_image_url and end_image_url. Prompts require a return to the starting pose with a final half-second hold.
- The player keeps the underlying scene visible, waits for a decoded video frame, fades in, and blends the last quarter-second back to the scene anchor. It rejects clearly incorrect durations instead of truncating an old clip. There is no video Close button or black loading surface.
- Idle clips rotate with 2.2-second rests and one next-clip preload. Clips arriving from the queue do not interrupt one already playing. Activity clips take priority. Hidden/backgrounded screens and reduced-motion preferences disable idle playback. Autoplay refusal and errors return quietly to the portrait.
- Removed the companion page's CSS bounce, stretch, droop, breathing and idle-drift transforms. Existing interaction gestures/dialogue remain functional.

## Safety and compatibility

- Versioned appearance/category keys prevent duplicate paid generation on repeat visits and allow old videos to remain stored. No old media is deleted.
- User ownership, Cosmiq-only checks, trial/subscription access, at-most-once ambiguous submissions, one explicit retry, and existing monetary cost guardrails remain in force.
- Daily job count is 14 (two full seven-clip sets). A database advisory-lock trigger enforces this under concurrent preparation requests. This does not increase monetary budgets.
- New clients send promptVersion: 3. Old clients without the field continue reading their version-2 three-second clips; they never receive longer clips that they would cut off. Old queued jobs retain their three-second contract. Old clients without saved clips receive an update-required response rather than starting obsolete generation.

## Rollout and acceptance

1. Applied only migration `20260920223000_companion_loop_videos.sql` atomically with its migration-history record after checking the live catalog. Verified the new scene column and queue-cap trigger. No accounts, entitlement grants or paid jobs were created by the migration.
2. Deployed only `companion-wellbeing-video` v5, ACTIVE, with its existing static habitat/WASM bundle and verify_jwt=false configuration. Before/after inventory confirms no other function versions changed. Handler authentication remains intact; no cinema worker or auth changes.
3. Live service-only runtime-check passed: unauthorized 401; authorized 200, all 42 habitats, composed JPEG 223,678 bytes. The existing every-minute worker schedule is active. See release-360 notes for iOS upload status.
4. Device acceptance still required: verify an eligible existing account queues seven new jobs, then inspect all seven resulting videos. Check anatomy, full habitat preservation, first/last pose matching, replay/rotation, rapid category changes, slow networking, background/resume, reduced motion and Low Power Mode.

Provider schema checked: https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video/api supports 4/5-second duration values and end_image_url. Matching endpoints and playback blending do not replace visual inspection of generated output.

## Local verification

- Frontend playback, prewarming, selection, display, protocol, migration-contract and pending Reminders regression tests passed.
- Backend queue/provider tests passed, covering all seven jobs, endpoint identity, durations, authorization, access, idempotency, legacy protocol and daily limits.
- TypeScript checks, scoped lint, production build and bundle budgets passed.
- Release rerun: 71 focused app tests and 29 backend tests passed; typechecks, function manifest, native preflight and archive succeeded. All 476 archived web files match the tested build. Native signature verification passed outside the restricted sandbox.
- Migration executed successfully in production. No paid generation was manually started, no trial change or bulk regeneration was performed, and newly generated clips have not yet been visually accepted on a device.
