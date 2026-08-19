# Cosmiq Cinema Engine

Status: release candidate. Production remains disabled until the migration,
function, observability, capacity, and paid-canary gates below are complete.

## Product contract

Cosmiq treats a companion as a persistent character, not a replaceable image.

- Hatch remains immediate and uses the existing first evolution reveal.
- After hatch, the next earned boundary is generated privately in the background.
- Only one future evolution is prepared at a time. Later forms must include history
  that has not happened yet, so generating the entire lifetime at hatch would make
  those forms less personal.
- Each evolution package contains a judged canonical portrait and two independent
  Standard video candidates with native audio. Both candidates use the exact current
  portrait as the first frame and the exact new portrait as the last frame.
- Nothing future-facing is exposed through authenticated table access or public
  storage. At unlock, the selected portrait and film are promoted to the existing
  public evolution record, and private candidates are deleted.
- Cosmiq never silently falls back to premade art. A missing, failed, cancelled, or
  superseded package is requeued idempotently and the evolution waits for the full
  personalized cinematic. The feature kill switch also blocks the claim instead of
  substituting a premade form.
- Graceward remains on its separate premade progression path. Its UI does not query
  cinema history or start Watch events, and server/database entry points reject any
  companion whose `product_mode` is not `cosmiq` before cost or provider work.

The boundaries prepared by the engine are Levels 5, 13, 21, 36, 56, and 81.

## Runtime flow

1. Hatch completes without waiting for image or video generation.
2. `process-companion-cinema-event` enqueues the next boundary, snapshots memories,
   traits, mutations, legacy achievements, care signals, and lineage metadata.
3. The worker edits the current portrait into the next canonical form, runs the
   existing image judge, and retries until it passes the lineage gate.
4. Two Kling V3 Standard image-to-video jobs render from the current canonical portrait
   to the new canonical portrait with native audio and a 1.25 second final hold.
5. Each MP4 must contain a valid ISO-BMFF container, video track, expected native
   audio track, and a duration within tolerance. The highest structurally valid
   candidate is selected. The package remains private and the UI
   says only that something is being made or is waiting.
6. When XP reaches the boundary, the queued evolution job promotes the selected
   assets, updates the companion atomically, shows the full cinematic, and queues
   the next boundary.

The Watch, Hunt, and Forge use the same private event/render machinery. The Watch
begins with a focus session. Hunt and Forge are user-invoked companion actions. A
fullscreen player requires an intentional Begin action so native audio works
reliably under iOS and browser autoplay rules.

Interaction starts are serialized per user, companion, and interaction type. The
default per-user ceilings are 4 Watches/day (60/month), 1 Hunt/day (8/month), and
1 Forge/day (8/month). A Hunt awards a durable elemental relic; every fifth Hunt
adds a permanent mythology mutation and an Ascension film. Completing a Watch
queues a separate return reaction. Server history makes ready and previously
revealed films recoverable after navigation or app restart.

## Cost model

These estimates use the provider prices checked on 2026-08-19. They exclude storage,
egress, retry waste, the small vision-judge charge, and input-image token charges.
Keep a 10-15% operating reserve above the model-only estimate.

Current defaults:

- Portrait: up to two `gpt-image-1-mini` high-quality 1536x1024 edits at $0.052 each.
- Video: two Kling V3 Standard candidates with native audio at $0.126 per second.
- Standard evolution duration: 12 seconds.
- Legendary evolution duration: 15 seconds.
- Watch: 8 seconds. Hunt and Forge: 12 seconds.

| Event | Model-only cost |
| --- | ---: |
| 12-second evolution package | $3.076-$3.128 plus judge overhead |
| 15-second evolution package | $3.832-$3.884 plus judge overhead |
| Full six-evolution lifetime | about $20-$22 |
| Watch | $2.016 |
| Hunt | $3.024 |
| Forge | $3.024 |
| Watch completion reaction | $1.512 |
| Every-fifth-Hunt Ascension | $2.520 |

At the default per-user ceilings, a user who exhausts every Watch, Hunt, and Forge
allowance and completes every Watch can consume about **$262.60/month** in video
generation before evolution films, judge calls, storage, and egress. This is a
deliberately cinematic maximum, not an expected average. The $2,500 global feature
guardrail therefore matters even with per-user limits.

Monthly model-only formula:

`video floor = 3.024(E12 + Hunt + Forge) + 3.78(E15) + 2.016(Watch) + 1.512(WatchComplete) + 2.52(Ascension)`

Add $0.052-$0.104 for the evolution portrait plus the vision-judge charge.

Examples:

| Monthly usage | Approximate model cost |
| --- | ---: |
| 1,000 new hatches, Level 5 prebuilt immediately | about $3.1k |
| 10,000 new hatches, Level 5 prebuilt immediately | about $31k |
| 1,000 active users, 8 completed Watches + 2 Hunt/Forge + 1 evolution each | about $37.4k |
| 10,000 active users at that same cadence | about $374k |

The Watch is the dominant spend because it is attached to every focus session. The
quality-first configuration intentionally keeps two candidates and native audio.
If economics later outrank quality, the first controlled lever should be candidate
count for routine interactions, never endpoint or lineage consistency.

