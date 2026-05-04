-- Keep hatch animation prewarm rows out of claimed progression until the hatch RPC promotes them.

CREATE OR REPLACE FUNCTION public.award_xp_v2_unsafe_base(
  p_event_type TEXT,
  p_xp_amount INTEGER,
  p_event_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE(
  xp_awarded INTEGER,
  xp_before INTEGER,
  xp_after INTEGER,
  should_evolve BOOLEAN,
  next_threshold INTEGER,
  cap_applied BOOLEAN,
  level_before INTEGER,
  level_after INTEGER,
  tier_before TEXT,
  tier_after TEXT,
  earned_level_after INTEGER,
  earned_tier_after TEXT,
  claimed_stage_after INTEGER,
  pending_evolution_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_event_metadata JSONB := COALESCE(p_event_metadata, '{}'::jsonb);
  v_companion_id UUID;
  v_current_stage INTEGER;
  v_last_real_stage INTEGER := 0;
  v_companion_inactive_days INTEGER;
  v_xp_before INTEGER;
  v_xp_after INTEGER;
  v_effective_xp INTEGER := COALESCE(p_xp_amount, 0);
  v_cap_applied BOOLEAN := FALSE;
  v_should_evolve BOOLEAN := FALSE;
  v_next_threshold INTEGER := NULL;
  v_today_xp INTEGER := 0;
  v_repeatable_event BOOLEAN := p_event_type IN ('task_complete', 'habit_complete', 'focus_session');
  v_gate_scope TEXT := NULL;
  v_task_id TEXT;
  v_pep_talk_id TEXT;
  v_days_inactive INTEGER;
  v_task_complete_count INTEGER := 0;
  v_task_undo_count INTEGER := 0;
  v_last_completion_xp INTEGER := NULL;
  v_focus_sessions_today INTEGER := 0;
  v_full_xp_portion INTEGER := 0;
  v_post_cap_xp_portion INTEGER := 0;
  v_level_before INTEGER := 0;
  v_level_after INTEGER := 0;
  v_tier_before TEXT := 'Egg';
  v_tier_after TEXT := 'Egg';
  v_earned_level_after INTEGER := 0;
  v_earned_tier_after TEXT := 'Egg';
  v_claimed_stage_after INTEGER := 0;
  v_pending_evolution_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_event_type IS NULL OR btrim(p_event_type) = '' THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(v_user_id::text),
      hashtext('idempotency:' || p_idempotency_key)
    );

    RETURN QUERY
    SELECT
      xe.xp_earned,
      COALESCE((xe.event_metadata->>'xp_before')::INTEGER, 0),
      COALESCE((xe.event_metadata->>'xp_after')::INTEGER, 0),
      COALESCE((xe.event_metadata->>'should_evolve')::BOOLEAN, FALSE),
      NULLIF(xe.event_metadata->>'next_threshold', '')::INTEGER,
      COALESCE((xe.event_metadata->>'cap_applied')::BOOLEAN, FALSE),
      COALESCE((xe.event_metadata->>'level_before')::INTEGER, 0),
      COALESCE(
        (xe.event_metadata->>'level_after')::INTEGER,
        COALESCE((xe.event_metadata->>'earned_level_after')::INTEGER, 0)
      ),
      NULLIF(xe.event_metadata->>'tier_before', ''),
      COALESCE(
        NULLIF(xe.event_metadata->>'tier_after', ''),
        NULLIF(xe.event_metadata->>'earned_tier_after', '')
      ),
      COALESCE(
        (xe.event_metadata->>'earned_level_after')::INTEGER,
        COALESCE((xe.event_metadata->>'level_after')::INTEGER, 0)
      ),
      COALESCE(
        NULLIF(xe.event_metadata->>'earned_tier_after', ''),
        NULLIF(xe.event_metadata->>'tier_after', '')
      ),
      COALESCE(
        (xe.event_metadata->>'claimed_stage_after')::INTEGER,
        COALESCE((xe.event_metadata->>'level_before')::INTEGER, 0)
      ),
      COALESCE(
        (xe.event_metadata->>'pending_evolution_count')::INTEGER,
        GREATEST(
          COALESCE(
            (xe.event_metadata->>'earned_level_after')::INTEGER,
            COALESCE((xe.event_metadata->>'level_after')::INTEGER, 0)
          ) - COALESCE(
            (xe.event_metadata->>'claimed_stage_after')::INTEGER,
            COALESCE((xe.event_metadata->>'level_before')::INTEGER, 0)
          ),
          0
        )
      )
    FROM public.xp_events xe
    WHERE xe.user_id = v_user_id
      AND xe.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  IF p_event_type IN ('task_complete', 'task_undo') THEN
    v_task_id := NULLIF(v_event_metadata->>'task_id', '');
    IF v_task_id IS NULL THEN
      RAISE EXCEPTION 'task_id is required for %', p_event_type;
    END IF;
    v_gate_scope := 'task_xp:' || v_task_id;
  ELSIF p_event_type = 'pep_talk_listen' THEN
    v_pep_talk_id := NULLIF(v_event_metadata->>'pep_talk_id', '');
    IF v_pep_talk_id IS NULL THEN
      RAISE EXCEPTION 'pep_talk_id is required for pep_talk_listen';
    END IF;
    v_gate_scope := 'pep_talk:' || v_pep_talk_id;
  ELSIF p_event_type IN ('all_habits_complete', 'check_in', 'evening_reflection', 'reflection') THEN
    v_gate_scope := p_event_type || ':' || CURRENT_DATE::text;
  ELSIF p_event_type = 'welcome_back_bonus' THEN
    v_gate_scope := 'welcome_back_bonus:' || CURRENT_DATE::text;
  END IF;

  IF v_gate_scope IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext(v_user_id::text),
      hashtext(v_gate_scope)
    );
  END IF;

  SELECT
    uc.id,
    uc.current_xp,
    uc.current_stage,
    COALESCE(uc.inactive_days, 0)
  INTO
    v_companion_id,
    v_xp_before,
    v_current_stage,
    v_companion_inactive_days
  FROM public.user_companion uc
  WHERE uc.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No companion found for user';
  END IF;

  SELECT public.get_highest_valid_claimed_companion_stage(v_companion_id)
  INTO v_last_real_stage;

  IF p_event_type = 'pep_talk_listen' THEN
    IF EXISTS (
      SELECT 1
      FROM public.xp_events xe
      WHERE xe.user_id = v_user_id
        AND xe.event_type = 'pep_talk_listen'
        AND xe.event_metadata->>'pep_talk_id' = v_pep_talk_id
        AND xe.xp_earned > 0
    ) THEN
      v_effective_xp := 0;
    END IF;
  ELSIF p_event_type = 'all_habits_complete' THEN
    IF EXISTS (
      SELECT 1
      FROM public.xp_events xe
      WHERE xe.user_id = v_user_id
        AND xe.event_type = 'all_habits_complete'
        AND xe.created_at::date = CURRENT_DATE
        AND xe.xp_earned > 0
    ) THEN
      v_effective_xp := 0;
    END IF;
  ELSIF p_event_type = 'check_in' THEN
    IF EXISTS (
      SELECT 1
      FROM public.xp_events xe
      WHERE xe.user_id = v_user_id
        AND xe.event_type = 'check_in'
        AND xe.created_at::date = CURRENT_DATE
        AND xe.xp_earned > 0
    ) THEN
      v_effective_xp := 0;
    END IF;
  ELSIF p_event_type IN ('evening_reflection', 'reflection') THEN
    IF EXISTS (
      SELECT 1
      FROM public.xp_events xe
      WHERE xe.user_id = v_user_id
        AND xe.event_type IN ('evening_reflection', 'reflection')
        AND xe.created_at::date = CURRENT_DATE
        AND xe.xp_earned > 0
    ) THEN
      v_effective_xp := 0;
    END IF;
  ELSIF p_event_type = 'welcome_back_bonus' THEN
    v_days_inactive := v_companion_inactive_days;
    IF v_days_inactive < 2 THEN
      v_effective_xp := 0;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.xp_events xe
      WHERE xe.user_id = v_user_id
        AND xe.event_type = 'welcome_back_bonus'
        AND xe.created_at >= (NOW() - INTERVAL '7 days')
        AND xe.xp_earned > 0
    ) THEN
      v_effective_xp := 0;
    END IF;
  ELSIF p_event_type = 'task_complete' THEN
    SELECT COUNT(*) INTO v_task_complete_count
    FROM public.xp_events xe
    WHERE xe.user_id = v_user_id
      AND xe.event_type = 'task_complete'
      AND xe.event_metadata->>'task_id' = v_task_id
      AND xe.xp_earned > 0;

    SELECT COUNT(*) INTO v_task_undo_count
    FROM public.xp_events xe
    WHERE xe.user_id = v_user_id
      AND xe.event_type = 'task_undo'
      AND xe.event_metadata->>'task_id' = v_task_id
      AND xe.xp_earned < 0;

    IF v_task_complete_count > v_task_undo_count THEN
      v_effective_xp := 0;
    END IF;
  ELSIF p_event_type = 'task_undo' THEN
    SELECT COUNT(*) INTO v_task_complete_count
    FROM public.xp_events xe
    WHERE xe.user_id = v_user_id
      AND xe.event_type = 'task_complete'
      AND xe.event_metadata->>'task_id' = v_task_id
      AND xe.xp_earned > 0;

    SELECT COUNT(*) INTO v_task_undo_count
    FROM public.xp_events xe
    WHERE xe.user_id = v_user_id
      AND xe.event_type = 'task_undo'
      AND xe.event_metadata->>'task_id' = v_task_id
      AND xe.xp_earned < 0;

    IF v_task_complete_count <= v_task_undo_count THEN
      v_effective_xp := 0;
    ELSE
      SELECT xe.xp_earned
      INTO v_last_completion_xp
      FROM public.xp_events xe
      WHERE xe.user_id = v_user_id
        AND xe.event_type = 'task_complete'
        AND xe.event_metadata->>'task_id' = v_task_id
        AND xe.xp_earned > 0
      ORDER BY xe.created_at DESC
      OFFSET v_task_undo_count
      LIMIT 1;

      v_effective_xp := -ABS(COALESCE(v_last_completion_xp, COALESCE(p_xp_amount, 0)));
    END IF;
  END IF;

  IF p_event_type = 'focus_session' AND v_effective_xp > 0 THEN
    SELECT COUNT(*) INTO v_focus_sessions_today
    FROM public.xp_events xe
    WHERE xe.user_id = v_user_id
      AND xe.event_type = 'focus_session'
      AND xe.created_at::date = CURRENT_DATE
      AND xe.xp_earned > 0;

    IF v_focus_sessions_today >= 4 THEN
      v_effective_xp := LEAST(v_effective_xp, 3);
    END IF;
  END IF;

  IF v_repeatable_event AND v_effective_xp > 0 THEN
    SELECT COALESCE(SUM(GREATEST(xe.xp_earned, 0)), 0)
    INTO v_today_xp
    FROM public.xp_events xe
    WHERE xe.user_id = v_user_id
      AND xe.created_at::date = CURRENT_DATE;

    IF v_today_xp >= 220 THEN
      v_effective_xp := GREATEST(0, ROUND(v_effective_xp * 0.2)::INTEGER);
      v_cap_applied := TRUE;
    ELSIF v_today_xp + v_effective_xp > 220 THEN
      v_full_xp_portion := 220 - v_today_xp;
      v_post_cap_xp_portion := v_effective_xp - v_full_xp_portion;
      v_effective_xp := GREATEST(
        0,
        v_full_xp_portion + ROUND(v_post_cap_xp_portion * 0.2)::INTEGER
      );
      v_cap_applied := TRUE;
    END IF;
  END IF;

  v_xp_after := GREATEST(0, v_xp_before + v_effective_xp);
  v_level_before := LEAST(GREATEST(COALESCE(v_current_stage, 0), 0), GREATEST(v_last_real_stage, 0));
  v_claimed_stage_after := v_level_before;
  v_earned_level_after := public.resolve_companion_stage_from_xp(v_xp_after);
  v_level_after := v_earned_level_after;

  SELECT stage_name
  INTO v_tier_before
  FROM public.evolution_thresholds
  WHERE stage = v_level_before;

  SELECT stage_name
  INTO v_tier_after
  FROM public.evolution_thresholds
  WHERE stage = v_level_after;

  v_earned_tier_after := COALESCE(v_tier_after, 'Egg');

  UPDATE public.user_companion
  SET current_xp = v_xp_after
  WHERE id = v_companion_id;

  v_pending_evolution_count := GREATEST(v_earned_level_after - v_claimed_stage_after, 0);
  v_should_evolve := v_pending_evolution_count > 0;
  v_next_threshold := public.get_next_evolution_threshold(v_claimed_stage_after);

  v_event_metadata := v_event_metadata || jsonb_build_object(
    'xp_before', v_xp_before,
    'xp_after', v_xp_after,
    'xp_awarded', v_effective_xp,
    'cap_applied', v_cap_applied,
    'should_evolve', v_should_evolve,
    'next_threshold', v_next_threshold,
    'level_before', v_level_before,
    'level_after', v_level_after,
    'tier_before', COALESCE(v_tier_before, 'Egg'),
    'tier_after', COALESCE(v_tier_after, 'Egg'),
    'earned_level_after', v_earned_level_after,
    'earned_tier_after', v_earned_tier_after,
    'claimed_stage_after', v_claimed_stage_after,
    'pending_evolution_count', v_pending_evolution_count
  );

  INSERT INTO public.xp_events (
    user_id,
    companion_id,
    event_type,
    xp_earned,
    event_metadata,
    idempotency_key
  ) VALUES (
    v_user_id,
    v_companion_id,
    p_event_type,
    v_effective_xp,
    v_event_metadata,
    p_idempotency_key
  );

  RETURN QUERY
  SELECT
    v_effective_xp,
    v_xp_before,
    v_xp_after,
    v_should_evolve,
    v_next_threshold,
    v_cap_applied,
    v_level_before,
    v_level_after,
    COALESCE(v_tier_before, 'Egg'),
    COALESCE(v_tier_after, 'Egg'),
    v_earned_level_after,
    v_earned_tier_after,
    v_claimed_stage_after,
    v_pending_evolution_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.award_xp_v2_unsafe_base(TEXT, INTEGER, JSONB, TEXT)
FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_legacy_restorable_companion_stage(
  p_companion_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_companion public.user_companion%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_last_real_stage INTEGER := 0;
  v_earned_stage INTEGER := 0;
  v_has_positive_stage_history BOOLEAN := FALSE;
  v_has_completed_hatch_tutorial BOOLEAN := FALSE;
  v_is_established_account BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE public.user_companion.id = p_companion_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT public.get_highest_valid_claimed_companion_stage(v_companion.id)
  INTO v_last_real_stage;

  IF v_companion.preset_id IS NULL THEN
    RETURN v_last_real_stage;
  END IF;

  v_earned_stage := public.resolve_companion_stage_from_xp(COALESCE(v_companion.current_xp, 0));
  IF v_earned_stage <= v_last_real_stage OR v_earned_stage <= 0 THEN
    RETURN v_last_real_stage;
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE public.profiles.id = v_companion.user_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.companion_evolutions ce
    LEFT JOIN public.evolution_thresholds et
      ON et.stage = ce.stage
    WHERE ce.companion_id = v_companion.id
      AND ce.stage > 0
      AND et.stage IS NOT NULL
      AND COALESCE(ce.xp_at_evolution, -1) >= et.xp_required
  )
  INTO v_has_positive_stage_history;

  v_has_completed_hatch_tutorial := public.has_completed_companion_hatch_tutorial(
    COALESCE(v_profile.onboarding_data, '{}'::jsonb)
  );
  v_is_established_account :=
    COALESCE(v_profile.onboarding_completed, FALSE)
    OR COALESCE(v_profile.onboarding_step, '') = 'complete'
    OR COALESCE((v_profile.onboarding_data ->> 'walkthrough_completed')::BOOLEAN, FALSE);

  IF NOT (
    v_has_positive_stage_history
    OR COALESCE(v_companion.current_stage, 0) > 0
    OR (
      v_companion.current_image_url IS NOT NULL
      AND btrim(v_companion.current_image_url) <> ''
      AND NOT public.is_stage_zero_companion_image_url(v_companion.current_image_url)
    )
    OR v_has_completed_hatch_tutorial
    OR (v_is_established_account AND v_earned_stage >= 5)
  ) THEN
    RETURN v_last_real_stage;
  END IF;

  RETURN LEAST(GREATEST(v_earned_stage, v_last_real_stage), 100);
