# Supabase Authorization Audit

Date: 2026-03-28

Scope:
- Supabase tables and RLS policies
- RPCs and security-definer functions
- Storage buckets and storage policies
- Edge functions invoked by clients or capable of mutating protected data

Method:
- Static review of tracked SQL migrations, generated client types, edge functions, and frontend call sites
- Cross-check of client-visible schema against policy coverage
- No live database verification in this workspace because local Supabase/Postgres tooling is unavailable here

## Highest-Risk Findings

1. `retry-failed-payouts` could be invoked without JWT validation and used a service-role client without verifying admin access. Patched by requiring request auth, enforcing admin/service-role access, and turning `verify_jwt` on.

2. `deal-boss-damage` trusted a caller-supplied `userId` while running with service-role privileges. Patched by binding non-service requests to `auth.uid()` and turning `verify_jwt` on.

3. `generate-journey-path` accepted a caller-supplied `userId` and did not verify epic access before writing user-scoped data with a service-role client. Patched by binding non-service requests to `auth.uid()` and checking epic ownership/membership.

4. `apply_referral_code_secure` allowed authenticated users to apply a referral code for another user's UUID. Patched by rejecting calls where `auth.uid() <> p_user_id`.

5. `profiles` still exposed premium, referral, streak-freeze, and life-state fields to client-side mutation through the broad update policy. Patched by freezing those fields in the restricted profile update policy.

6. `user_companion` allowed direct client updates to progression and generated-image fields, including the image refresh rate-limit counter. Patched by freezing those fields in RLS and moving regeneration writes to a new security-definer RPC.

7. `journey-paths` and `mentor-audio` storage buckets allowed authenticated uploads even though uploads are produced by trusted server flows. Patched by restricting writes to service-role access.

8. `achievements`, `user_reflections`, and `challenge_tasks` appeared in client types without tracked RLS coverage in the repo. Patched with conditional RLS/policy creation if those relations exist.

9. `award_xp_v2` let authenticated clients choose arbitrary event names and amounts. Patched by wrapping the existing implementation with event-type allowlisting, idempotency-key enforcement, and per-event XP bounds. This reduces the abuse surface, but it should still move toward server-derived validation over time.

## Residual Follow-Up

- `user_achievement_stats` exists in generated client types, but its view definition was not found in tracked migrations. This audit sets `security_invoker = true` if the view exists, but the underlying SELECT should still be reviewed in a live database.
- `get-creator-stats` is intentionally public in the current design and exposes creator earnings summaries by email/code lookup. That is a product/privacy decision worth revisiting even though it is not an RLS bypass.
- `award_xp_v2` is safer after this patch, but the strongest end state is still to make more XP awards server-derived from authoritative task/mission/epic state instead of client-submitted amounts.

## Artifacts

- Full table matrix: `docs/supabase-table-access-matrix-2026-03-28.csv`
- SQL regression coverage: `supabase/tests/auth_authorization_regression.sql`
- Hardening migration: `supabase/migrations/20260328143000_harden_authorization_surfaces.sql`
