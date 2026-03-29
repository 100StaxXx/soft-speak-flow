# Cost Guardrails Runbook

## What is covered

- Env kill switches:
  - `COST_KILL_SWITCH_ALL`
  - `COST_KILL_SWITCH_TEXT`
  - `COST_KILL_SWITCH_IMAGE`
  - `COST_KILL_SWITCH_TTS`
  - `COST_KILL_SWITCH_MUSIC`
  - `COST_KILL_SWITCH_TRANSCRIPTION`
  - `COST_KILL_SWITCH_VIDEO`
  - `COST_KILL_SWITCH_ENDPOINTS`
- Runtime DB feature flags and budgets in `public.cost_guardrail_config`
- Monthly state in `public.cost_guardrail_state`
- Spend telemetry in `public.cost_events`
- Threshold and anomaly alerts in `public.cost_alert_events`
- Reporting views:
  - `public.cost_driver_endpoints_daily_v`
  - `public.cost_driver_users_daily_v`
  - `public.cost_budget_status_v`

## Risk-ranked inventory

Critical:

- `generate-daily-mentor-pep-talks`
- `generate-full-mentor-audio`
- `generate-companion-image`
- `generate-companion-evolution`
- `process-companion-evolution-job`

High:

- `generate-mentor-script`
- `generate-mentor-audio`
- `generate-single-daily-pep-talk`
- `generate-tomorrow-pep-talks`
- `transcribe-audio`
- `generate-rhythm-track`
- `batch-generate-rhythm-tracks`
- `generate-cosmic-postcard`
- `generate-evolution-voice`
- `generate-campaign-welcome-image`
- `generate-journey-path`
- `generate-adversary-image`
- `generate-neglected-companion-image`
- `generate-dormant-companion-image`

Medium:

- `mentor-chat`
- `generate-morning-briefing`
- `generate-daily-plan`
- `generate-smart-daily-plan`
- `generate-daily-missions`
- `generate-journey-schedule`
- `generate-epic-suggestions`
- `generate-epic-narrative-seed`
- `generate-reflection-reply`
- `generate-check-in-response`
- `generate-memorial-image`
- `generate-quote-image`
- `generate-zodiac-images`
- `generate-tutorial-tts`

Secondary scripted or workflow-driven spend sources:

- `scripts/prewarm-adversary-images.mjs`
- `scripts/render-badge-reward-previews.ts`
- `scripts/backfill-missing-pep-talk-transcripts.mjs`
- `.github/workflows/adversary-image-pool.yml`

## Alert behavior

- Threshold alerts fire at `50%`, `80%`, `90%`, and `100%` of the configured monthly budget.
- Scope types:
  - `provider`
  - `feature`
  - `endpoint`
- At `100%`, the blocked scope is rejected server-side until the budget is raised or the next UTC month begins.
- Hourly anomaly monitoring alerts when:
  - last `1h` spend is at least `3x` trailing 7-day hourly average and at least `$3` higher
  - or last `24h` spend is at least `2x` trailing 14-day daily average and at least `$10` higher

## Fast shutdown

1. Set `COST_KILL_SWITCH_ALL=true` in Supabase project secrets.
2. Redeploy functions.
3. Confirm new requests are returning `503` with `COST_GUARDRAIL_BLOCKED`.
4. Pause automation sources:
   - Supabase cron job `generate-daily-mentor-pep-talks`
   - Supabase cron job `cost-guardrail-monitor` only if it is noisy, not if spend is ongoing
   - GitHub Actions workflow `Adversary Image Pool` if image backfills are contributing

Narrower shutdowns:

- Image only: `COST_KILL_SWITCH_IMAGE=true`
- TTS only: `COST_KILL_SWITCH_TTS=true`
- Music only: `COST_KILL_SWITCH_MUSIC=true`
- Transcription only: `COST_KILL_SWITCH_TRANSCRIPTION=true`
- Single endpoint: add the function name to `COST_KILL_SWITCH_ENDPOINTS`

## No-redeploy shutdown

Disable a feature instantly in Postgres:

```sql
update public.cost_guardrail_config
set enabled = false
where scope_type = 'feature'
  and scope_key in ('ai_pep_talks', 'ai_companion_images');
```

Disable a single endpoint instantly:

```sql
update public.cost_guardrail_config
set enabled = false
where scope_type = 'endpoint'
  and scope_key = 'generate-companion-image';
```

Raise a budget after review:

```sql
update public.cost_guardrail_config
set monthly_budget_usd = 150.00
where scope_type = 'feature'
  and scope_key = 'ai_companion_images';
```

## Investigation queries

Current budget status:

```sql
select *
from public.cost_budget_status_v
order by utilization_percent desc nulls last, total_estimated_cost_usd desc;
```

Top spend-driving endpoints today:

```sql
select *
from public.cost_driver_endpoints_daily_v
where day_utc = timezone('utc', now())::date
order by total_estimated_cost_usd desc, request_count desc
limit 20;
```

Top spend-driving users today:

```sql
select *
from public.cost_driver_users_daily_v
where day_utc = timezone('utc', now())::date
order by total_estimated_cost_usd desc, request_count desc
limit 20;
```

Recent alerts:

```sql
select created_at, scope_type, scope_key, alert_type, threshold_percent, message, delivery_status
from public.cost_alert_events
order by created_at desc
limit 50;
```

## Re-enable flow

1. Review `public.cost_budget_status_v`, `public.cost_driver_endpoints_daily_v`, and provider dashboards.
2. Re-enable the smallest safe scope first:
   - provider
   - endpoint
   - feature
3. Remove env kill switches only after the DB flags are back to `enabled=true`.
4. Resume scheduled jobs after live traffic is stable.

## Provider-side setup still required

OpenAI:

- Configure project monthly budgets and notification thresholds in the API platform.
- Configure project model usage permissions and rate limits.
- Use the Costs API for reconciliation.
- Docs:
  - [Managing projects in the API platform](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)
  - [OpenAI Costs API](https://platform.openai.com/docs/api-reference/usage/costs?api-mode=responses&lang=curl)

ElevenLabs:

- Put production API keys into workspace billing groups with usage limits.
- Review usage analytics and request logs regularly.
- Docs:
  - [Billing groups](https://elevenlabs.io/docs/overview/administration/workspaces/billing-groups)
  - [Usage analytics](https://elevenlabs.io/docs/overview/administration/usage-analytics)

Supabase:

- Enable Spend Cap and watch the Usage and Upcoming Invoice pages.
- As of March 28, 2026, Supabase documents Spend Cap as coarse-grained and not a replacement for app-side threshold alerts.
- Docs:
  - [Supabase cost control](https://supabase.com/docs/guides/platform/cost-control)

Anomaly alerts:

- App-side anomaly detection is implemented in `cost-guardrail-monitor`.
- No first-party anomaly alert docs were found for OpenAI, ElevenLabs, or Supabase during the March 28, 2026 setup review.