END;
$function$;

CREATE OR REPLACE FUNCTION public.hatch_companion_with_preset(
  p_companion_id uuid,
  p_preset_id text,
  p_spirit_animal text,
  p_favorite_color text,
  p_core_element text,
  p_story_tone text,
  p_initial_image_url text,
  p_initial_image_focal_x double precision,
  p_initial_image_focal_y double precision,
  p_current_image_url text,
  p_current_image_focal_x double precision,
  p_current_image_focal_y double precision,
  p_xp_at_evolution integer
)
RETURNS TABLE(
  id uuid,
  preset_id text,
  spirit_animal text,
  favorite_color text,
  core_element text,
  story_tone text,
  current_stage integer,
  current_image_url text,
  current_image_focal_x double precision,
  current_image_focal_y double precision,
  initial_image_url text,
  initial_image_focal_x double precision,
  initial_image_focal_y double precision,
  evolution_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_companion public.user_companion%ROWTYPE;
  v_evolution_id uuid;
  v_locked_preset_id text;
  v_resolved_preset_id text;
  v_stage_one_threshold integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE public.user_companion.id = p_companion_id
    AND public.user_companion.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  IF COALESCE(v_companion.current_stage, 0) <> 0 THEN
    RAISE EXCEPTION 'Only stage 0 companions can hatch';
  END IF;

  v_locked_preset_id := NULLIF(BTRIM(v_companion.preset_id), '');
  v_resolved_preset_id := COALESCE(NULLIF(BTRIM(p_preset_id), ''), v_locked_preset_id);

  IF v_resolved_preset_id IS NULL THEN
    RAISE EXCEPTION 'Choose a companion form before hatching.';
  END IF;

  IF v_locked_preset_id IS NOT NULL AND v_locked_preset_id <> v_resolved_preset_id THEN
    RAISE EXCEPTION 'Companion already has a preset';
  END IF;

  SELECT et.xp_required
  INTO v_stage_one_threshold
  FROM public.evolution_thresholds et
  WHERE et.stage = 1;

  SELECT public.companion_evolutions.id
  INTO v_evolution_id
  FROM public.companion_evolutions
  WHERE public.companion_evolutions.companion_id = p_companion_id
    AND public.companion_evolutions.stage = 1
  ORDER BY public.companion_evolutions.evolved_at DESC
  LIMIT 1;

  IF v_evolution_id IS NULL THEN
    INSERT INTO public.companion_evolutions (
      companion_id,
      stage,
      image_url,
      xp_at_evolution
    )
    VALUES (
      p_companion_id,
      1,
      p_current_image_url,
      GREATEST(COALESCE(p_xp_at_evolution, 0), COALESCE(v_stage_one_threshold, 0))
    )
    RETURNING public.companion_evolutions.id
    INTO v_evolution_id;
  ELSE
    UPDATE public.companion_evolutions
    SET
      image_url = p_current_image_url,
      xp_at_evolution = GREATEST(
        COALESCE(public.companion_evolutions.xp_at_evolution, -1),
        COALESCE(p_xp_at_evolution, 0),
        COALESCE(v_stage_one_threshold, 0)
      ),
      evolved_at = now(),
      generation_metadata =
        COALESCE(public.companion_evolutions.generation_metadata, '{}'::jsonb)
        || jsonb_build_object('hatchPrewarmPromotedAt', now())
    WHERE public.companion_evolutions.id = v_evolution_id;
  END IF;

  RETURN QUERY
  UPDATE public.user_companion
  SET
    preset_id = v_resolved_preset_id,
    spirit_animal = p_spirit_animal,
    favorite_color = p_favorite_color,
    core_element = p_core_element,
    story_tone = p_story_tone,
    current_stage = 1,
    current_image_url = p_current_image_url,
    current_image_focal_x = p_current_image_focal_x,
    current_image_focal_y = p_current_image_focal_y,
    initial_image_url = COALESCE(p_initial_image_url, public.user_companion.initial_image_url),
    initial_image_focal_x = COALESCE(p_initial_image_focal_x, public.user_companion.initial_image_focal_x),
    initial_image_focal_y = COALESCE(p_initial_image_focal_y, public.user_companion.initial_image_focal_y),
    dormant_image_url = NULL,
    dormant_image_focal_x = NULL,
    dormant_image_focal_y = NULL,
    neglected_image_url = NULL,
    neglected_image_focal_x = NULL,
    neglected_image_focal_y = NULL,
    scarred_image_url = NULL,
    updated_at = now()
  WHERE public.user_companion.id = p_companion_id
    AND public.user_companion.user_id = v_user_id
  RETURNING
    public.user_companion.id,
    public.user_companion.preset_id,
    public.user_companion.spirit_animal,
    public.user_companion.favorite_color,
    public.user_companion.core_element,
    public.user_companion.story_tone,
    public.user_companion.current_stage,
    public.user_companion.current_image_url,
    public.user_companion.current_image_focal_x,
    public.user_companion.current_image_focal_y,
    public.user_companion.initial_image_url,
    public.user_companion.initial_image_focal_x,
    public.user_companion.initial_image_focal_y,
    v_evolution_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.hatch_companion_with_preset(
  uuid, text, text, text, text, text, text, double precision, double precision,
  text, double precision, double precision, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hatch_companion_with_preset(
  uuid, text, text, text, text, text, text, double precision, double precision,
  text, double precision, double precision, integer
) TO authenticated;
