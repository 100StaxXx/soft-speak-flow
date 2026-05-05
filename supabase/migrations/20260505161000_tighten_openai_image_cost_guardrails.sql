INSERT INTO public.cost_guardrail_config (
  scope_type,
  scope_key,
  enabled,
  monthly_budget_usd,
  alert_thresholds,
  metadata
)
VALUES
  ('feature', 'ai_companion_images', true, 40.00, ARRAY[50,80,90,100], '{"description":"Companion and title-card image generation","cost_posture":"reduced_2026_05_05"}'),
  ('feature', 'ai_companion_evolution', true, 35.00, ARRAY[50,80,90,100], '{"description":"Companion evolution image pipeline","cost_posture":"reduced_2026_05_05"}'),
  ('endpoint', 'generate-companion-image', true, 30.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Companion image generation with cost-first defaults","cost_posture":"reduced_2026_05_05"}'),
  ('endpoint', 'generate-companion-evolution', true, 30.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Companion evolution image pipeline with cost-first defaults","cost_posture":"reduced_2026_05_05"}'),
  ('endpoint', 'generate-cosmiq-title-card', true, 12.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Shared Cosmiq title card image generation","cost_posture":"reduced_2026_05_05"}')
ON CONFLICT (scope_type, scope_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  monthly_budget_usd = EXCLUDED.monthly_budget_usd,
  alert_thresholds = EXCLUDED.alert_thresholds,
  metadata = public.cost_guardrail_config.metadata || EXCLUDED.metadata,
  updated_at = timezone('utc', now());
