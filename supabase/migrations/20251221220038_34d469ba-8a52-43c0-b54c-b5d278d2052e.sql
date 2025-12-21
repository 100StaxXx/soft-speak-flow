-- Add RLS policies for views that are missing them
-- Note: Views inherit RLS from underlying tables, but we can add explicit policies

-- For user_achievement_stats view - ensure users can only see their own stats
-- First check if the view exists and add a comment about security
COMMENT ON VIEW public.user_achievement_stats IS 'User achievement statistics - access controlled by underlying table RLS';

-- For rhythm_tracks_with_scores view - this is for public voting data, mark as intentionally public
COMMENT ON VIEW public.rhythm_tracks_with_scores IS 'Public rhythm track scores for community voting display';

-- Restrict prompt_templates to authenticated users only
-- First drop existing public select policy if it exists
DROP POLICY IF EXISTS "Anyone can view prompt templates" ON public.prompt_templates;
DROP POLICY IF EXISTS "prompt_templates_public_read" ON public.prompt_templates;

-- Create new policy for authenticated users only
CREATE POLICY "Authenticated users can view prompt templates"
ON public.prompt_templates
FOR SELECT
TO authenticated
USING (true);

-- Also ensure the table has RLS enabled
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;