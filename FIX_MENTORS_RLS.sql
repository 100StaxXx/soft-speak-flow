-- ============================================
-- FIX MENTORS RLS - Ensure mentors are viewable
-- ============================================
-- Run this in your Supabase SQL Editor

-- First, check current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'mentors';

-- Drop ALL existing policies on mentors to start fresh
DROP POLICY IF EXISTS "Anyone can view mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can insert mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can update mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can delete mentors" ON public.mentors;

-- Recreate the SELECT policy - allow ANYONE to view mentors
CREATE POLICY "Anyone can view mentors"
  ON public.mentors
  FOR SELECT
  USING (true);

-- Verify the policy was created
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'mentors' AND cmd = 'SELECT';

-- Test query - this should return all 9 mentors
SELECT COUNT(*) as mentor_count FROM mentors;
SELECT name, slug, is_active FROM mentors ORDER BY name;

