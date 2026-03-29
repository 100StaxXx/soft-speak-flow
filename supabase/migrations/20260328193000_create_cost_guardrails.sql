CREATE TABLE IF NOT EXISTS public.cost_guardrail_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('provider', 'feature', 'endpoint')),
  scope_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  monthly_budget_usd NUMERIC(12,2),
  alert_thresholds INTEGER[] NOT NULL DEFAULT ARRAY[50,80,90,100],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (scope_type, scope_key)
);

CREATE TABLE IF NOT EXISTS public.cost_guardrail_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL CHECK (scope_type IN ('provider', 'feature', 'endpoint')),
  scope_key TEXT NOT NULL,
  period_start DATE NOT NULL,
  total_estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  request_count BIGINT NOT NULL DEFAULT 0,
  blocked_count BIGINT NOT NULL DEFAULT 0,
  last_threshold_percent INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (scope_type, scope_key, period_start)
);

CREATE TABLE IF NOT EXISTS public.cost_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  period_start DATE NOT NULL,
  provider TEXT,
  feature_key TEXT NOT NULL,
  endpoint_key TEXT NOT NULL,
  user_id UUID,
  request_id UUID NOT NULL,
  capability TEXT CHECK (capability IN ('text', 'image', 'tts', 'music', 'transcription', 'video')),
  model TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'blocked')),
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  audio_seconds NUMERIC(12,2),
  image_count INTEGER,
  latency_ms INTEGER,
  upstream_status INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.cost_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  period_start DATE NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('provider', 'feature', 'endpoint')),
  scope_key TEXT NOT NULL,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold', 'anomaly')),
  threshold_percent INTEGER,
  message TEXT NOT NULL,
  current_estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  dedupe_key TEXT NOT NULL UNIQUE,
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'skipped')),
  delivery_attempted_at TIMESTAMPTZ,
  delivery_response_status INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cost_events_created_at_idx
  ON public.cost_events (created_at DESC);

CREATE INDEX IF NOT EXISTS cost_events_endpoint_created_at_idx
  ON public.cost_events (endpoint_key, created_at DESC);

