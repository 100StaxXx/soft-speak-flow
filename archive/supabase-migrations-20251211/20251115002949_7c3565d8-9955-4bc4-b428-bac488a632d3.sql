-- Fix profiles table RLS policy to protect email privacy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Fix pep_talks table to restrict write access to admins only
DROP POLICY IF EXISTS "Anyone can insert pep talks" ON public.pep_talks;
DROP POLICY IF EXISTS "Anyone can update pep talks" ON public.pep_talks;
DROP POLICY IF EXISTS "Anyone can delete pep talks" ON public.pep_talks;

CREATE POLICY "Admins can manage pep talks" ON public.pep_talks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add missing DELETE policy for challenge_progress
CREATE POLICY "Users can delete own progress" ON public.challenge_progress
  FOR DELETE USING (auth.uid() = user_id);