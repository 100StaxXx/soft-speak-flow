-- Surface companion_evolutions UPDATEs to Supabase Realtime so the front-end
-- can hot-swap the Kling MP4 in mid-presentation and re-present unseen videos
-- on next app load.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.companion_evolutions;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
    WHEN undefined_object THEN
      NULL;
  END;
END $$;

-- Cost guardrail entry for the Kling video pipeline. Killswitch-controlled by
-- COMPANION_KLING_ENABLED in the function env; this row caps spend even when
-- the killswitch is on.
INSERT INTO public.cost_guardrail_config (scope_type, scope_key, enabled, monthly_budget_usd, alert_thresholds, metadata)
VALUES (
  'endpoint',
  'process-companion-animation-job',
  true,
  50.00,
  ARRAY[50,80,90,100],
  '{"risk":"high","description":"fal.ai Kling image-to-video reveal pipeline; ~$0.40 per 5s clip"}'
)
ON CONFLICT (scope_type, scope_key) DO NOTHING;
