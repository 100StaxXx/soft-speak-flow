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
    'ai_companion_planner',
    true,
    35.00,
    ARRAY[50,80,90,100],
    '{"description":"Companion planner chat and planner-side text enrichments","cost_posture":"tracked_2026_05_05"}'
  ),
  (
    'endpoint',
    'companion-planner-chat',
    true,
    25.00,
    ARRAY[50,80,90,100],
    '{"risk":"high","description":"Companion planner chat orchestration","cost_posture":"tracked_2026_05_05"}'
  ),
  (
    'endpoint',
    'classify-task-intent',
    true,
    20.00,
    ARRAY[50,80,90,100],
    '{"risk":"medium","description":"Pathfinder and planner intent classification","cost_posture":"tracked_2026_05_05"}'
  ),
  (
    'endpoint',
    'decompose-task',
    true,
    15.00,
    ARRAY[50,80,90,100],
    '{"risk":"medium","description":"Task breakdown text generation","cost_posture":"tracked_2026_05_05"}'
  ),
  (
    'endpoint',
    'adjust-epic-plan',
    true,
    15.00,
    ARRAY[50,80,90,100],
    '{"risk":"medium","description":"Epic adjustment text suggestions","cost_posture":"tracked_2026_05_05"}'
  )
ON CONFLICT (scope_type, scope_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  monthly_budget_usd = EXCLUDED.monthly_budget_usd,
  alert_thresholds = EXCLUDED.alert_thresholds,
  metadata = public.cost_guardrail_config.metadata || EXCLUDED.metadata,
  updated_at = timezone('utc', now());
