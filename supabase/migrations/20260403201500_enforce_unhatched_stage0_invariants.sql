DROP FUNCTION IF EXISTS public.award_xp_v2_unsafe_base(TEXT, INTEGER, JSONB, TEXT);
DROP FUNCTION IF EXISTS public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT);

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

  SELECT COALESCE(MAX(ce.stage), 0)
  INTO v_last_real_stage
  FROM public.companion_evolutions ce
  WHERE ce.companion_id = v_companion_id;

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

CREATE OR REPLACE FUNCTION public.award_xp_v2(
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
  v_event_type TEXT := lower(coalesce(trim(p_event_type), ''));
  v_is_mission_event BOOLEAN := v_event_type IN ('daily_mission_complete', 'mission_complete');
  v_max_positive_xp INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_event_type = '' THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  IF NOT (
    v_event_type = ANY (ARRAY[
      'all_habits_complete',
      'all_subtasks_complete',
      'all_top_three_complete',
      'astral_encounter',
      'challenge_complete',
      'check_in',
      'context_match',
      'daily_mission_complete',
      'daily_review',
      'epic_complete',
      'evening_reflection',
      'focus_session',
      'guided_tutorial_step_complete',
      'habit_complete',
      'high_productivity_day',
      'inbox_processed',
      'inbox_zero',
      'milestone_complete',
      'mission_complete',
      'on_time_completion',
      'pep_talk_listen',
      'perfect_day',
      'phase_complete',
      'postcard_milestone',
      'quote_shared',
      'reflection',
      'streak_milestone',
      'subtask_complete',
      'task_complete',
      'task_undo',
      'top_three_complete',
      'urgent_task_complete',
      'voice_capture',
      'weekly_challenge',
      'weekly_recap_viewed',
      'weekly_review',
      'welcome_back_bonus'
    ])
  ) THEN
    RAISE EXCEPTION 'Unsupported event_type: %', v_event_type;
  END IF;

  v_max_positive_xp := CASE
    WHEN v_is_mission_event THEN 60
    WHEN v_event_type = 'astral_encounter' THEN 150
    WHEN v_event_type = 'epic_complete' THEN 150
    WHEN v_event_type = 'weekly_challenge' THEN 60
    WHEN v_event_type = 'phase_complete' THEN 45
    WHEN v_event_type = 'postcard_milestone' THEN 35
    WHEN v_event_type = 'milestone_complete' THEN 20
    WHEN v_event_type = 'perfect_day' THEN 35
    WHEN v_event_type = 'weekly_review' THEN 25
    WHEN v_event_type = 'welcome_back_bonus' THEN 25
    WHEN v_event_type = 'challenge_complete' THEN 25
    WHEN v_event_type = 'habit_complete' THEN 50
    WHEN v_event_type = 'task_complete' THEN 50
    WHEN v_event_type = 'task_undo' THEN 50
    WHEN v_event_type = 'focus_session' THEN 25
    WHEN v_event_type = 'all_top_three_complete' THEN 30
    WHEN v_event_type = 'all_habits_complete' THEN 20
    WHEN v_event_type = 'high_productivity_day' THEN 20
    WHEN v_event_type = 'streak_milestone' THEN 20
    WHEN v_event_type = 'top_three_complete' THEN 15
    WHEN v_event_type = 'urgent_task_complete' THEN 15
    WHEN v_event_type = 'daily_review' THEN 10
    WHEN v_event_type = 'all_subtasks_complete' THEN 10
    WHEN v_event_type = 'quote_shared' THEN 10
    WHEN v_event_type = 'on_time_completion' THEN 10
    WHEN v_event_type = 'pep_talk_listen' THEN 8
    WHEN v_event_type = 'check_in' THEN 8
    WHEN v_event_type = 'evening_reflection' THEN 8
    WHEN v_event_type = 'reflection' THEN 8
    WHEN v_event_type = 'subtask_complete' THEN 5
    WHEN v_event_type = 'voice_capture' THEN 5
    WHEN v_event_type = 'weekly_recap_viewed' THEN 5
    WHEN v_event_type = 'guided_tutorial_step_complete' THEN 5
    WHEN v_event_type = 'inbox_processed' THEN 5
    WHEN v_event_type = 'context_match' THEN 5
    WHEN v_event_type = 'inbox_zero' THEN 10
    ELSE 0
  END;

  IF v_event_type = 'task_undo' THEN
    IF COALESCE(p_xp_amount, 0) >= 0 OR ABS(COALESCE(p_xp_amount, 0)) > v_max_positive_xp THEN
      RAISE EXCEPTION 'Invalid XP amount for task_undo';
    END IF;
  ELSIF COALESCE(p_xp_amount, 0) < 0 THEN
    RAISE EXCEPTION 'Negative XP is only allowed for task_undo';
  ELSIF COALESCE(p_xp_amount, 0) > v_max_positive_xp THEN
    RAISE EXCEPTION 'XP amount exceeds allowed maximum for %', v_event_type;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.award_xp_v2_unsafe_base(
    v_event_type,
    p_xp_amount,
    COALESCE(p_event_metadata, '{}'::jsonb),
    p_idempotency_key
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.award_xp_v2_unsafe_base(TEXT, INTEGER, JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO service_role;

COMMENT ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT)
IS 'Atomic XP writer for the unified progression system. XP advances earned progress only; companion stages remain manual claims.';

CREATE OR REPLACE FUNCTION public.apply_companion_preset_selection(
  p_companion_id uuid,
  p_preset_id text,
  p_spirit_animal text,
  p_favorite_color text,
  p_core_element text,
  p_story_tone text,
  p_current_stage integer,
  p_current_image_url text,
  p_initial_image_url text
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
  initial_image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_companion public.user_companion%ROWTYPE;
  v_last_real_stage integer := 0;
  v_initial_image_to_store text;
  v_current_image_to_store text;
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

  SELECT COALESCE(MAX(ce.stage), 0)
  INTO v_last_real_stage
  FROM public.companion_evolutions ce
  WHERE ce.companion_id = v_companion.id;

  v_initial_image_to_store := COALESCE(
    v_companion.initial_image_url,
    p_initial_image_url,
    '/companion-eggs/egg__t0_egg__normal__' || lower(COALESCE(p_core_element, v_companion.core_element, 'fire')) || '.png'
  );

  IF v_last_real_stage <= 0 THEN
    v_current_image_to_store := v_initial_image_to_store;
  ELSE
    v_current_image_to_store := COALESCE(
      p_current_image_url,
      v_companion.current_image_url,
      v_initial_image_to_store
    );
  END IF;

  RETURN QUERY
  UPDATE public.user_companion
  SET
    preset_id = p_preset_id,
    spirit_animal = p_spirit_animal,
    favorite_color = p_favorite_color,
    core_element = p_core_element,
    story_tone = p_story_tone,
    current_stage = LEAST(GREATEST(v_last_real_stage, 0), 100),
    current_image_url = v_current_image_to_store,
    initial_image_url = v_initial_image_to_store,
    dormant_image_url = NULL,
    neglected_image_url = NULL,
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
    public.user_companion.initial_image_url;

  IF FOUND THEN
    RETURN;
  END IF;

  RAISE EXCEPTION 'Companion not found';
END;
$function$;

WITH claimed_stages AS (
  SELECT
    uc.id,
    COALESCE(MAX(ce.stage), 0) AS last_real_stage
  FROM public.user_companion uc
  LEFT JOIN public.companion_evolutions ce
    ON ce.companion_id = uc.id
  GROUP BY uc.id
),
latest_claimed_images AS (
  SELECT DISTINCT ON (ce.companion_id)
    ce.companion_id,
    ce.stage,
    ce.image_url
  FROM public.companion_evolutions ce
  ORDER BY ce.companion_id, ce.stage DESC, ce.evolved_at DESC
)
UPDATE public.user_companion uc
SET
  current_stage = claimed_stages.last_real_stage,
  current_image_url = CASE
    WHEN claimed_stages.last_real_stage <= 0 THEN
      COALESCE(
        uc.initial_image_url,
        '/companion-eggs/egg__t0_egg__normal__' || lower(COALESCE(uc.core_element, 'fire')) || '.png'
      )
    ELSE COALESCE(latest_claimed_images.image_url, uc.current_image_url)
  END,
  current_image_focal_x = CASE
    WHEN claimed_stages.last_real_stage <= 0 THEN COALESCE(uc.initial_image_focal_x, uc.current_image_focal_x)
    ELSE uc.current_image_focal_x
  END,
  current_image_focal_y = CASE
    WHEN claimed_stages.last_real_stage <= 0 THEN COALESCE(uc.initial_image_focal_y, uc.current_image_focal_y)
    ELSE uc.current_image_focal_y
  END,
  updated_at = now()
FROM claimed_stages
LEFT JOIN latest_claimed_images
  ON latest_claimed_images.companion_id = claimed_stages.id
  AND latest_claimed_images.stage = claimed_stages.last_real_stage
WHERE uc.id = claimed_stages.id
  AND (
    COALESCE(uc.current_stage, 0) > claimed_stages.last_real_stage
    OR (
      claimed_stages.last_real_stage <= 0
      AND uc.current_image_url IS DISTINCT FROM COALESCE(
        uc.initial_image_url,
        '/companion-eggs/egg__t0_egg__normal__' || lower(COALESCE(uc.core_element, 'fire')) || '.png'
      )
    )
  );
