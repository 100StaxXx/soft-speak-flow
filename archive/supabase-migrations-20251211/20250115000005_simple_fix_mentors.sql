-- Simple fix: Just allow everyone to view mentors
-- This is all we need since mentors are public data

DROP POLICY IF EXISTS "Anyone can view mentors" ON public.mentors;
CREATE POLICY "Anyone can view mentors"
  ON public.mentors
  FOR SELECT
  USING (true);

