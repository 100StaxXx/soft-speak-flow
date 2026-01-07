-- Fix overly permissive RLS policies

-- 1. Fix adversary_images: Only service role should insert (used by edge functions)
DROP POLICY IF EXISTS "Service role can insert adversary images" ON public.adversary_images;
CREATE POLICY "Service role can insert adversary images" 
ON public.adversary_images 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- 2. Fix mentors table: Only admins (via user_roles table) can manage mentors
DROP POLICY IF EXISTS "Admins can delete mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can insert mentors" ON public.mentors;
DROP POLICY IF EXISTS "Admins can update mentors" ON public.mentors;

CREATE POLICY "Admins can insert mentors" 
ON public.mentors 
FOR INSERT 
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update mentors" 
ON public.mentors 
FOR UPDATE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete mentors" 
ON public.mentors 
FOR DELETE 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 3. Fix security_audit_log: Only service role should insert (used by edge functions for logging)
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.security_audit_log;
CREATE POLICY "Service role can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
TO service_role
WITH CHECK (true);