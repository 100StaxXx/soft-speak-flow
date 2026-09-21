-- The production schema now contains enough user- and companion-linked tables
-- that a normal Graceward account can exceed the previous 20-second budget.
-- Keep this below the Edge Function's 150-second request idle limit, including
-- the function's best-effort storage cleanup and final auth deletion.
ALTER FUNCTION public.delete_user_account(uuid)
SET statement_timeout TO '120s';
