# Supabase Security Hardening

## What was risky

- `generate-evening-response` and `generate-weekly-recap` were frontend-invoked functions that could be called without a verified user session. That created a path for someone to generate or overwrite another user's AI content if they knew an identifier.
- The creator dashboard relied on direct client reads and a public stats endpoint. That exposed earnings and payout history without a revocable backend access check.
- Several tables allowed authenticated users to update system-managed fields directly. That meant client code, browser devtools, or a malicious script could try to overwrite generated content, progression state, or cached assets.
- Storage upload rules were too broad for generated asset buckets. Authenticated users should not be able to upload their own files into backend-managed buckets like `mentor-audio` or `journey-paths`.
- Quest attachment validation depended mostly on path structure. Without server-side file checks, users could still try to upload unsafe types or oversized files.

## What changed

### Edge functions

- `generate-evening-response` now requires a real user JWT, rejects service-role style caller tokens, checks reflection ownership first, and only writes back to the caller's own row.
- `generate-weekly-recap` now derives the user from the JWT instead of trusting a body `userId`, rejects spoofed cross-user requests, and keeps recap generation scoped to the authenticated caller.
- `generate-journey-path` now uses the authenticated caller identity consistently, checks epic ownership or membership, and no longer mixes user auth with undefined service-role paths.
- `get-creator-stats` now requires both a referral code and a signed creator access token, verifies the token server-side, and returns only masked creator/contact data plus scoped stats.
- `request-referral-payout` now cleanly supports the two safe modes:
  - signed creator-token flow for influencer dashboards
  - authenticated user JWT flow for normal user referral payouts

### Database and storage

- `user_companion` keeps server-managed decay and mood fields locked behind RPCs.
- `mark_companion_active()` is the approved path for resetting activity-driven companion state.
- `evening_reflections` no longer allows direct client updates that could overwrite `mentor_response`.
- `weekly_recaps` no longer allows direct client inserts or updates. `mark_weekly_recap_viewed()` is the approved client-safe RPC for `viewed_at`.
- `epic_journey_paths` no longer accepts direct client inserts or updates.
- `mentor-audio` and `journey-paths` now accept writes only from the service role.
- `quest-attachments` keeps user-folder scoping and now also enforces:
  - allowed extensions
  - allowed MIME types
  - 10 MB max size

## Plain-English risk summary

- Without these checks, a logged-in user could try to tamper with generated mentor text, weekly recap content, or cached image rows directly from the browser.
- A public creator stats flow could leak signups, earnings, and payout history to anyone who guessed a code or email.
- Broad upload permissions are dangerous because generated asset buckets should be trusted outputs, not user-controlled inputs.
- Frontend checks are helpful for UX, but they are not security. If a rule only exists in React code, an attacker can skip it.

## Minimum safe production configuration

- Frontend user-data functions should default to `verify_jwt = true`.
- Any `verify_jwt = false` function must be intentionally public, webhook-only, or internal, and must have its own backend auth or abuse protection.
- Service-role keys should live only in edge functions and backend jobs.
- RLS must stay enabled on user-facing tables, especially any table with generated content, payouts, entitlements, or progression.
- Backend-managed buckets should be backend-write-only.
- User upload buckets should be private and folder-scoped to `auth.uid()`.
- Sensitive edge functions should use allowlisted origins instead of wildcard browser CORS.
- Creator access should rely on revocable backend-issued tokens, not just a referral code in the URL.

## Verification added in this pass

- Deno tests for:
  - reflection ownership enforcement
  - weekly recap scope enforcement
  - creator dashboard request normalization
- SQL regression coverage for:
  - denied direct writes to server-managed recap/reflection/path tables
  - allowed recap view RPC behavior
  - denied cross-user recap view RPC behavior
  - denied direct uploads to backend-only buckets
  - allowed own-folder quest attachment upload
  - denied anonymous uploads, cross-folder uploads, unsafe MIME types, unsafe extensions, and oversized quest attachments
