# Calendar expansion — September 19, 2026

## Release status

Update: the implemented foreground calendar expansion has now been deployed with its three schema migrations for build 353. The background worker is deployed but remains disabled and unscheduled. Build 4.8 (353) uploaded successfully through Xcode and Apple reports processing; tester availability is unverified. See [build 353 release status](2026-09-19-testflight-353.md) for current evidence, exclusions and remaining device checks. The entries below are the historical implementation/recovery record.

This expansion is **not released**. No new TestFlight upload, provider function deployment, or committed production migration was performed in this pass. The previously deployed calendar reader remains the live version. The shared-server outage described below was recovered by an explicitly approved restart; see the recovery entry at the end of this document.

The database management API intermittently returns HTTP 544, “Connection terminated due to connection timeout.” On continuation, a minimal read succeeded and confirmed `calendar_quest_imports` does not exist. Transactional production validation then timed out in the initial constraint inspection, and a separate constraint read also returned HTTP 544. Read-only connection-health checks succeeded and showed no long-running application transactions at that snapshot. Do not treat the production migration as validated or applied. No reset, restart, data cleanup or destructive recovery was attempted.

The migration and isolation tests **pass locally in actual in-memory PostgreSQL**, using a minimal task fixture plus the existing calendar migrations. This catches SQL/function/permission errors, but does not replace validation against production's complete task triggers and schema.

## Implemented locally

- Read-only outside events open a quiet details sheet with an explicit Turn into a quest action. Optional two-way linking is explained before import. Meeting links, original-provider links, directions and external-event overlap information stay in the sheet.
- Atomic, owner-scoped imports prevent double-tap/concurrent-device duplicates. Events do not import completion or award XP. Task imports have zero XP, avoiding reward duplication through external completion toggles.
- Three-way reconciliation merges independent edits and pauses conflicting edits. Date/time/duration changes are treated as one scheduling decision. Provider writes require an ETag; native writes compare modification dates. Local task writes compare both the link revision and expected task snapshot.
- Short-lived, owner-scoped sync claims serialize attempts across devices. Pause/reconnect changes invalidate pending claims; cloud handlers recheck immediately before writing, including after credential refresh. Native writes recheck both the current signed-in user and the claim. A provider request already dispatched can still finish; pausing prevents subsequent writes, not a transactional rollback of a remote request.
- When both sides already agree after a lost acknowledgement, the merge baseline is advanced without rewriting the provider. Wildcard ETags, impossible dates, stale revisions and expired claims are rejected. Native modification tokens retain full timestamp precision.
- Linked calendar fields: title, date/time/duration and location. Notes are copied at import, then preserved separately so syncing a quest cannot overwrite meeting invitation content, attendees, conferencing or alarms.
- Outside deletion marks the link missing and retains the quest. New safe links preserve the outside item when a quest is deleted. Legacy unupgraded links retain legacy behavior.
- A successful explicit export registers only its exact connection/item/kind, and only if the task still matches its captured send snapshot. Other older exports are **not silently upgraded**, since their historical merge baseline is unknown. Re-sending an existing legacy item uses its established outbound behavior before registration.
- Linked-task support for Google Tasks, Microsoft To Do and Apple Reminders: list selection, explicit import, title/due-date/completion reconciliation, independent pause controls and conflict resolution in Preferences. Task browsing lives in Goals.
- Direct creation of a Google Task or Apple Reminder from an existing quest is now implemented locally in the collapsed Goals task-list panel. Sending requires an explicit click and destination selection; two-way updates default off. The picker shows the 100 most recent unfinished quests. This sends one task and its due date/notes/completion, not a recurring series, timed appointment or alarm.
- Durable, owner-scoped export intents record each create attempt before the outside write. Repeat taps/devices cannot independently dispatch the same intent. An uncertain attempt is recovery-only: Google searches a reference marker in notes, Apple searches a reference URL on the reminder. If the marker is missing, removed, duplicated or not yet visible, no second copy is created; manual provider review may be needed. Only a definitive Google 400/401/403/404 rejection resets an attempt. Client waits are bounded, and read-only Apple lists are rejected before dispatch.
- Multiple visible calendars per existing provider connection, independent of the writable export destination. Apple lists include read-only calendars; they cannot be selected as write destinations.
- Failure to load one calendar no longer hides other successful calendars on that same account. Event details quietly report overlaps with loaded Cosmiq quests as well as outside events, excluding the event's own linked quest, completed/unscheduled quests and back-to-back appointments.
- Incoming overnight/multi-day events appear on intersected days, including month indicators. All-day end dates remain exclusive. Link timezones are captured so travel does not silently shift task times; nonexistent DST times are rejected.
- Apple EventKit: separate Reminders permission, reminder read/update methods, recurring occurrence identities, native export repeat rules, and optional quest alarm forwarding. Native updates target one occurrence and preserve series metadata.
- Persisted link state retries while the app is active and after reconnect/focus/resume. A separate closed-app Google/Outlook worker is now implemented locally, but remains disabled and unscheduled; no closed-app synchronization is live yet. Apple still requires device execution.
- Foreground and background synchronization use the same pure merge/date planner and the same private, owner-scoped SQL apply implementation. The public foreground wrapper cannot override the owner. The service-only worker uses expiring global/item claims, rechecks pause/connection/version before a conditional provider write, and never creates or deletes outside items.
- The worker handles at most ten links per invocation and starts no new work after 50 seconds. Claims are taken one at a time. Transient failures back off to one hour; provider Retry-After is honored across the account for up to 24 hours. Conflicts and missing items require user attention instead of automatic overwrites or recreation. Unchanged checks do not rewrite task rows or trigger task-progress side effects.

