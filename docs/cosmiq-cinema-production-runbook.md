# Cosmiq Cinema Production Runbook

This runbook is deliberately fail-closed. Deploying code and schema must not turn
on paid generation. Production rollout is a separate, observable decision.

## Current production finding (2026-08-19)

- Linked project: `opbfpbbqvuksuvmtmssd`.
- Cinema migration `20260819090000` and both reviewed product-boundary
  prerequisites are applied.
- Both reviewed product-boundary prerequisites (`20260812100000` and
  `20260819113000`) are recorded remotely.
- All six cinema-aware functions are active. The per-minute worker cron and
  nightly private-asset cleanup cron are active, and the private cinema bucket
  is non-public.
- Paid generation remains fail-closed with `COSMIQ_CINEMA_ENABLED=false`, a 0%
  rollout, and a non-user canary sentinel. A live internal-worker smoke request
  returned the expected `cosmiq_cinema_disabled` response.
- The repository contains older migrations that production intentionally or
  accidentally skipped. Do not run `supabase db push --include-all` from the full
  repository migration directory.
- The three base provider/internal secrets and the reviewed Standard
  rollout/model/retention values exist. A real reviewed Cosmiq canary UUID and an
  operator-owned alert webhook still need to replace the fail-closed placeholders
  before paid canary generation.
- `app.cosmiq.quest` is served by the `cosmiq-web` Cloudflare Pages project. The
  current workstation has no authenticated Cloudflare deployment session, so the
  reviewed frontend bundle has not been promoted from this workspace.

Run `npm run cosmiq:cinema:production-check` before and after every release step.
It reports names and status only; it never prints secret values.

## Reviewed schema scope

Run `npm run cosmiq:cinema:production-migrate`. It creates a temporary release
workspace containing placeholders for migrations already recorded remotely and
only the still-missing members of this reviewed set:

1. `20260812100000_add_explicit_companion_product_mode.sql`
2. `20260819090000_add_companion_cinema_engine.sql`
3. `20260819113000_bind_profile_and_companion_product_to_account.sql`

At the current remote state, the dry run must report that all three reviewed
migrations are already applied. The command adapts safely if a reviewed
prerequisite is applied between checks, and fails if the cinema migration is
recorded without both prerequisites. Save its output in the release record.
Execution additionally requires the exact project and pending-migration
confirmations printed by the dry run.
Never mark a migration applied with `migration repair` unless its SQL has
independently been verified against the live schema.

## Function and secret deployment

Set these values explicitly:

- `COSMIQ_CINEMA_ENABLED=false` during schema and function deployment
- `COSMIQ_CINEMA_ROLLOUT_PERCENT=0`
- `COSMIQ_CINEMA_CANARY_USER_IDS=<reviewed auth user UUID>`
- `COSMIQ_CINEMA_IMAGE_MODEL=gpt-image-1-mini`
- `COSMIQ_CINEMA_VIDEO_MODEL=fal-ai/kling-video/v3/standard/image-to-video`
- `COSMIQ_CINEMA_PRIVATE_RETENTION_HOURS=24`
- `COST_ALERT_WEBHOOK_URL=<operator-owned alert endpoint>`

Keep existing `OPENAI_API_KEY`, `FAL_KEY`, and `INTERNAL_FUNCTION_SECRET` values.
Deploy the following functions as one release:

- `process-companion-cinema-event`
- `cleanup-companion-cinema-private-assets`
- `manage-companion-cinema-interaction`
- `generate-companion-evolution`
- `process-companion-evolution-job`
- `reset-companion`

If function deployment precedes schema, all user-facing calls remain disabled and
must not be enabled until schema preflight passes.

After the post-deploy preflight passes, set `COSMIQ_CINEMA_ENABLED=true` to admit
only the reviewed canary UUID. Do not increase the rollout percentage yet.

## Canary and rollout

1. Confirm the canary account is a Cosmiq account in trusted auth app metadata.
2. Hatch and verify the first reveal remains immediate.
3. Run the paid Standard canary using `npm run cosmiq:cinema:canary` and its printed
   explicit confirmation arguments.
4. Verify private Level 5 generation, native audio, identity at opening/final frame,
   XP claim/reveal, private-candidate cleanup, and automatic Level 13 enqueue.
5. Verify Watch, Hunt, and Forge on iOS and web, including cancellation and restart.
6. Exercise a guardrail alert and confirm an operator receives it.
7. Confirm fal account and Kling endpoint concurrency can keep p95 queue-to-ready
   latency ahead of expected unlock demand.
8. Roll out 1% -> 10% -> 25% -> 50% -> 100%, holding each stage long enough to
   review provider spend, render failures, identity rejects, and queue latency.

## Rollback

Set `COSMIQ_CINEMA_ENABLED=false` and redeploy the three cinema-aware entry-point
functions. This immediately blocks new paid work and new Cosmiq evolution claims;
it does not substitute premade art. The private-asset cleanup function continues
to run while disabled. Preserve database rows for diagnosis, cancel outstanding fal
jobs where possible, and resume only after the incident is resolved.
