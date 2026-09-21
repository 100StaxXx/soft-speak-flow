-- Companion Cinema Engine
--
-- Stores private, one-boundary-ahead cinematic evolution packages and the
-- durable mythology that directs them. Claimed forms continue to live in
-- companion_evolutions; these rows are intentionally hidden until reveal.

ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS cinema_lineage_revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cinema_personality_profile JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE TABLE IF NOT EXISTS public.companion_traits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  trait_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  evidence_summary JSONB NOT NULL DEFAULT '[]'::JSONB,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (companion_id, trait_key)
);

CREATE TABLE IF NOT EXISTS public.companion_visual_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  mutation_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  mutation_type TEXT NOT NULL CHECK (
    mutation_type IN ('scar', 'marking', 'armor', 'aura', 'halo', 'weapon', 'relic', 'other')
  ),
  visual_description TEXT NOT NULL,
  source_event_type TEXT,
  source_event_id UUID,
  permanent BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  applied_from_level INTEGER NOT NULL DEFAULT 1 CHECK (applied_from_level >= 1),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (companion_id, mutation_key)
);

CREATE TABLE IF NOT EXISTS public.companion_legacy_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  legacy_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  achievement_type TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
  source_table TEXT,
  source_record_id UUID,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  achieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (companion_id, legacy_key)
);

CREATE TABLE IF NOT EXISTS public.companion_interaction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('watch', 'hunt', 'forge')),
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (
    status IN ('preparing', 'active', 'returning', 'completed', 'abandoned', 'failed', 'cancelled')
  ),
  title TEXT,
  intention TEXT,
  source_table TEXT,
  source_record_id UUID,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  outcome JSONB NOT NULL DEFAULT '{}'::JSONB,
  reward JSONB NOT NULL DEFAULT '{}'::JSONB,
  cinema_event_id UUID,
  completion_cinema_event_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_complete_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_cinema_limits (
  interaction_type TEXT PRIMARY KEY CHECK (interaction_type IN ('watch', 'hunt', 'forge')),
  daily_limit INTEGER NOT NULL CHECK (daily_limit BETWEEN 1 AND 100),
  monthly_limit INTEGER NOT NULL CHECK (monthly_limit BETWEEN 1 AND 1000),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.companion_cinema_limits (
  interaction_type,
  daily_limit,
  monthly_limit
)
VALUES
  ('watch', 4, 60),
  ('hunt', 1, 8),
  ('forge', 1, 8)
ON CONFLICT (interaction_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.companion_cinema_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('evolution', 'watch', 'hunt', 'forge', 'reaction', 'milestone', 'legendary', 'ascension')
  ),
  event_key TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'milestone' CHECK (
    category IN ('ambient', 'interaction', 'reaction', 'milestone', 'legendary')
  ),
  rarity TEXT NOT NULL DEFAULT 'rare' CHECK (
    rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')
  ),
  status TEXT NOT NULL DEFAULT 'waiting_context' CHECK (
    status IN (
      'waiting_context', 'queued', 'rendering_portrait', 'rendering_video',
      'ready', 'revealed', 'failed', 'cancelled', 'superseded'
    )
  ),
  boundary_level INTEGER CHECK (boundary_level IS NULL OR boundary_level IN (1, 5, 13, 21, 36, 56, 81)),
  previous_boundary_level INTEGER CHECK (
    previous_boundary_level IS NULL OR previous_boundary_level IN (0, 1, 5, 13, 21, 36, 56)
  ),
  lineage_revision INTEGER NOT NULL DEFAULT 1 CHECK (lineage_revision >= 1),
  title TEXT NOT NULL,
  reveal_copy TEXT,
  source_table TEXT,
  source_record_id UUID,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  scene_plan JSONB NOT NULL DEFAULT '{}'::JSONB,
  start_image_url TEXT,
  canonical_image_bucket TEXT,
  canonical_image_path TEXT,
  canonical_image_focal_x NUMERIC(6,5),
  canonical_image_focal_y NUMERIC(6,5),
  video_bucket TEXT,
  video_path TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 12 CHECK (duration_seconds BETWEEN 3 AND 30),
  audio_strategy TEXT NOT NULL DEFAULT 'native' CHECK (
    audio_strategy IN ('silent', 'native', 'curated_mix', 'tts_mix')
  ),
  provider TEXT NOT NULL DEFAULT 'fal',
  provider_model TEXT NOT NULL DEFAULT 'fal-ai/kling-video/v3/standard/image-to-video',
  priority INTEGER NOT NULL DEFAULT 100,
  render_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (render_attempt_count >= 0),
  max_render_attempts INTEGER NOT NULL DEFAULT 2 CHECK (max_render_attempts BETWEEN 1 AND 4),
  next_retry_at TIMESTAMPTZ,
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  portrait_completed_at TIMESTAMPTZ,
  video_completed_at TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (companion_id, event_type, event_key, lineage_revision)
);