## Outstanding scope — not implemented or not complete

1. Multiple Google/Outlook accounts per provider. Existing storage has UNIQUE(user_id,provider); shared deployed OAuth and legacy functions use that identity. This needs an isolated account-versioned migration and an account-aware picker/send flow, without breaking the other app sharing the backend or older installed builds.
2. Provider webhooks/delta cursors and activation/real-provider verification of the new scheduled worker. The worker is implemented but intentionally disabled and unscheduled pending rollout. Its initial bounded polling capacity needs monitoring before broader activation. Apple synchronization requires device execution.
3. Full cross-provider recurrence editing: “this occurrence,” “this and following,” and “whole series,” exception preservation and series identity management. Existing Google/Outlook export limitations remain. Native export support is implemented, but device testing and clear series-level controls remain.
4. Direct task creation is implemented locally, but real-device/provider verification and deployment remain. There is deliberately no automatic re-create after an ambiguous result. Verify Apple reference-URL persistence/iCloud visibility and Google recovery pagination with actual test accounts before release. Existing Outlook To Do export is retained.
5. Provider free-busy, travel buffers and configurable provider reminder editing. The details sheet checks displayed external events and loaded day/week Cosmiq quests; it does not query undisplayed/private calendars or remote free-busy.
6. Physical-device consent and end-to-end provider testing, including Microsoft To Do ETag behavior and Apple recurring exceptions. No real user calendar items were created, edited or deleted during this pass.

## Rollout prerequisites

- Validate `supabase/migrations/20260919210000_safe_calendar_quest_links.sql`, `20260919210100_calendar_task_export_intents.sql` and `20260919210200_calendar_background_sync.sql` transactionally. The three local isolation suites cover links, exports and background claims. Check source constraints and existing task triggers on the target database. The migrations add calendar_link and isolated sync/export tables without rewriting existing tasks.
- Deploy the isolated `calendar-linked-event` and `calendar-task-items` functions and updated `calendar-read-events` together with the migration.
- Google needs the Tasks OAuth scope and potentially provider-console verification. **Do not deploy this repo's older Google auth handler over the live shared handler:** production has product-boundary logic absent locally. Apply the scope change to a fresh verified production baseline, preserving shared OAuth behavior. Reconnect Google afterward and approve Tasks access. Microsoft needs Tasks permissions; Apple prompts separately for Reminders.
- Verify paused links, account switching, conflict choices, deleted outside items, idempotent import, recurrence, DST, all-day ranges, offline local edits and reconnect. Then rebuild/sync, archive and upload the new app.
- Deploy and verify `calendar-sync-worker` separately while its control row remains disabled. Follow [the background-sync rollout checklist](calendar-background-sync-rollout.md); do not activate a cron job merely by applying the schema migration.

