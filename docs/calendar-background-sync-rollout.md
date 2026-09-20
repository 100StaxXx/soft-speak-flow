# Closed-app calendar synchronization — rollout checklist

Status: schema and worker deployed September 19 for build 353; **not enabled or scheduled** pending real-provider checks. See [release status](2026-09-19-testflight-353.md).

## Boundaries

Only opt-in rows in calendar_quest_imports are eligible. Google/Outlook linked events and tasks can be reconciled. Apple EventKit data is device-only. Legacy send-only links and read-only outside events are not enrolled automatically.

The worker never POSTs or DELETEs provider items. It reads an exact saved item identity and conditionally PATCHes the existing item using its version. Notes, meeting data, recurrence, attendees and alarms are preserved. Deletion retains the Cosmiq quest and marks the link missing; conflicts require an explicit choice in Preferences.

Phone and server share the same planner and database apply safeguards. An already dispatched provider request can finish after pause/disable; neither control promises to undo an in-flight remote request. Subsequent writes are blocked. Failed database acknowledgement is reconciled from the saved baseline on the next attempt.

## Before activation

1. Resolve production SQL management timeouts. Validate all three September 19 calendar migrations against the target schema with a guaranteed rollback first. Local PGlite tests are necessary but do not reproduce every production trigger.
2. Apply the validated migrations in their recorded order. The worker control row defaults to disabled. These migrations install no schedule.
3. Deploy the isolated calendar endpoints and worker, preserving the shared backend's newer product-boundary OAuth handlers. Verify the worker rejects requests lacking the internal scheduler secret.
4. Verify Google Tasks/Microsoft permissions and token rotation with test accounts. Test a credential refresh overlapping an older foreground handler or account reconnect; the worker's global lease serializes worker invocations, not all legacy OAuth refreshes.
5. Exercise pull, push, simultaneous edits, provider deletion, connection disconnection, pause during a read, lost acknowledgement, provider 429/Retry-After, multi-day all-day intervals, DST and a completed task. Test only owned disposable items, not arbitrary user calendars.
6. Confirm Vault contains the existing scheduler helper's required URL, nonprivileged API key and internal secret. Never expose the service key or scheduler secret in the app.
7. Only after explicit rollout approval: enable the singleton row in calendar_sync_worker_control and schedule the existing invoke_edge_function_with_internal_secret helper to call calendar-sync-worker once a minute. The handler immediately acknowledges and registers bounded work with EdgeRuntime.waitUntil. Do not add an unauthenticated cron endpoint.

The worker starts at most ten linked-item checks per invocation, with a 50-second start-work budget and 20-second provider request timeouts. It claims one link at a time; both dispatcher and item leases expire after three minutes. Successfully checked links become eligible after two minutes. Per-item exponential retry reaches one hour; provider Retry-After delays apply account-wide, capped at 24 hours. This is polling, not real-time webhook delivery.

Monitor due-link queue age, retry/conflict counts and provider quotas before expanding rollout or changing limits. Never log tokens, event descriptions, task content or user email addresses.

## Disable / recover

Disable the singleton control row and unschedule only the calendar-sync-worker cron job. This does not disable other shared-backend schedulers or remove links. The worker checks the control row before each provider write. Pausing one linked quest or disconnecting its calendar also prevents subsequent writes. An interrupted worker releases its leases through expiry; no connection reset, data deletion or provider-item recreation is needed.

Provider webhooks/delta cursors and scalable per-account scheduling remain future work. No Apple closed-app claim is made.

References: [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions) and [background tasks](https://supabase.com/docs/guides/functions/background-tasks).
