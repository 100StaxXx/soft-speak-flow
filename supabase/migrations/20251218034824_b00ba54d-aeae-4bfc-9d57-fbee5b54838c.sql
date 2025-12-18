-- Fix view to use SECURITY INVOKER to properly enforce RLS policies
ALTER VIEW public.rhythm_tracks_with_scores SET (security_invoker = true);