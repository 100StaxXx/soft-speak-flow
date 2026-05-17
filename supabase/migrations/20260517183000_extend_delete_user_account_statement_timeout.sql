-- Account deletion can touch many user-owned tables. Keep the RPC callable
-- through PostgREST roles that have short default statement_timeout settings.
ALTER FUNCTION public.delete_user_account(uuid)
SET statement_timeout TO '20s';