CREATE TABLE IF NOT EXISTS public.companion_cinema_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.companion_cinema_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  candidate_index INTEGER NOT NULL CHECK (candidate_index BETWEEN 1 AND 4),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'submitted', 'processing', 'succeeded', 'failed', 'rejected', 'selected', 'cancelled')
  ),
  provider TEXT NOT NULL DEFAULT 'fal',
  provider_model TEXT NOT NULL,
  provider_task_id TEXT,
  provider_status TEXT,
  prompt TEXT NOT NULL,
  prompt_version TEXT NOT NULL DEFAULT 'cosmiq-cinema-v1',
  start_image_url TEXT NOT NULL,
  end_image_bucket TEXT NOT NULL,
  end_image_path TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 12 CHECK (duration_seconds BETWEEN 3 AND 30),
  generate_audio BOOLEAN NOT NULL DEFAULT FALSE,
  video_bucket TEXT,
  video_path TEXT,
  qa_score NUMERIC(6,3),
  qa_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  selected BOOLEAN NOT NULL DEFAULT FALSE,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_retry_at TIMESTAMPTZ,
  error_code TEXT,
  error_message TEXT,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, candidate_index)
);

ALTER TABLE public.companion_cinema_events
  ADD COLUMN IF NOT EXISTS selected_render_id UUID REFERENCES public.companion_cinema_renders(id) ON DELETE SET NULL;

ALTER TABLE public.companion_interaction_runs
  DROP CONSTRAINT IF EXISTS companion_interaction_runs_cinema_event_id_fkey;
ALTER TABLE public.companion_interaction_runs
  ADD CONSTRAINT companion_interaction_runs_cinema_event_id_fkey
  FOREIGN KEY (cinema_event_id) REFERENCES public.companion_cinema_events(id) ON DELETE SET NULL;

ALTER TABLE public.companion_interaction_runs
  DROP CONSTRAINT IF EXISTS companion_interaction_runs_completion_cinema_event_id_fkey;
ALTER TABLE public.companion_interaction_runs
  ADD CONSTRAINT companion_interaction_runs_completion_cinema_event_id_fkey
  FOREIGN KEY (completion_cinema_event_id) REFERENCES public.companion_cinema_events(id) ON DELETE SET NULL;

ALTER TABLE public.companion_evolutions
  ADD COLUMN IF NOT EXISTS cinema_event_id UUID REFERENCES public.companion_cinema_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companion_cinema_events_queue_idx
  ON public.companion_cinema_events(status, priority DESC, next_retry_at, queued_at)
  WHERE status IN ('queued', 'rendering_portrait', 'rendering_video');
CREATE INDEX IF NOT EXISTS companion_cinema_events_user_idx
  ON public.companion_cinema_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS companion_cinema_renders_queue_idx
  ON public.companion_cinema_renders(status, next_retry_at, created_at)
  WHERE status IN ('queued', 'submitted', 'processing');
CREATE INDEX IF NOT EXISTS companion_traits_active_idx
  ON public.companion_traits(companion_id, confidence DESC) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS companion_mutations_active_idx
  ON public.companion_visual_mutations(companion_id, acquired_at) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS companion_legacy_importance_idx
  ON public.companion_legacy_achievements(companion_id, importance DESC, achieved_at DESC);
