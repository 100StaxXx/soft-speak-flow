DROP POLICY IF EXISTS "Anyone can view mentors" ON public.mentors;
CREATE POLICY "Anyone can view mentors"
  ON public.mentors
  FOR SELECT
  USING (true);