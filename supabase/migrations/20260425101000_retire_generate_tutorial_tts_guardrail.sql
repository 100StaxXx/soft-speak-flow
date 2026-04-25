DELETE FROM public.cost_guardrail_config
WHERE scope_type = 'endpoint'
  AND scope_key = 'generate-tutorial-tts';