CREATE INDEX IF NOT EXISTS companion_interaction_runs_active_idx
  ON public.companion_interaction_runs(user_id, companion_id, status, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS companion_interaction_runs_one_active_type_idx
  ON public.companion_interaction_runs(user_id, companion_id, interaction_type)
  WHERE status IN ('preparing', 'active', 'returning');

DROP TRIGGER IF EXISTS update_companion_traits_updated_at ON public.companion_traits;
CREATE TRIGGER update_companion_traits_updated_at
  BEFORE UPDATE ON public.companion_traits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_companion_visual_mutations_updated_at ON public.companion_visual_mutations;
CREATE TRIGGER update_companion_visual_mutations_updated_at
  BEFORE UPDATE ON public.companion_visual_mutations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_companion_interaction_runs_updated_at ON public.companion_interaction_runs;
CREATE TRIGGER update_companion_interaction_runs_updated_at
  BEFORE UPDATE ON public.companion_interaction_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_companion_cinema_events_updated_at ON public.companion_cinema_events;
CREATE TRIGGER update_companion_cinema_events_updated_at
  BEFORE UPDATE ON public.companion_cinema_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_companion_cinema_renders_updated_at ON public.companion_cinema_renders;
CREATE TRIGGER update_companion_cinema_renders_updated_at
  BEFORE UPDATE ON public.companion_cinema_renders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.companion_traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_visual_mutations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_legacy_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_interaction_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_cinema_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_cinema_renders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_cinema_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.companion_traits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.companion_visual_mutations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.companion_legacy_achievements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.companion_interaction_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.companion_cinema_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.companion_cinema_renders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.companion_cinema_limits FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.companion_traits TO authenticated;
GRANT SELECT ON public.companion_visual_mutations TO authenticated;
GRANT SELECT ON public.companion_legacy_achievements TO authenticated;
GRANT SELECT ON public.companion_interaction_runs TO authenticated;
GRANT ALL ON public.companion_traits TO service_role;
GRANT ALL ON public.companion_visual_mutations TO service_role;
GRANT ALL ON public.companion_legacy_achievements TO service_role;
GRANT ALL ON public.companion_interaction_runs TO service_role;
GRANT ALL ON public.companion_cinema_events TO service_role;
GRANT ALL ON public.companion_cinema_renders TO service_role;
GRANT ALL ON public.companion_cinema_limits TO service_role;

CREATE POLICY "Users can view own companion traits"
  ON public.companion_traits FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own companion mutations"
  ON public.companion_visual_mutations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own companion legacy"
  ON public.companion_legacy_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own companion interaction runs"
  ON public.companion_interaction_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role manages companion traits"
  ON public.companion_traits FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages companion mutations"
  ON public.companion_visual_mutations FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages companion legacy"
  ON public.companion_legacy_achievements FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages companion interaction runs"
  ON public.companion_interaction_runs FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages companion cinema events"
  ON public.companion_cinema_events FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages companion cinema renders"
  ON public.companion_cinema_renders FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role manages companion cinema limits"
  ON public.companion_cinema_limits FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public)
VALUES ('companion-cinema-private', 'companion-cinema-private', FALSE)
ON CONFLICT (id) DO UPDATE SET public = FALSE;

-- Do not add an authenticated/public storage.objects policy for this bucket.
-- The service_role database role has BYPASSRLS and is the only application role
-- that accesses these objects through Storage. Newer Supabase projects own
-- storage.objects with supabase_storage_admin, so a postgres migration cannot
-- safely create a redundant service-role policy here.