CREATE INDEX IF NOT EXISTS cost_events_user_created_at_idx
  ON public.cost_events (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cost_guardrail_state_scope_period_idx
  ON public.cost_guardrail_state (scope_type, scope_key, period_start DESC);

CREATE INDEX IF NOT EXISTS cost_alert_events_scope_created_at_idx
  ON public.cost_alert_events (scope_type, scope_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_cost_guardrail_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_cost_guardrail_config_updated_at ON public.cost_guardrail_config;
CREATE TRIGGER set_cost_guardrail_config_updated_at
BEFORE UPDATE ON public.cost_guardrail_config
FOR EACH ROW
EXECUTE FUNCTION public.set_cost_guardrail_updated_at();

DROP TRIGGER IF EXISTS set_cost_guardrail_state_updated_at ON public.cost_guardrail_state;
CREATE TRIGGER set_cost_guardrail_state_updated_at
BEFORE UPDATE ON public.cost_guardrail_state
FOR EACH ROW
EXECUTE FUNCTION public.set_cost_guardrail_updated_at();

ALTER TABLE public.cost_guardrail_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_guardrail_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_alert_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cost_guardrail_config FROM anon, authenticated;
REVOKE ALL ON public.cost_guardrail_state FROM anon, authenticated;
REVOKE ALL ON public.cost_events FROM anon, authenticated;
REVOKE ALL ON public.cost_alert_events FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_guardrail_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_guardrail_state TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_alert_events TO service_role;

CREATE OR REPLACE VIEW public.cost_driver_endpoints_daily_v AS
SELECT
  timezone('utc', created_at)::date AS day_utc,
  endpoint_key,
  feature_key,
  provider,
  capability,
  COUNT(*) FILTER (WHERE status <> 'blocked') AS request_count,
  COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_count,
  ROUND(COALESCE(SUM(estimated_cost_usd), 0)::numeric, 6) AS total_estimated_cost_usd,
  ROUND(AVG(latency_ms) FILTER (WHERE latency_ms IS NOT NULL)::numeric, 2) AS avg_latency_ms,
  MAX(created_at) AS last_seen_at
FROM public.cost_events
GROUP BY 1, 2, 3, 4, 5;

CREATE OR REPLACE VIEW public.cost_driver_users_daily_v AS
SELECT
  timezone('utc', created_at)::date AS day_utc,
  user_id,
  endpoint_key,
  feature_key,
  provider,
  COUNT(*) FILTER (WHERE status <> 'blocked') AS request_count,
  COUNT(*) FILTER (WHERE status = 'blocked') AS blocked_count,
  ROUND(COALESCE(SUM(estimated_cost_usd), 0)::numeric, 6) AS total_estimated_cost_usd,
  MAX(created_at) AS last_seen_at
FROM public.cost_events
WHERE user_id IS NOT NULL
GROUP BY 1, 2, 3, 4, 5;

CREATE OR REPLACE VIEW public.cost_budget_status_v AS
SELECT
  cfg.scope_type,
  cfg.scope_key,
  cfg.enabled,
  cfg.monthly_budget_usd,
  cfg.alert_thresholds,
  cfg.metadata,
  COALESCE(state.total_estimated_cost_usd, 0)::numeric(12,6) AS total_estimated_cost_usd,
  COALESCE(state.request_count, 0) AS request_count,
  COALESCE(state.blocked_count, 0) AS blocked_count,
  state.last_threshold_percent,
  state.period_start,
  CASE
    WHEN cfg.monthly_budget_usd IS NULL OR cfg.monthly_budget_usd <= 0 THEN NULL
    ELSE ROUND(((COALESCE(state.total_estimated_cost_usd, 0) / cfg.monthly_budget_usd) * 100)::numeric, 2)
  END AS utilization_percent
FROM public.cost_guardrail_config cfg
LEFT JOIN public.cost_guardrail_state state
  ON state.scope_type = cfg.scope_type
 AND state.scope_key = cfg.scope_key
 AND state.period_start = date_trunc('month', timezone('utc', now()))::date;

INSERT INTO public.cost_guardrail_config (scope_type, scope_key, enabled, monthly_budget_usd, alert_thresholds, metadata)
VALUES
  ('provider', 'openai', true, 300.00, ARRAY[50,80,90,100], '{"description":"All OpenAI-billed text, image, and transcription spend"}'),
  ('provider', 'elevenlabs', true, 200.00, ARRAY[50,80,90,100], '{"description":"All ElevenLabs-billed voice and music spend"}'),

  ('feature', 'ai_mentor_chat', true, 40.00, ARRAY[50,80,90,100], '{"description":"Mentor chat and lightweight conversational text"}'),
  ('feature', 'ai_morning_briefing', true, 25.00, ARRAY[50,80,90,100], '{"description":"Morning briefing generation"}'),
  ('feature', 'ai_pep_talks', true, 150.00, ARRAY[50,80,90,100], '{"description":"Pep-talk text, voice, and transcript pipeline"}'),
  ('feature', 'ai_companion_images', true, 100.00, ARRAY[50,80,90,100], '{"description":"Companion image generation and regeneration"}'),
  ('feature', 'ai_companion_evolution', true, 100.00, ARRAY[50,80,90,100], '{"description":"Companion evolution image pipeline"}'),
  ('feature', 'ai_journey_images', true, 60.00, ARRAY[50,80,90,100], '{"description":"Journey, postcard, campaign, and adversary images"}'),
  ('feature', 'ai_rhythm_tracks', true, 50.00, ARRAY[50,80,90,100], '{"description":"Generated music and rhythm tracks"}'),
  ('feature', 'ai_transcription', true, 50.00, ARRAY[50,80,90,100], '{"description":"Speech-to-text transcript workloads"}'),
  ('feature', 'ai_planner_text', true, 60.00, ARRAY[50,80,90,100], '{"description":"Planner, recap, seed, and suggestion text generation"}'),

  ('endpoint', 'generate-daily-mentor-pep-talks', true, 120.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Scheduled pep-talk fanout pipeline"}'),
  ('endpoint', 'generate-full-mentor-audio', true, 100.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Internal pep-talk script+audio pipeline"}'),
  ('endpoint', 'generate-mentor-script', true, 60.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Pep-talk script generation"}'),
  ('endpoint', 'generate-mentor-audio', true, 60.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Pep-talk audio generation"}'),
  ('endpoint', 'generate-single-daily-pep-talk', true, 40.00, ARRAY[50,80,90,100], '{"risk":"high","description":"On-demand single pep-talk generation"}'),
  ('endpoint', 'generate-tomorrow-pep-talks', true, 80.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Pre-generated pep talks for tomorrow"}'),
  ('endpoint', 'sync-daily-pep-talk-transcript', true, 35.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Pep-talk transcript sync"}'),
  ('endpoint', 'transcribe-audio', true, 40.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Audio transcription"}'),

  ('endpoint', 'generate-companion-image', true, 80.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Companion image generation with retries"}'),
  ('endpoint', 'generate-companion-evolution', true, 80.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Companion evolution pipeline"}'),
  ('endpoint', 'process-companion-evolution-job', true, 80.00, ARRAY[50,80,90,100], '{"risk":"critical","description":"Queued companion evolution pipeline"}'),

  ('endpoint', 'generate-rhythm-track', true, 50.00, ARRAY[50,80,90,100], '{"risk":"high","description":"ElevenLabs music generation"}'),
  ('endpoint', 'batch-generate-rhythm-tracks', true, 80.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Batch rhythm track generation"}'),
  ('endpoint', 'generate-cosmic-postcard', true, 40.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Postcard image+story generation"}'),
  ('endpoint', 'generate-evolution-voice', true, 30.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Evolution celebration line and audio"}'),
  ('endpoint', 'generate-campaign-welcome-image', true, 25.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Campaign welcome image generation"}'),
  ('endpoint', 'generate-journey-path', true, 30.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Journey path image generation"}'),
  ('endpoint', 'generate-adversary-image', true, 30.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Adversary image generation"}'),
  ('endpoint', 'generate-neglected-companion-image', true, 30.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Automated neglected companion image generation"}'),
  ('endpoint', 'generate-dormant-companion-image', true, 30.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Automated dormant companion image generation"}'),
  ('endpoint', 'generate-memorial-image', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Companion memorial image generation"}'),
  ('endpoint', 'generate-quote-image', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Inspirational quote image generation"}'),
  ('endpoint', 'generate-zodiac-images', true, 15.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Zodiac image generation"}'),
  ('endpoint', 'generate-tutorial-tts', true, 15.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Tutorial voice generation"}'),

  ('endpoint', 'mentor-chat', true, 25.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Mentor chat text generation"}'),
  ('endpoint', 'generate-morning-briefing', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Morning briefing text generation"}'),
  ('endpoint', 'generate-daily-plan', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Daily plan generation"}'),
  ('endpoint', 'generate-smart-daily-plan', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Smart daily plan generation"}'),
  ('endpoint', 'generate-daily-missions', true, 25.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Daily missions generation"}'),
  ('endpoint', 'generate-journey-schedule', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Journey schedule generation"}'),
  ('endpoint', 'generate-epic-suggestions', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Epic suggestion generation"}'),
  ('endpoint', 'generate-epic-narrative-seed', true, 20.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Epic narrative seed generation"}'),
  ('endpoint', 'generate-reflection-reply', true, 15.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Reflection reply generation"}'),
  ('endpoint', 'generate-check-in-response', true, 15.00, ARRAY[50,80,90,100], '{"risk":"medium","description":"Check-in response generation"}')
ON CONFLICT (scope_type, scope_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  monthly_budget_usd = EXCLUDED.monthly_budget_usd,
  alert_thresholds = EXCLUDED.alert_thresholds,
  metadata = EXCLUDED.metadata;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'invoke_edge_function_with_service_role'
  ) THEN
    BEGIN
      EXECUTE $sql$
        SELECT cron.unschedule('cost-guardrail-monitor')
        FROM cron.job
        WHERE cron.job.jobname = 'cost-guardrail-monitor'
      $sql$;
    EXCEPTION
      WHEN undefined_table OR undefined_function THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;

    BEGIN
      EXECUTE $sql$
        SELECT cron.schedule(
          'cost-guardrail-monitor',
          '5 * * * *',
          $$SELECT public.invoke_edge_function_with_service_role('cost-guardrail-monitor', '{}'::jsonb);$$
        )
        WHERE NOT EXISTS (
          SELECT 1
          FROM cron.job
          WHERE jobname = 'cost-guardrail-monitor'
        )
      $sql$;
    EXCEPTION
      WHEN undefined_table OR undefined_function THEN
        NULL;
    END;
  END IF;
END $$;