## Checks so far

- Focused calendar/UI suite: 162 passing tests before the final export-link integration.
- Follow-up export/link suite: 30 passing tests; recurrence/send follow-up: 25 passing tests (counts overlap).
- Provider handler tests: 15 passing tests, with mocked network calls.
- Final consent/details/task-import UI checks: 29 passing tests. Final display/date-only/source identity suite: 113 passing tests. Counts overlap with the suites above.
- Production build/iOS asset sync passed; native Xcode compilation passed after EventKit label correction.
- Full app type checking still reports broader pre-existing errors. New calendar files have no reported type errors at the last check.
- Database integration validation did not complete, and cannot be replaced by the mocked tests above.

## Continuation checks

- Final focused frontend/calendar suite: **182 tests passed** across 15 files, including lost-acknowledgement recovery and exact send registration.
- 25 provider tests passed, including a pause during token refresh, ETag enforcement, ownership filtering, invalid dates, hostile pagination, and missing/concurrently modified tasks.
- Final local PostgreSQL migration/integration checks passed: idempotent imports; stale/cross-user/paused/expired claims; lease recovery; completion timestamps without XP; unknown and multi-day durations; exact export registration and stale-send rejection; and real authenticated-role RLS/privilege checks.
- Reproduce local SQL checks with `deno run --no-lock --node-modules-dir=none --allow-read --allow-env --allow-net scripts/test-calendar-migration.ts`. This uses pinned PGlite 0.5.8 in the package cache, no app dependency changes and no production credentials.
- Production app build and iOS asset sync passed. Unsigned Xcode device compilation passed after the native date/version changes. Nothing uploaded.
- Function manifest check passed (96 entries), and whitespace/diff checks passed.
- Full app type checking still has existing errors outside this calendar slice; no errors reported for the changed calendar files.

## Direct task creation continuation