-- The ledger writer is SECURITY DEFINER and accepts a user id. Application
-- clients never need to invoke it directly; leaving the legacy authenticated
-- grant in place would let a caller reassign another user's known asset path
-- and make later account cleanup delete the wrong object.
REVOKE ALL ON FUNCTION public.register_user_storage_asset(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user_storage_asset(UUID, TEXT, TEXT, TEXT, TEXT, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_companion_observed_traits_internal(
  p_user_id UUID,
  p_companion_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.companion_traits (
    user_id,
    companion_id,
    trait_key,
    display_name,
    confidence,
    evidence_count,
    evidence_summary,
    active,
    last_observed_at
  )
  SELECT
    companion.user_id,
    companion.id,
    candidate.trait_key,
    candidate.display_name,
    LEAST(1, GREATEST(0, candidate.confidence)),
    candidate.evidence_count,
    candidate.evidence_summary,
    candidate.confidence >= 0.30,
    now()
  FROM public.user_companion companion
  CROSS JOIN LATERAL (
    VALUES
      (
        'relentless'::TEXT,
        'Relentless'::TEXT,
        COALESCE(companion.resolve, 300)::NUMERIC / 1000,
        (SELECT COUNT(*)::INTEGER FROM public.companion_attribute_events e
          WHERE e.companion_id = companion.id AND e.attribute = 'resolve'),
        jsonb_build_array('resolve', COALESCE(companion.resolve, 300))
      ),
      (
        'disciplined',
        'Disciplined',
        COALESCE(companion.discipline, 300)::NUMERIC / 1000,
        (SELECT COUNT(*)::INTEGER FROM public.companion_attribute_events e
          WHERE e.companion_id = companion.id AND e.attribute = 'discipline'),
        jsonb_build_array('discipline', COALESCE(companion.discipline, 300))
      ),
      (
        'calculating',
        'Calculating',
        COALESCE(companion.wisdom, 300)::NUMERIC / 1000,
        (SELECT COUNT(*)::INTEGER FROM public.companion_attribute_events e
          WHERE e.companion_id = companion.id AND e.attribute = 'wisdom'),
        jsonb_build_array('wisdom', COALESCE(companion.wisdom, 300))
      ),
      (
        'curious',
        'Curious',
        COALESCE(companion.creativity, 300)::NUMERIC / 1000,
        (SELECT COUNT(*)::INTEGER FROM public.companion_attribute_events e
          WHERE e.companion_id = companion.id AND e.attribute = 'creativity'),
        jsonb_build_array('creativity', COALESCE(companion.creativity, 300))
      ),
      (
        'protective',
        'Protective',
        (COALESCE(companion.care_responsiveness, 0.5) +
          LEAST(1, COALESCE(companion.bond_level, 0)::NUMERIC / 100)) / 2,
        COALESCE(companion.total_interactions, 0),
        jsonb_build_array(
          'careResponsiveness', COALESCE(companion.care_responsiveness, 0.5),
          'bondLevel', COALESCE(companion.bond_level, 0)
        )
      ),
      (
        'patient',
        'Patient',
        (COALESCE(companion.care_consistency, 0.5) +
          COALESCE(companion.care_recovery, 0.5)) / 2,
        COALESCE(companion.dormancy_recovery_days, 0),
        jsonb_build_array(
          'careConsistency', COALESCE(companion.care_consistency, 0.5),
          'careRecovery', COALESCE(companion.care_recovery, 0.5)
        )
      )
  ) AS candidate(
    trait_key,
    display_name,
    confidence,
    evidence_count,
    evidence_summary
  )
  WHERE companion.id = p_companion_id
    AND companion.user_id = p_user_id
    AND companion.product_mode = 'cosmiq'
  ON CONFLICT (companion_id, trait_key) DO UPDATE SET
    confidence = EXCLUDED.confidence,
    evidence_count = EXCLUDED.evidence_count,
    evidence_summary = EXCLUDED.evidence_summary,
    active = EXCLUDED.active,
    last_observed_at = EXCLUDED.last_observed_at,
    updated_at = now();

  UPDATE public.user_companion companion
  SET cinema_personality_profile = jsonb_build_object(
      'observedAt', now(),
      'traits', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'key', trait.trait_key,
          'name', trait.display_name,
          'confidence', trait.confidence
        ) ORDER BY trait.confidence DESC)
        FROM public.companion_traits trait
        WHERE trait.companion_id = p_companion_id AND trait.active = TRUE
      ), '[]'::jsonb)
    ),
    updated_at = now()
  WHERE companion.id = p_companion_id
    AND companion.user_id = p_user_id
    AND companion.product_mode = 'cosmiq';
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_companion_observed_traits_internal(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_companion_observed_traits_internal(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_cosmiq_cinema_event_internal(
  p_user_id UUID,
  p_companion_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_companion public.user_companion%ROWTYPE;
  v_next_boundary INTEGER;
  v_event_id UUID;
  v_context JSONB;
  v_was_terminal BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR p_companion_id IS NULL THEN
    RAISE EXCEPTION 'user_id and companion_id are required';
  END IF;

  SELECT * INTO v_companion
  FROM public.user_companion
  WHERE id = p_companion_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;
  IF v_companion.product_mode IS DISTINCT FROM 'cosmiq' THEN
    RAISE EXCEPTION 'Cinematic prebuilds are only available for Cosmiq companions';
  END IF;
  IF COALESCE(v_companion.current_stage, 0) < 1 THEN
    RAISE EXCEPTION 'Companion must hatch before cinematic prebuilds begin';
  END IF;

  PERFORM public.refresh_companion_observed_traits_internal(p_user_id, p_companion_id);
  SELECT * INTO v_companion
  FROM public.user_companion
  WHERE id = p_companion_id AND user_id = p_user_id;

  SELECT MIN(boundary_level) INTO v_next_boundary
  FROM unnest(ARRAY[5, 13, 21, 36, 56, 81]) AS boundary_level
  WHERE boundary_level > v_companion.current_stage;

  IF v_next_boundary IS NULL THEN
    RETURN NULL;
  END IF;

  v_context := jsonb_build_object(
    'capturedAt', now(),
    'currentStage', v_companion.current_stage,
    'nextBoundaryLevel', v_next_boundary,
    'currentXp', v_companion.current_xp,
    'spiritAnimal', v_companion.spirit_animal,
    'presetId', v_companion.preset_id,
    'coreElement', v_companion.core_element,
    'favoriteColor', v_companion.favorite_color,
    'storyTone', v_companion.story_tone,
    'bondLevel', v_companion.bond_level,
    'personalityProfile', COALESCE(v_companion.cinema_personality_profile, '{}'::jsonb),
    'memories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'type', recent.memory_type,
        'date', recent.memory_date,
        'context', recent.memory_context
      ) ORDER BY recent.memory_date DESC)
      FROM (
        SELECT memory_type, memory_date, memory_context
        FROM public.companion_memories
        WHERE companion_id = p_companion_id
        ORDER BY memory_date DESC, created_at DESC
        LIMIT 20
      ) recent
    ), '[]'::jsonb),
    'traits', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', trait_key,
        'name', display_name,
        'confidence', confidence
      ) ORDER BY confidence DESC)
      FROM public.companion_traits
      WHERE companion_id = p_companion_id AND active = TRUE
    ), '[]'::jsonb),
    'mutations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', mutation_key,
        'name', display_name,
        'type', mutation_type,
        'visualDescription', visual_description
      ) ORDER BY acquired_at)
      FROM public.companion_visual_mutations
      WHERE companion_id = p_companion_id AND active = TRUE
    ), '[]'::jsonb),
    'legacy', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'key', legacy_key,
        'title', title,
        'description', description,
        'importance', importance
      ) ORDER BY importance DESC, achieved_at DESC)
      FROM public.companion_legacy_achievements
      WHERE companion_id = p_companion_id
    ), '[]'::jsonb)
  );

  SELECT event.status IN ('failed', 'cancelled', 'superseded')
  INTO v_was_terminal
  FROM public.companion_cinema_events event
  WHERE event.companion_id = p_companion_id
    AND event.event_type = 'evolution'
    AND event.event_key = 'level_' || v_next_boundary::TEXT
    AND event.lineage_revision = GREATEST(
      COALESCE(v_companion.cinema_lineage_revision, 1),
      1
    );
  v_was_terminal := COALESCE(v_was_terminal, FALSE);

  INSERT INTO public.companion_cinema_events (
    user_id,
    companion_id,
    event_type,
    event_key,
    category,
    rarity,
    status,
    boundary_level,
    previous_boundary_level,
    lineage_revision,
    title,
    reveal_copy,
    context_snapshot,
    start_image_url,
    duration_seconds,
    audio_strategy,
    provider,
    provider_model,
    priority,
    max_render_attempts,
    queued_at
  ) VALUES (
    p_user_id,
    p_companion_id,
    'evolution',
    'level_' || v_next_boundary::TEXT,
    CASE WHEN v_next_boundary >= 56 THEN 'legendary' ELSE 'milestone' END,
    CASE WHEN v_next_boundary >= 56 THEN 'legendary' ELSE 'epic' END,
    'queued',
    v_next_boundary,
    v_companion.current_stage,
    GREATEST(COALESCE(v_companion.cinema_lineage_revision, 1), 1),
    'Level ' || v_next_boundary || ' Evolution',
    'Your companion wants to see you.',
    v_context,
    COALESCE(v_companion.current_image_url, v_companion.initial_image_url),
    CASE WHEN v_next_boundary >= 56 THEN 15 ELSE 12 END,
    'native',
    'fal',
    'fal-ai/kling-video/v3/standard/image-to-video',
    CASE WHEN v_next_boundary = 5 THEN 200 ELSE 100 END,
    2,
    now()
  )
  ON CONFLICT (companion_id, event_type, event_key, lineage_revision)
  DO UPDATE SET
    context_snapshot = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded')
        THEN EXCLUDED.context_snapshot
      ELSE companion_cinema_events.context_snapshot
    END,
    start_image_url = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded')
        THEN EXCLUDED.start_image_url
      ELSE companion_cinema_events.start_image_url
    END,
    status = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded')
        THEN 'queued'
      ELSE companion_cinema_events.status
    END,
    error_code = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.error_code
    END,
    error_message = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.error_message
    END,
    next_retry_at = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.next_retry_at
    END,
    queued_at = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN now()
      ELSE companion_cinema_events.queued_at
    END,
    render_attempt_count = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN 0
      ELSE companion_cinema_events.render_attempt_count
    END,
    lease_token = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.lease_token
    END,
    lease_expires_at = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.lease_expires_at
    END,
    selected_render_id = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.selected_render_id
    END,
    video_bucket = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.video_bucket
    END,
    video_path = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.video_path
    END,
    video_completed_at = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.video_completed_at
    END,
    ready_at = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.ready_at
    END,
    revealed_at = CASE
      WHEN companion_cinema_events.status IN ('failed', 'cancelled', 'superseded') THEN NULL
      ELSE companion_cinema_events.revealed_at
    END,
    updated_at = now()
  RETURNING id INTO v_event_id;

  -- A terminal retry is new paid work. Never poll a stale provider task or
  -- select an old candidate from the previous failed/cancelled attempt.
  UPDATE public.companion_cinema_renders
  SET status = 'queued',
      provider_task_id = NULL,
      provider_status = NULL,
      video_bucket = NULL,
      video_path = NULL,
      qa_score = NULL,
      selected = FALSE,
      retry_count = 0,
      next_retry_at = NULL,
      error_code = NULL,
      error_message = NULL,
      submitted_at = NULL,
      completed_at = NULL,
      updated_at = now()
  WHERE event_id = v_event_id
    AND v_was_terminal
    AND status IN ('failed', 'cancelled', 'rejected');

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_cosmiq_cinema_event_internal(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_cosmiq_cinema_event_internal(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.start_companion_cinema_interaction_internal(
  p_user_id UUID,
  p_companion_id UUID,
  p_interaction_type TEXT,
  p_title TEXT,
  p_reveal_copy TEXT,
  p_intention TEXT,
  p_context_snapshot JSONB,
  p_expected_complete_at TIMESTAMPTZ,
  p_duration_seconds INTEGER,
  p_provider_model TEXT
)
RETURNS TABLE(
  run_id UUID,
  event_id UUID,
  reused BOOLEAN,
  daily_remaining INTEGER,
  monthly_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_companion public.user_companion%ROWTYPE;
  v_run public.companion_interaction_runs%ROWTYPE;
  v_event_id UUID;
  v_limit public.companion_cinema_limits%ROWTYPE;
  v_event_status TEXT;
  v_daily_count INTEGER;
  v_monthly_count INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_companion_id IS NULL THEN
    RAISE EXCEPTION 'cinema_identity_required';
  END IF;
  IF p_interaction_type NOT IN ('watch', 'hunt', 'forge') THEN
    RAISE EXCEPTION 'cinema_interaction_invalid';
  END IF;
  IF p_interaction_type = 'forge' AND NULLIF(btrim(p_intention), '') IS NULL THEN
    RAISE EXCEPTION 'cinema_forge_intention_required';
  END IF;

  -- Serialize starts for one user/companion/type so rapid taps and multiple
  -- devices cannot create duplicate paid provider work.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      p_user_id::TEXT || ':' || p_companion_id::TEXT || ':' || p_interaction_type,
      0
    )
  );

  SELECT * INTO v_companion
  FROM public.user_companion
  WHERE id = p_companion_id
    AND user_id = p_user_id
    AND product_mode = 'cosmiq'
    AND current_stage >= 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cinema_companion_unavailable';
  END IF;

  SELECT * INTO v_run
  FROM public.companion_interaction_runs
  WHERE user_id = p_user_id
    AND companion_id = p_companion_id
    AND interaction_type = p_interaction_type
    AND status IN ('preparing', 'active', 'returning')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_run.id IS NOT NULL AND v_run.cinema_event_id IS NOT NULL THEN
    SELECT event.status INTO v_event_status
    FROM public.companion_cinema_events event
    WHERE event.id = v_run.cinema_event_id
      AND event.user_id = p_user_id
      AND event.companion_id = p_companion_id;

    IF v_event_status IS NULL OR v_event_status IN ('failed', 'cancelled', 'superseded') THEN
      UPDATE public.companion_interaction_runs
      SET status = CASE WHEN v_event_status = 'cancelled' THEN 'cancelled' ELSE 'failed' END,
          completed_at = now(),
          outcome = outcome || jsonb_build_object(
            'reason',
            CASE
              WHEN v_event_status IS NULL THEN 'orphaned_event_repaired'
              ELSE 'terminal_event_repaired'
            END,
            'eventStatus',
            v_event_status
          ),
          updated_at = now()
      WHERE id = v_run.id;
      v_run := NULL;
    ELSE
      SELECT limits.* INTO v_limit
      FROM public.companion_cinema_limits limits
      WHERE limits.interaction_type = p_interaction_type;
      SELECT COUNT(*)::INTEGER INTO v_daily_count
      FROM public.companion_cinema_events event
      WHERE event.user_id = p_user_id
        AND event.event_type = p_interaction_type
        AND event.status NOT IN ('failed', 'superseded')
        AND event.created_at >= date_trunc('day', now());
      SELECT COUNT(*)::INTEGER INTO v_monthly_count
      FROM public.companion_cinema_events event
      WHERE event.user_id = p_user_id
        AND event.event_type = p_interaction_type
        AND event.status NOT IN ('failed', 'superseded')
        AND event.created_at >= date_trunc('month', now());
      RETURN QUERY SELECT
        v_run.id,
        v_run.cinema_event_id,
        TRUE,
        GREATEST(COALESCE(v_limit.daily_limit, 0) - COALESCE(v_daily_count, 0), 0),
        GREATEST(COALESCE(v_limit.monthly_limit, 0) - COALESCE(v_monthly_count, 0), 0);
      RETURN;
    END IF;
  ELSIF v_run.id IS NOT NULL THEN
    -- Repair a partial legacy write instead of permanently reusing an orphan.
    UPDATE public.companion_interaction_runs
    SET status = 'failed',
        completed_at = now(),
        outcome = outcome || '{"reason":"orphaned_start_repaired"}'::JSONB,
        updated_at = now()
    WHERE id = v_run.id;
  END IF;

  SELECT * INTO v_limit
  FROM public.companion_cinema_limits limits
  WHERE limits.interaction_type = p_interaction_type
  FOR UPDATE;
  IF NOT FOUND OR v_limit.enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'cinema_interaction_disabled';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_daily_count
  FROM public.companion_cinema_events event
  WHERE event.user_id = p_user_id
    AND event.event_type = p_interaction_type
    AND event.status NOT IN ('failed', 'superseded')
    AND event.created_at >= date_trunc('day', now());
  SELECT COUNT(*)::INTEGER INTO v_monthly_count
  FROM public.companion_cinema_events event
  WHERE event.user_id = p_user_id
    AND event.event_type = p_interaction_type
    AND event.status NOT IN ('failed', 'superseded')
    AND event.created_at >= date_trunc('month', now());

  IF v_daily_count >= v_limit.daily_limit THEN
    RAISE EXCEPTION 'cinema_daily_limit_reached';
  END IF;
  IF v_monthly_count >= v_limit.monthly_limit THEN
    RAISE EXCEPTION 'cinema_monthly_limit_reached';
  END IF;

  INSERT INTO public.companion_interaction_runs (
    user_id,
    companion_id,
    interaction_type,
    status,
    title,
    intention,
    context_snapshot,
    expected_complete_at
  ) VALUES (
    p_user_id,
    p_companion_id,
    p_interaction_type,
    'active',
    p_title,
    NULLIF(btrim(p_intention), ''),
    COALESCE(p_context_snapshot, '{}'::JSONB),
    p_expected_complete_at
  )
  RETURNING * INTO v_run;

  INSERT INTO public.companion_cinema_events (
    user_id,
    companion_id,
    event_type,
    event_key,
    category,
    rarity,
    status,
    lineage_revision,
    title,
    reveal_copy,
    source_table,
    source_record_id,
    context_snapshot,
    start_image_url,
    duration_seconds,
    audio_strategy,
    provider,
    provider_model,
    priority,
    max_render_attempts,
    queued_at
  ) VALUES (
    p_user_id,
    p_companion_id,
    p_interaction_type,
    p_interaction_type || '_' || v_run.id::TEXT,
    'interaction',
    CASE WHEN p_interaction_type = 'hunt' THEN 'epic' ELSE 'rare' END,
    'queued',
    GREATEST(COALESCE(v_companion.cinema_lineage_revision, 1), 1),
    p_title,
    p_reveal_copy,
    'companion_interaction_runs',
    v_run.id,
    COALESCE(p_context_snapshot, '{}'::JSONB),
    COALESCE(v_companion.current_image_url, v_companion.initial_image_url),
    LEAST(30, GREATEST(3, p_duration_seconds)),
    'native',
    'fal',
    p_provider_model,
    150,
    2,
    now()
  )
  RETURNING id INTO v_event_id;

  UPDATE public.companion_interaction_runs
  SET cinema_event_id = v_event_id,
      updated_at = now()
  WHERE id = v_run.id;

  RETURN QUERY SELECT
    v_run.id,
    v_event_id,
    FALSE,
    GREATEST(v_limit.daily_limit - v_daily_count - 1, 0),
    GREATEST(v_limit.monthly_limit - v_monthly_count - 1, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.start_companion_cinema_interaction_internal(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_companion_cinema_interaction_internal(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, INTEGER, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.request_next_cosmiq_cinema_event(p_companion_id UUID)
RETURNS TABLE(event_id UUID, status TEXT, boundary_level INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_event_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_event_id := public.enqueue_cosmiq_cinema_event_internal(v_user_id, p_companion_id);
  RETURN QUERY
  SELECT event.id, event.status, event.boundary_level
  FROM public.companion_cinema_events event
  WHERE event.id = v_event_id;
END;
$$;

-- Queue creation must pass through the rollout-aware Edge entry point. Exposing
-- this SECURITY DEFINER wrapper to authenticated clients would let accounts
-- outside the rollout fill the worker queue even though provider work is gated.
REVOKE ALL ON FUNCTION public.request_next_cosmiq_cinema_event(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_next_cosmiq_cinema_event(UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_companion_cinema_statuses(p_companion_id UUID)
RETURNS TABLE(
  event_id UUID,
  event_type TEXT,
  event_key TEXT,
  category TEXT,
  rarity TEXT,
  status TEXT,
  boundary_level INTEGER,
  title TEXT,
  reveal_copy TEXT,
  ready_at TIMESTAMPTZ,
  revealed_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    event.id,
    event.event_type,
    event.event_key,
    event.category,
    event.rarity,
    event.status,
    event.boundary_level,
    event.title,
    event.reveal_copy,
    event.ready_at,
    event.revealed_at
  FROM public.companion_cinema_events event
  WHERE event.user_id = auth.uid()
    AND event.companion_id = p_companion_id
    AND EXISTS (
      SELECT 1
      FROM public.user_companion companion
      WHERE companion.id = event.companion_id
        AND companion.user_id = auth.uid()
        AND companion.product_mode = 'cosmiq'
    )
  ORDER BY event.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_companion_cinema_statuses(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_companion_cinema_statuses(UUID) TO authenticated, service_role;

INSERT INTO public.cost_guardrail_config (
  scope_type,
  scope_key,
  enabled,
  monthly_budget_usd,
  alert_thresholds,
  metadata
)
VALUES
  ('feature', 'ai_companion_cinema', TRUE, 2500.00, ARRAY[25,50,80,100], '{"description":"Personalized Cosmiq cinema engine","quality_posture":"cinematic"}'),
  ('endpoint', 'process-companion-cinema-event', TRUE, 2500.00, ARRAY[25,50,80,100], '{"risk":"critical","description":"Portrait and cinematic render pipeline"}')
ON CONFLICT (scope_type, scope_key) DO UPDATE SET
  alert_thresholds = EXCLUDED.alert_thresholds,
  metadata = public.cost_guardrail_config.metadata || EXCLUDED.metadata,
  updated_at = timezone('utc', now());

UPDATE public.cost_guardrail_config
SET alert_thresholds = ARRAY[25,50,80,100],
    metadata = metadata || '{"cinema_cost_tracking_enabled":true}'::jsonb,
    updated_at = timezone('utc', now())
WHERE (scope_type = 'provider' AND scope_key = 'fal')
   OR (scope_type = 'provider' AND scope_key = 'openai');

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('process-companion-cinema-event')
    FROM cron.job
    WHERE cron.job.jobname = 'process-companion-cinema-event';
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  BEGIN
    PERFORM cron.unschedule('cleanup-companion-cinema-private-assets')
    FROM cron.job
    WHERE cron.job.jobname = 'cleanup-companion-cinema-private-assets';
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN NULL;
    WHEN OTHERS THEN NULL;
  END;

  BEGIN
    PERFORM cron.schedule(
      'process-companion-cinema-event',
      '* * * * *',
      $cron$
        SELECT public.invoke_edge_function_with_internal_secret(
          'process-companion-cinema-event',
          jsonb_build_object('workerSlot', worker_slot)
        )
        FROM generate_series(1, 10) AS workers(worker_slot);
      $cron$
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'process-companion-cinema-event'
    );
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN NULL;
  END;

  BEGIN
    PERFORM cron.schedule(
      'cleanup-companion-cinema-private-assets',
      '17 3 * * *',
      $cron$
        SELECT public.invoke_edge_function_with_internal_secret(
          'cleanup-companion-cinema-private-assets',
          '{}'::jsonb
        );
      $cron$
    )
    WHERE NOT EXISTS (
      SELECT 1 FROM cron.job
      WHERE jobname = 'cleanup-companion-cinema-private-assets'
    );
  EXCEPTION
    WHEN undefined_table OR undefined_function OR invalid_schema_name THEN NULL;
  END;
END $$;
