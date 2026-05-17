# Account deletion failure report

## Observations
- Account deletion is driven by the `delete-user` Edge Function, invoked from the Profile page via `supabase.functions.invoke` with the user's access token.
- The Edge Function constructs a Supabase client using the `SUPABASE_SERVICE_ROLE_KEY`, attempts Storage API cleanup first, calls the `delete_user_account` RPC as the database cleanup fallback, then removes the auth user through `supabase.auth.admin.deleteUser`.
- The SQL function `delete_user_account` is defined in migrations, requires execution with the `service_role` role, and can directly clear matching `storage.objects` rows for user-owned storage paths when the Storage API path is incomplete.

## 2026-05-16 storage cleanup diagnosis
- A Profile toast that says uploaded-file cleanup failed maps to `ACCOUNT_DELETION_STORAGE_CLEANUP_FAILED` with `stage: "storage_cleanup"`.
- The known blocker is a permission/RLS failure while the Edge Function queries Supabase `storage.objects` metadata to discover user-owned files. That metadata query should not prevent the user from deleting their account.
- The expected behavior is degraded success: log `failureReason: "permission"`, return a `STORAGE_CLEANUP_INCOMPLETE` warning, continue through `delete_user_account`, then attempt auth deletion.

## 2026-04-12 production drift verification
- Linked Supabase project ref: `opbfpbbqvuksuvmtmssd` from `supabase/config.toml`.
- Remote `delete-user` function status:
  - `ACTIVE`
  - version `16`
  - last updated `2026-04-04 18:16:01 UTC`
- Remote migration history is behind local repo state. As of 2026-04-12, the linked project is missing these local migrations:
  - `20260411111500_cap_astral_encounter_daily_xp.sql`
  - `20260411143000_refine_daily_mission_pulse_percentages.sql`
  - `20260412113100_fix_delete_user_account_companion_fk_cleanup.sql`
  - `20260412134500_notification_install_dedupe.sql`
- The account-deletion-specific drift is the missing `20260412113100_fix_delete_user_account_companion_fk_cleanup.sql` migration plus the older April 4 `delete-user` deploy. That is enough to explain why production can still return the old generic failure surface.

## Likely root causes of non-2xx responses
1. **Missing service role secret in the Edge Function environment**
   - The Edge Function hard-requires both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. If the service role key is not present, it throws `"Missing Supabase environment variables"`, which results in a 500 response.
   - Supabase Edge Functions expose `SUPABASE_URL` and `SUPABASE_ANON_KEY` by default, but *not* the service role key—so it must be added manually via secrets. Any release without this secret will always fail before reaching the RPC or auth deletion calls.

2. **RPC unavailable in the deployed database**
   - The function calls `supabase.rpc("delete_user_account", { p_user_id: userId })`. If the `delete_user_account` function from the migration has not been applied in the target project, the RPC will error and produce a 500 response.

3. **Invalid/expired user access token**
   - The function requires a Bearer token and returns 401 if the header is missing or empty. The client surfaces session-expired errors, but if the token is expired or revoked, the Edge Function will also respond with 401.

4. **Storage metadata permission failure**
   - The function queries `storage.objects` ownership metadata to discover user-owned files that were not recorded in `user_storage_assets`. If this query is permission-blocked, deletion should continue with a warning because the database cleanup fallback can still clear user-owned storage object rows.

## Recommended remedies
1. **Ensure secrets are set for the Edge Function**
   - Add `SUPABASE_SERVICE_ROLE_KEY` (and confirm `SUPABASE_URL`) to the Edge Function’s secrets in the Supabase dashboard/CLI, then redeploy the function. Without this, deletions will always fail.

2. **Confirm the migration is applied**
   - Verify that `public.delete_user_account(uuid)` exists in the target database. If not, run the migration (or create the function) before redeploying.

3. **Validate client session flow**
   - Confirm that `supabase.auth.getSession()` returns an active `access_token` before invoking the function and that logout flows refresh tokens as expected. If repeated 401s occur after adding the service role key, capture the exact error payload from the Edge Function logs to pinpoint token issues.

4. **Treat storage metadata permission issues as degraded cleanup**
   - Keep Storage API cleanup best-effort. Permission failures in storage ownership discovery should be logged and surfaced as warnings, not returned as fatal account deletion failures.