- Read-only production inspection again confirmed no calendar_quest_imports table. The combined migration/integration validation, enclosed in BEGIN/ROLLBACK, returned HTTP 544; nothing was intentionally committed or deployed.
- Both migrations and both SQL isolation suites pass in local PostgreSQL. Export tests cover same-intent reuse, ready-snapshot refresh, immutable dispatched snapshots/consent, one dispatch, client/cloud privilege separation, ownership, disconnection, duplicate finalization, zero quest/XP mutation, and default-off two-way links.
- Provider creation tests cover concurrent sends, lost responses, marker recovery, missing/duplicate markers, definitive versus ambiguous rejection, and failed link persistence.
- Rejected-send reset is bound to the specific dispatch attempt, so a delayed rejection cannot unlock a newer in-flight attempt.
- Apple native creation compiled successfully in the unsigned Xcode device build; physical-device consent, Reminders creation and marker persistence have not been exercised.
- Google Tasks supports date-only due dates and limits notes to 8,192 characters; the sender preserves user notes within an 8,000-character bound plus its recovery marker. See [Google's task resource documentation](https://developers.google.com/tasks/reference/rest/v1/tasks). Apple uses the documented [calendar-item URL property](https://developer.apple.com/documentation/eventkit/ekcalendaritem/url) for its recovery reference.
- Final focused checks: **198 frontend tests and 32 provider tests passed**; both local PostgreSQL integration suites passed. The app build, iOS asset sync, function manifest and unsigned native compilation passed. Full app type checking still reports the same 37 existing errors outside the changed calendar files.

## Closed-app worker continuation

- Shared the exact foreground merge/date planner with the worker; added tests for independent edits, date/time conflicts, multi-day all-day moves, nonexistent DST times, repeated-hour instant preservation, task due-date removal and lost acknowledgements.
- The local PostgreSQL checks pass with all three calendar migrations and isolation suites. The shared apply implementation is not directly executable by authenticated, anonymous or service-role clients; only the approved wrappers can call it. Worker control/claim/finalization APIs are service-only and check the actual request role.
- **127 focused frontend/UI tests and 46 provider/worker tests passed** in this continuation. These are selected regression suites, not a total app-wide test count. The production app build and 97-entry function manifest check passed. Full app type checking retains 37 existing errors outside the calendar slice.
- Production read-only inspection successfully retrieved both actual task constraint definitions. A bounded, rollback-only validation of the current migrations still returned HTTP 544. No production schema changes were intentionally committed, no scheduler was enabled, and no TestFlight build was uploaded.
- No real Google/Outlook tasks/events were written by tests. Physical-device/provider verification, concurrent credential-refresh compatibility with older deployed handlers, multiple accounts and full recurring-series controls remain release work.
- Final iOS asset synchronization, release-environment checks, bundle checks and Maps loader verification passed. Native Swift was unchanged in this continuation, so no new archive or native compilation was performed. A post-validation minimal production table check also returned HTTP 544; the last successful presence check was before the rollback-only attempt and showed the new tables absent.

## Finish attempt — confirmed shared-server blocker

- The CLI's direct PostgreSQL connection timed out during authentication, independently of the management SQL endpoint. This is not confined to the new calendar migration.
- The project summary reports ACTIVE_HEALTHY, but the more specific service-health endpoint reports **auth UNHEALTHY** and **rest UNHEALTHY**, while db is marked healthy. Disk-utilization and metrics endpoints return HTTP 500. These observations do not prove the underlying cause; resource exhaustion or an unhealthy service requires operator investigation/recovery.
- No shared-project restart, compute upgrade, data reset, schema deployment, scheduler activation or TestFlight upload was performed. A project restart may interrupt both Cosmiq and Graceward, so explicit approval is required before trying that recovery step.
- Locally fixed the new calendar credential helper to conditionally save rotated credentials only when the exact owner/provider/active connection and old credential version still match. A delayed refresh cannot overwrite a newer reconnect or refresh. Invalid token payloads and failed persistence fail closed before provider work. Older deployed handlers remain unchanged and still need compatibility verification.
- All **39 tests** in the affected credential/provider/worker suites passed, including five new credential-race tests. This is a selected regression count, not an app-wide total.
- Multiple-account support, advanced recurring-series controls and real-device/provider verification are still unfinished. Recovery of the shared server is a release blocker, not a claim that those features are complete.

## Approved server recovery — September 19, 2026, 7:40–7:48 PM Pacific

- The user explicitly approved restarting the Supabase project shared by Cosmiq and Graceward. Verified the exact target as Cosmiq, project opbfpbbqvuksuvmtmssd, before one restart request.
- Restart accepted with HTTP 200 at 2026-09-20 02:40:27 UTC. Project transitioned through RESTARTING and returned ACTIVE_HEALTHY by 02:46:49 UTC. No second restart, reset, restore or compute upgrade was attempted.
- Auth, REST and database health all returned healthy afterward. Direct PostgreSQL connectivity succeeded and the blocking-query inspection was empty. Disk reporting recovered and showed about 1.48 GB used of 8.35 GB.
- All three current calendar migrations successfully validated against production inside BEGIN/ROLLBACK, with one-second lock and eight-second statement limits. The worker was disabled inside the validation. A subsequent read confirmed imports, exports and worker tables were absent, proving that this validation did not commit the rollout.
- The local PostgreSQL migration/isolation suites passed again. Production user-data integration tests and physical-device/provider verification have not been performed.
- Supabase's public status page also reports an ongoing JWT-rejection incident. It may be relevant to intermittent login failures, but no causal link to this project's symptoms has been established. A restart does not constitute verification that Apple login is fixed. Source: https://status.supabase.com/
- The server availability blocker is cleared at this check. The broader unfinished feature and release checklist above still applies; no TestFlight upload or new calendar deployment occurred during recovery.
