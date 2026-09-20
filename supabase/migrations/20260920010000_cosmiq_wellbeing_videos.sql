-- Isolated from hatch/evolution jobs and from Graceward. No paid work is queued by this migration.
CREATE TABLE public.cosmiq_wellbeing_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  stage integer NOT NULL CHECK (stage IN (1,5,13,21,36,56,81)),
  category text NOT NULL CHECK (category IN ('mind','body','soul')),
  source_image_url text NOT NULL,
  source_key text NOT NULL,
  prompt_version integer NOT NULL DEFAULT 1,
  prompt text NOT NULL,
  provider_model text NOT NULL,
  provider_task_id text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','submitting','processing','succeeded','failed')),
  video_url text,
  error_code text,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 1),
  deadline_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  lease_token uuid,
  lease_until timestamptz,
  next_poll_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (companion_id, stage, category, source_key, prompt_version)
);
ALTER TABLE public.cosmiq_wellbeing_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cosmiq_wellbeing_videos FROM anon, authenticated;
GRANT SELECT ON public.cosmiq_wellbeing_videos TO authenticated;
GRANT ALL ON public.cosmiq_wellbeing_videos TO service_role;
CREATE POLICY "Read own wellbeing clips" ON public.cosmiq_wellbeing_videos FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX cosmiq_wellbeing_queue ON public.cosmiq_wellbeing_videos(next_poll_at) WHERE status IN ('queued','submitting','processing');

-- Claim one job atomically. A crashed submission is NEVER submitted a second time:
-- it may already have been billed by the provider and needs operator reconciliation.
CREATE FUNCTION public.claim_cosmiq_wellbeing_video()
RETURNS SETOF public.cosmiq_wellbeing_videos
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE selected_id uuid;
BEGIN
  SELECT id INTO selected_id FROM public.cosmiq_wellbeing_videos
  WHERE status IN ('queued','submitting','processing') AND next_poll_at <= now()
    AND (lease_until IS NULL OR lease_until < now())
  ORDER BY next_poll_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF selected_id IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public.cosmiq_wellbeing_videos SET
    lease_token = gen_random_uuid(), lease_until = now() + interval '5 minutes', updated_at = now()
    WHERE id = selected_id RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_cosmiq_wellbeing_video() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_cosmiq_wellbeing_video() TO service_role;

-- Additional cap; does not raise or overwrite existing provider/global budgets.
INSERT INTO public.cost_guardrail_config(scope_type, scope_key, enabled, monthly_budget_usd, alert_thresholds, metadata)
VALUES ('feature','cosmiq_wellbeing_video',true,25,ARRAY[50,80,90,100],'{"description":"Optional three-second Mind Body Soul clips"}'),
       ('endpoint','companion-wellbeing-video',true,25,ARRAY[50,80,90,100],'{"description":"Cosmiq wellbeing video queue"}')
ON CONFLICT (scope_type,scope_key) DO NOTHING;

-- Requires the existing internal-secret scheduler. Deployment must verify this job exists.
SELECT cron.schedule('companion-wellbeing-video', '* * * * *',
  $cron$SELECT public.invoke_edge_function_with_internal_secret('companion-wellbeing-video', '{}'::jsonb);$cron$);
