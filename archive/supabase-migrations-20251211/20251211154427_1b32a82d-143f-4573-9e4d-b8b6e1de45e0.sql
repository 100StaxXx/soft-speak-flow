-- Fix Critical RLS Vulnerability: profiles table has "true" policies allowing unrestricted access
-- This migration removes dangerous policies and creates proper owner-based restrictions

-- Step 1: Drop existing dangerous policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role has full access" ON public.profiles;

-- Step 2: Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create service role bypass (required for edge functions using service role key)
-- Service role is used by edge functions that validate Firebase tokens
CREATE POLICY "Service role full access"
  ON public.profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Step 4: Create restrictive policies for authenticated users
-- Users can only view their own profile (profile ID must match their auth UID)
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can insert their own profile (only if ID matches their auth UID)
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update only their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Users can delete only their own profile
CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (id = auth.uid());

-- Step 5: For Firebase auth compatibility, also allow access via anon role 
-- when the request comes from an edge function with validated Firebase token
-- The edge function sets the profile ID it's accessing, and service role handles the actual query
-- Note: Direct anon access is blocked - anon users get no access
CREATE POLICY "Anon users no access"
  ON public.profiles
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);