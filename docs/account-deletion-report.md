# Account deletion failure report

## Observations
- Account deletion is driven by the `delete-user-account` Edge Function, invoked from the Profile page via `supabase.functions.invoke` with the user's access token.
- The Edge Function constructs a Supabase client using the `SUPABASE_SERVICE_ROLE_KEY` and calls the `delete_user_account` RPC before removing the user through `supabase.auth.admin.deleteUser`.
- The SQL function `delete_user_account` is defined in migrations and requires execution with the `service_role` role.

## Likely root causes of non-2xx responses
1. **Missing service role secret in the Edge Function environment**
   - The Edge Function hard-requires both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. If the service role key is not present, it throws `"Missing Supabase environment variables"`, which results in a 500 response.
   - Supabase Edge Functions expose `SUPABASE_URL` and `SUPABASE_ANON_KEY` by default, but *not* the service role key—so it must be added manually via secrets. Any release without this secret will always fail before reaching the RPC or auth deletion calls.

2. **RPC unavailable in the deployed database**
   - The function calls `supabase.rpc("delete_user_account", { p_user_id: userId })`. If the `delete_user_account` function from the migration has not been applied in the target project, the RPC will error and produce a 500 response.

3. **Invalid/expired user access token**
   - The function requires a Bearer token and returns 401 if the header is missing or empty. The client surfaces session-expired errors, but if the token is expired or revoked, the Edge Function will also respond with 401.

## Recommended remedies
1. **Ensure secrets are set for the Edge Function**
   - Add `SUPABASE_SERVICE_ROLE_KEY` (and confirm `SUPABASE_URL`) to the Edge Function’s secrets in the Supabase dashboard/CLI, then redeploy the function. Without this, deletions will always fail.

2. **Confirm the migration is applied**
   - Verify that `public.delete_user_account(uuid)` exists in the target database. If not, run the migration (or create the function) before redeploying.

3. **Validate client session flow**
   - Confirm that `supabase.auth.getSession()` returns an active `access_token` before invoking the function and that logout flows refresh tokens as expected. If repeated 401s occur after adding the service role key, capture the exact error payload from the Edge Function logs to pinpoint token issues.
