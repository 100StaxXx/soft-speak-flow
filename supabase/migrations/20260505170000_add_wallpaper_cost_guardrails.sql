INSERT INTO public.cost_guardrail_config (
  scope_type,
  scope_key,
  enabled,
  monthly_budget_usd,
  alert_thresholds,
  metadata
)
VALUES
  (
    'feature',
    'ai_wallpapers',
    true,
    15.00,
    ARRAY[50,80,90,100],
    '{"description":"Daily wallpaper image generation and validation","cost_posture":"tracked_2026_05_05"}'
  ),
  (
    'endpoint',
    'rotate-daily-wallpapers',
    true,
    10.00,
    ARRAY[50,80,90,100],
    '{"risk":"high","description":"Hourly wallpaper rotation image generation","cost_posture":"tracked_2026_05_05"}'
  ),
  (
    'endpoint',
    'generate-wallpaper-backlog',
    true,
    10.00,
    ARRAY[50,80,90,100],
    '{"risk":"high","description":"Admin-triggered wallpaper backlog image generation","cost_posture":"tracked_2026_05_05"}'
  )
ON CONFLICT (scope_type, scope_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  monthly_budget_usd = EXCLUDED.monthly_budget_usd,
  alert_thresholds = EXCLUDED.alert_thresholds,
  metadata = public.cost_guardrail_config.metadata || EXCLUDED.metadata,
  updated_at = timezone('utc', now());
