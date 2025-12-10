-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can insert mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can update mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can delete mentors" ON public.mentors;

-- Recreate policies - allow anyone to view mentors
CREATE POLICY "Anyone can view mentors"
  ON public.mentors
  FOR SELECT
  USING (true);

-- Admin policies (temporarily allow all for now)
CREATE POLICY "Admins can insert mentors"
  ON public.mentors
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update mentors"
  ON public.mentors
  FOR UPDATE
  USING (true);

CREATE POLICY "Admins can delete mentors"
  ON public.mentors
  FOR DELETE
  USING (true);