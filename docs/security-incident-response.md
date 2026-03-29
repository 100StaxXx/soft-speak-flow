# Security Incident Response

## Scope

Use this runbook for credential exposure, suspicious webhook traffic, abusive function usage, unexpected privileged writes, or storage-policy regressions affecting production.

## First 15 Minutes

1. Confirm the signal and capture the exact UTC timestamp, environment, impacted function or table, and the first alert or log reference.
2. Contain the issue before debugging deeply:
   - disable affected webhook endpoints if signatures are failing or abuse is active
   - pause scheduled jobs that amplify the incident
   - revoke or rotate exposed secrets
   - block abusive accounts or origin IPs if the signal is clearly malicious
3. Preserve evidence:
   - export relevant Supabase logs
   - save matching Sentry events
   - copy affected row ids, webhook event ids, and request ids
   - snapshot current environment settings before changing them

## Containment Checklist

- Rotate `SUPABASE_SERVICE_ROLE_KEY` if service-role exposure is suspected.
- Rotate `INTERNAL_FUNCTION_SECRET` if any internal-only function may have been exposed.
- Rotate provider secrets tied to the affected path, including PayPal, OpenAI, Resend, Apple, Google, APNS, or other third-party credentials.
- Disable the affected provider webhook until signature verification and replay handling are confirmed healthy.
- Temporarily reduce function traffic by disabling the affected feature flag, scheduled workflow, or entrypoint if the impact is ongoing.

## Evidence To Collect

- Request ids, user ids, payout ids, attachment paths, and webhook event ids involved in the incident.
- Security audit rows from `security_audit_log`.
- Rate-limit or abuse-protection records that show whether the traffic was throttled or bypassed.
- Database diffs for any rows that were overwritten or created unexpectedly.
- A list of secrets rotated, when they were rotated, and which environments were updated.

## Recovery

1. Patch the root cause in code, policy, or console settings.
2. Re-run the focused test coverage for the affected path.
3. Re-enable paused jobs or webhook endpoints only after validation succeeds.
4. Backfill or repair affected rows if the incident caused partial writes or missing generated data.

## Escalation

- Product/security owner: confirm customer impact, disclosure needs, and any support messaging.
- Backend owner: handle function rollback, migration review, and secret rotation completion.
- iOS/web owner: remove or gate compromised client flows if the incident is user-triggerable from the app.

## Post-Incident Review

- Document the trigger, blast radius, root cause, fix, and timeline.
- Add or tighten tests so the same class of failure is covered automatically.
- Convert any repeated manual console step into documented ownership with a recurring audit reminder.
