-- Fix PUBLIC_DATA_EXPOSURE: Drop the overly permissive profiles SELECT policy
-- The "Users can view own profile" policy already exists, just need to remove the permissive one
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;