## Capacity and reliability

- A ten-slot cron fan-out runs each minute. Optimistic leases and collision retries
  ensure concurrent slots claim different events.
- Leases are renewed before and after expensive provider work. All terminal writes
  verify the lease token so a cancelled or superseded event cannot be revived.
- Provider work uses queue submission and polling; Edge requests do not stay open
  for the entire video render.
- A connection loss during a paid Fal submission is treated as ambiguous and is
  never blindly resubmitted. User cancellation invalidates the lease and attempts
  to cancel submitted Fal queue jobs.
- Evolution jobs treat a not-yet-ready cinema package as retryable for up to an hour.
- Storage assets are ledgered. Reset and account deletion remove private and promoted
  media rather than leaving generated files behind. A daily retention job removes
  terminal private assets after 24 hours, including failed/rejected candidates.
- New feature and endpoint guardrails default to $2,500/month. The migration never
  raises an existing operator-managed budget or provider ceiling.
- Product isolation is enforced in the shared Focus UI, manager reads and writes,
  transactional RPCs, status RPC, worker dispatch, and evolution claim path. A stale
  or malformed Graceward cinema event is cancelled before any provider call.

The fal account must have enough Kling V3 concurrency for the intended launch. fal's
current platform documentation says new accounts start with a global concurrency of
two and scale with recent credit purchases, while high-demand models can also have a
separate endpoint cap. Confirm the live account and Kling endpoint allocation in the
dashboard, measure p50/p95 queue-to-ready latency, and raise the limit before broad
rollout if the one-stage-ahead queue cannot stay ahead of unlock demand.

Pricing references:

- [OpenAI gpt-image-1-mini pricing](https://developers.openai.com/api/docs/models/gpt-image-1-mini)
- [fal Kling V3 Standard image-to-video pricing](https://fal.ai/models/fal-ai/kling-video/v3/standard/image-to-video)
- [fal concurrency limits](https://fal.ai/docs/documentation/model-apis/concurrency-limits)

## Deployment order

1. Use the filtered production migration tool; a blanket
   `db push --include-all` is not safe for this ledger. The two reviewed product
   boundary prerequisites are recorded remotely, and the current pending scope is
   only `20260819090000_add_companion_cinema_engine.sql`. The tool recalculates
   that scope and requires exact confirmations at execution time.
2. Configure `OPENAI_API_KEY`, `FAL_KEY`, `INTERNAL_FUNCTION_SECRET`, the explicit
   Standard image/video models, retention, `COSMIQ_CINEMA_ENABLED=false`,
   `COSMIQ_CINEMA_ROLLOUT_PERCENT=0`, and one reviewed canary user in
   `COSMIQ_CINEMA_CANARY_USER_IDS`. Missing rollout settings disable generation.
3. Deploy `process-companion-cinema-event`,
   `cleanup-companion-cinema-private-assets`,
   `manage-companion-cinema-interaction`,
   `generate-companion-evolution`,
   `process-companion-evolution-job`, and `reset-companion`.
4. Confirm the private bucket is not public and the ten-slot cron exists.
5. Run the production preflight, then set `COSMIQ_CINEMA_ENABLED=true`; with a zero
   rollout percentage, only the reviewed UUID is admitted. Run
   `npm run cosmiq:cinema:canary` first in dry-run mode. After approving the
   printed maximum cost, rerun with the explicit paid confirmation and a queued
   canary event ID. Then complete: hatch -> private Level 5 package -> XP unlock -> audible
   reveal -> private cleanup -> Level 13 enqueue.
6. Verify one Watch, Hunt, and Forge on iOS and web, including sound-on start,
   cancellation, signed URL expiry, and account reset cleanup.
7. Verify the global and endpoint guardrails emit an alert, confirm fal capacity,
   then increase rollout in stages (1%, 10%, 25%, 50%, 100%). Stop at any stage
   where cost, failure rate, identity QA, or queue-latency thresholds fail.

Before deployment, run `npm run test:cosmiq:cinema:e2e` against the local Supabase
stack. It creates real audible MP4 fixtures, exercises the OpenAI and fal protocols
through local provider doubles, and verifies hatch-to-reveal evolution, automatic
next-boundary preparation, Watch and its completion reaction, Hunt reward and legacy,
Forge intention persistence, upstream cancellation, signed URLs, media QA, and private
asset cleanup. This is a no-charge orchestration test; it does not replace the paid
human-reviewed provider canary in step 5.

## Launch gates

- No future portrait or video URL is readable by an authenticated client before
  reveal.
- Graceward makes zero Cosmiq cinema requests during focus and cannot queue, process,
  reveal, or claim a generated cinema event.
- Both start and end images are supplied to every evolution video request.
- A package is not marked ready until all candidates are terminal and one eligible
  structurally validated render is selected.
- The paid canary must pass a human opening/final-frame identity review; container
  validation cannot by itself detect visual identity drift.
- The unlocked portrait matches the ending frame recorded on the selected render.
- The old portrait remains canonical until the evolution claim succeeds.
- A reset leaves no asset-ledger entries for the companion.
- Monthly projections fit below the configured cost guardrail with operating reserve.
