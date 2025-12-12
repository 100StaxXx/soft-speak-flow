-- Profiles: Allow viewing all profiles (original policy)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;

CREATE POLICY "Users can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (true);

-- Mentors: Ensure it allows viewing
DROP POLICY IF EXISTS "Anyone can view mentors" ON public.mentors;
CREATE POLICY "Anyone can view mentors"
  ON public.mentors
  FOR SELECT
  USING (true);