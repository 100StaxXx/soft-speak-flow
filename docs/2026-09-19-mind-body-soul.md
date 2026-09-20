# Cosmiq Mind · Body · Soul

## Experience

- Retires Daily Chapter from Goals, Daily Adventure from Companion and its journal section, and the old daily companion-question choices (Focused / Playful / Gentle, etc.). Historical records remain intact. Graceward source is unchanged.
- Three quiet buttons below the portrait open optional ideas. Soul means reflection, nature, gratitude, connection and meaning, with no religious prompts. No daily quota, completion penalty, streak requirement, or XP just for pressing a button.
- “Plan” opens the existing quest editor for confirmation. Mind/Body/Soul travels with the idea into a scheduled quest or the Goals inbox, including saved drafts; normal completion rewards remain in use.
- A category's first selection requests a unique, silent three-second image-to-video clip. This is real generated video, not a CSS substitute. The first preparation is asynchronous and does not block activities, hatch or evolution.
- Saved videos play on an intentional category selection. Newly completed background work only shows a Play link; it never auto-plays on completion or app resume. Reduced Motion always requires explicit Play. Playback is inline, closes at three seconds, and stops when the tab/app is hidden.
- One simple motion prompt per category for each of Hatchling, Initiate, Awakened, Guardian, Champion, Mythic and Ascended. No video requests for eggs. Identity and elemental habitat are preserved by the prompt; generation quality still needs a real-device sample review.

## Isolation and cost controls

- New `cosmiq_wellbeing_videos` table and `companion-wellbeing-video` function; no changes to the hatch/evolution queue or its five-second duration.
- User authentication, account product resolution, explicit Graceward rejection, owned companion lookup, current form/image validation, and project-storage URL allowlist run before queueing. Provider keys stay on the server.
- Cache identity: companion + visual form boundary + category + source image SHA-256 + prompt version. No new paid jobs from mounting, reopening or polling. Generation is lazy per selected category, not a bulk rollout to existing accounts.
- Atomic database leases; provider task IDs are persisted before polling. An ambiguous paid submission is never automatically repeated. Operator reconciliation is required if a provider accepts a job but its ID cannot be saved.
- Bounded, explicit retry: at most one. A polling timeout retains its provider task ID and only resumes polling. A definitively failed provider job may be resubmitted; ambiguous submissions cannot. Old-appearance jobs never submit.
- Twenty-second client requests, forty-second provider requests, five-minute leases, thirty-minute job deadlines, and a three-minute foreground polling window keep the UI from waiting indefinitely. “Check again” resumes status checking; no surprise playback.
- Six new cached entries per user per rolling day plus the existing provider/global cost guardrails. New feature/endpoint monthly caps are $25 each, without raising any existing budget. Review the cap before a broader rollout.
- Video storage reuses `companion-animation-videos`, registers each object in the user asset ledger, and uses deterministic user/job paths for retry-safe uploads and account cleanup.

## Release checklist (not deployed by this implementation)

1. Apply only `20260920010000_cosmiq_wellbeing_videos.sql` after checking the target project and existing cron/internal-secret setup. Do not blanket-push unrelated pending migrations from this working tree.
2. Deploy `companion-wellbeing-video` with its current shared dependencies. It manually authenticates users/internal calls and therefore has `verify_jwt = false` in config. Verify `FAL_KEY` (or `FAL_API_KEY`) and `INTERNAL_FUNCTION_SECRET`; do not print them.
3. Confirm the `companion-wellbeing-video` cron job invokes the function every minute and the feature/provider budgets are appropriate. Migration does not queue or charge for videos itself.
4. Review one Mind, Body and Soul sample for a test companion: three-second duration, exact character, element background, no morphing/religious imagery, phone playback, Reduced Motion, app switching and poor connectivity.
5. Test a revealed evolution to ensure new-form clips do not reuse the prior portrait. Verify hatch/evolution still uses its independent queue and placement.
6. Build/sync the client and upload a new TestFlight build. Existing TestFlight builds do not receive these source changes automatically.

## Recovery

For `submission_needs_review`, reconcile the provider logs with the job before changing any state. If an accepted request is found, save its provider task ID and move the job to processing with a fresh deadline. Never clear a possibly accepted provider request just to make the UI retry. Failed videos never block activity planning or companion evolution.

## Local verification

- 181 targeted frontend tests passed, including companion, hatching/evolution, calendar, quest editor, categories, background handling, cached replay and video failure recovery.
- 14 backend/provider tests passed; migration ownership/lease static check passed separately. This is not a live database migration test.
- Production build and function manifest validation passed. Full app type check still reports 37 existing errors outside this change's files.
- Isolated browser preview checked the real selector at 375px and 320px, including opening/closing Soul ideas. All preview data was mocked; no provider generation or authenticated user data was used. Temporary preview files/server were removed after review.
- Not deployed, synced into Xcode, or uploaded to TestFlight. Real generated output, production cron execution, and physical iPhone playback remain release checks.
