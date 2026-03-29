# Backend Abuse Protection Admin Notes

## Where Limits Live

Global defaults are stored in `public.abuse_protection_config`.

- Each row maps a `profile_key` such as `auth.sign_in`, `ai.standard`, `ai.expensive_export`, `upload.attachments`, `invite`, or `email.send`.
- The active enforcement path is the `public.consume_abuse_protection(...)` RPC, which writes counters into `public.abuse_counter_windows` and events into `public.abuse_events`.
- Temporary per-user exceptions live in `public.abuse_limit_overrides`.

Useful queries:

```sql
select profile_key, endpoint_name, user_limit, ip_limit, email_limit, window_seconds, cooldown_seconds
from public.abuse_protection_config
order by profile_key, endpoint_name nulls first;
```

```sql
select *
from public.abuse_limit_overrides
where expires_at > now()
order by created_at desc;
```

## Raising Limits Safely For One User

Do not edit counters in `public.abuse_counter_windows`.
Do not loosen a shared default in `public.abuse_protection_config` for a single user.

Use a short-lived override instead:

```sql
insert into public.abuse_limit_overrides (
  profile_key,
  user_id,
  user_limit,
  reason,
  granted_by,
  expires_at
) values (
  'ai.expensive_export',
  '00000000-0000-0000-0000-000000000000',
  15,
  'Temporary increase for approved creator launch week',
  auth.uid(),
  now() + interval '7 days'
);
```

Guardrails:

- Always set `reason`.
- Always set `expires_at`.
- Prefer the narrowest `profile_key` possible.
- Raise only the user-specific column you need, not the IP/email limits.

## Detecting Abuse Patterns

Start with the rollup view:

```sql
select *
from public.abuse_recent_patterns
order by last_seen_at desc
limit 100;
```

Then drill into raw events:

```sql
select created_at, severity, event_type, endpoint_name, code, user_id, ip_address, email_target, retry_after_seconds
from public.abuse_events
where created_at > now() - interval '24 hours'
order by created_at desc;
```

Patterns worth acting on:

- Repeated `RATE_LIMITED` or `COOLDOWN_ACTIVE` rows from one IP across many users.
- Repeated auth failures for the same `email_target`.
- Frequent `bypass_attempt` rows, especially attachment path mismatches or forged user flows.
- Sudden spikes on `ai.expensive_export`, `upload.attachments`, `invite`, or `email.send`.

Suggested response flow:

1. Confirm the pattern in `public.abuse_recent_patterns`.
2. Inspect matching `public.abuse_events` rows for the exact endpoint, IP, and subject.
3. If it is a legitimate customer, add a temporary `abuse_limit_overrides` row.
4. If it looks malicious, leave limits in place and monitor for spread across additional IPs or accounts.
