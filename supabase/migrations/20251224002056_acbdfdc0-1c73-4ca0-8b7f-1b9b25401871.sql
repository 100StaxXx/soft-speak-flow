-- Fix conflicting RLS UPDATE policies on profiles table
-- Drop the permissive "Users can update own profile" policy to prevent bypass of field restrictions

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;