-- Add RLS and security metadata conditionally so this migration is portable.
DO $$
BEGIN
  IF to_regclass('public.user_achievement_stats') IS NOT NULL THEN
    EXECUTE 'COMMENT ON VIEW public.user_achievement_stats IS ''User achievement statistics - access controlled by underlying table RLS''';
  END IF;

  IF to_regclass('public.rhythm_tracks_with_scores') IS NOT NULL THEN
    EXECUTE 'COMMENT ON VIEW public.rhythm_tracks_with_scores IS ''Public rhythm track scores for community voting display''';
  END IF;

  IF to_regclass('public.prompt_templates') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view prompt templates" ON public.prompt_templates';
    EXECUTE 'DROP POLICY IF EXISTS "prompt_templates_public_read" ON public.prompt_templates';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view prompt templates" ON public.prompt_templates';
    EXECUTE
      'CREATE POLICY "Authenticated users can view prompt templates" ' ||
      'ON public.prompt_templates ' ||
      'FOR SELECT TO authenticated USING (true)';
    EXECUTE 'ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;
