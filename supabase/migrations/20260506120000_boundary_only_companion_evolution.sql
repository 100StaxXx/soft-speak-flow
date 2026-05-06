-- Treat manual companion evolution as a visual-boundary claim only.
-- Earned levels still come from evolution_thresholds, but EVOLVE/HATCH only
-- applies at levels whose tier label changes: 1, 5, 13, 21, 36, 56, and 81.

CREATE OR REPLACE FUNCTION public.is_companion_visual_boundary_stage(
  p_stage INTEGER
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    COALESCE(p_stage, 0) = 0
    OR EXISTS (
      SELECT 1
      FROM public.evolution_thresholds et
      WHERE et.stage = GREATEST(COALESCE(p_stage, 0), 0)
        AND et.stage > 0
        AND NOT EXISTS (
          SELECT 1
          FROM public.evolution_thresholds previous
          WHERE previous.stage < et.stage
            AND previous.stage_name = et.stage_name
        )
    );
$function$;

CREATE OR REPLACE FUNCTION public.get_next_visual_evolution_stage(
  current_stage INTEGER
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT MIN(et.stage)::INTEGER
  FROM public.evolution_thresholds et
  WHERE et.stage > GREATEST(COALESCE(current_stage, 0), 0)
    AND public.is_companion_visual_boundary_stage(et.stage);
$function$;

CREATE OR REPLACE FUNCTION public.get_pending_visual_evolution_count(
  claimed_stage INTEGER,
  earned_level INTEGER
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COUNT(*)::INTEGER
  FROM public.evolution_thresholds et
  WHERE et.stage > GREATEST(COALESCE(claimed_stage, 0), 0)
    AND et.stage <= GREATEST(COALESCE(earned_level, 0), 0)
    AND public.is_companion_visual_boundary_stage(et.stage);
$function$;

CREATE OR REPLACE FUNCTION public.resolve_companion_visual_stage_from_xp(
  p_xp BIGINT
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(MAX(et.stage), 0)::INTEGER
  FROM public.evolution_thresholds et
  WHERE et.xp_required <= GREATEST(COALESCE(p_xp, 0), 0)
    AND public.is_companion_visual_boundary_stage(et.stage);
$function$;

CREATE OR REPLACE FUNCTION public.get_next_evolution_threshold(
  current_stage INTEGER
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT et.xp_required
  FROM public.evolution_thresholds et
  WHERE et.stage = public.get_next_visual_evolution_stage(current_stage);
$function$;

CREATE OR REPLACE FUNCTION public.should_evolve(
  current_stage INTEGER,
  current_xp BIGINT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN public.get_next_evolution_threshold(current_stage) IS NULL THEN FALSE
    ELSE GREATEST(COALESCE(current_xp, 0), 0) >= public.get_next_evolution_threshold(current_stage)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.get_highest_valid_claimed_companion_stage(
  p_companion_id UUID
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(MAX(ce.stage), 0)::INTEGER
  FROM public.companion_evolutions ce
  LEFT JOIN public.evolution_thresholds et
    ON et.stage = ce.stage
  WHERE ce.companion_id = p_companion_id
    AND (
      ce.stage = 0
      OR (
        et.stage IS NOT NULL
        AND COALESCE(ce.xp_at_evolution, -1) >= et.xp_required
      )
    );
$function$;

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

  v_earned_stage := public.resolve_companion_visual_stage_from_xp(COALESCE(v_companion.current_xp, 0));
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

CREATE OR REPLACE FUNCTION public.backfill_legacy_companion_evolution_claims(
  p_companion_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_companion public.user_companion%ROWTYPE;
  v_last_real_stage INTEGER := 0;
  v_restore_stage INTEGER := 0;
  v_stage INTEGER := 0;
  v_stage_threshold INTEGER := 0;
  v_stage_zero_image_url TEXT := NULL;
  v_stage_image_url TEXT := NULL;
  v_restore_image_url TEXT := NULL;
  v_base_evolved_at TIMESTAMPTZ := now();
  v_existing_valid_row BOOLEAN := FALSE;
BEGIN
  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE public.user_companion.id = p_companion_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_stage_zero_image_url := COALESCE(
    v_companion.initial_image_url,
    '/companion-eggs/egg__t0_egg__normal__' || public.normalize_companion_element_slug(v_companion.core_element) || '.png'
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.companion_evolutions ce
    WHERE ce.companion_id = v_companion.id
      AND ce.stage = 0
  ) THEN
    INSERT INTO public.companion_evolutions (
      companion_id,
      stage,
      image_url,
      xp_at_evolution,
      evolved_at
    )
    VALUES (
      v_companion.id,
      0,
      v_stage_zero_image_url,
      0,
      COALESCE(v_companion.created_at, now())
    );
  END IF;

  SELECT public.get_highest_valid_claimed_companion_stage(v_companion.id)
  INTO v_last_real_stage;

  v_restore_stage := public.get_legacy_restorable_companion_stage(v_companion.id);
  IF v_restore_stage <= v_last_real_stage THEN
    RETURN v_last_real_stage;
  END IF;

  v_base_evolved_at := COALESCE(
    (
      SELECT MIN(ce.evolved_at)
      FROM public.companion_evolutions ce
      WHERE ce.companion_id = v_companion.id
    ),
    v_companion.created_at,
    now()
  );

  FOR v_stage, v_stage_threshold IN
    SELECT et.stage, et.xp_required
    FROM public.evolution_thresholds et
    WHERE et.stage > GREATEST(v_last_real_stage, 0)
      AND et.stage <= v_restore_stage
      AND public.is_companion_visual_boundary_stage(et.stage)
    ORDER BY et.stage
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.companion_evolutions ce
      WHERE ce.companion_id = v_companion.id
        AND ce.stage = v_stage
        AND COALESCE(ce.xp_at_evolution, -1) >= v_stage_threshold
    )
    INTO v_existing_valid_row;

    IF v_existing_valid_row THEN
      CONTINUE;
    END IF;

    v_stage_image_url := public.resolve_companion_preset_stage_image_url(
      v_companion.preset_id,
      v_stage,
      v_companion.core_element,
      'normal'
    );

    IF v_stage_image_url IS NULL OR public.is_stage_zero_companion_image_url(v_stage_image_url) THEN
      v_stage_image_url := COALESCE(
        (
          SELECT ce.image_url
          FROM public.companion_evolutions ce
          WHERE ce.companion_id = v_companion.id
            AND ce.stage = v_stage
          ORDER BY ce.evolved_at DESC
          LIMIT 1
        ),
        v_companion.current_image_url,
        v_stage_zero_image_url
      );
    END IF;

    IF public.is_stage_zero_companion_image_url(v_stage_image_url) THEN
      v_stage_image_url := NULL;
    END IF;

    INSERT INTO public.companion_evolutions (
      companion_id,
      stage,
      image_url,
      xp_at_evolution,
      evolved_at
    )
    VALUES (
      v_companion.id,
      v_stage,
      v_stage_image_url,
      v_stage_threshold,
      v_base_evolved_at + make_interval(secs => v_stage)
    )
    ON CONFLICT (companion_id, stage) DO UPDATE
    SET
      image_url = COALESCE(EXCLUDED.image_url, public.companion_evolutions.image_url),
      xp_at_evolution = GREATEST(
        COALESCE(public.companion_evolutions.xp_at_evolution, -1),
        EXCLUDED.xp_at_evolution
      ),
      evolved_at = COALESCE(
        public.companion_evolutions.evolved_at,
        EXCLUDED.evolved_at
      );
  END LOOP;

  v_restore_image_url := COALESCE(
    (
      SELECT ce.image_url
      FROM public.companion_evolutions ce
      LEFT JOIN public.evolution_thresholds et
        ON et.stage = ce.stage
      WHERE ce.companion_id = v_companion.id
        AND ce.stage = v_restore_stage
        AND (
          ce.stage = 0
          OR (
            et.stage IS NOT NULL
            AND COALESCE(ce.xp_at_evolution, -1) >= et.xp_required
          )
        )
      ORDER BY ce.evolved_at DESC
      LIMIT 1
    ),
    public.resolve_companion_preset_stage_image_url(
      v_companion.preset_id,
      v_restore_stage,
      v_companion.core_element,
      'normal'
    ),
    v_companion.current_image_url
  );

  IF public.is_stage_zero_companion_image_url(v_restore_image_url) THEN
    v_restore_image_url := public.resolve_companion_preset_stage_image_url(
      v_companion.preset_id,
      v_restore_stage,
      v_companion.core_element,
      'normal'
    );
  END IF;

  UPDATE public.user_companion
  SET
    current_stage = v_restore_stage,
    current_image_url = COALESCE(v_restore_image_url, public.user_companion.current_image_url),
    current_image_focal_x = CASE
      WHEN COALESCE(v_restore_image_url, public.user_companion.current_image_url)
        IS DISTINCT FROM public.user_companion.current_image_url THEN NULL
      ELSE public.user_companion.current_image_focal_x
    END,
    current_image_focal_y = CASE
      WHEN COALESCE(v_restore_image_url, public.user_companion.current_image_url)
        IS DISTINCT FROM public.user_companion.current_image_url THEN NULL
      ELSE public.user_companion.current_image_focal_y
    END,
    updated_at = now()
  WHERE public.user_companion.id = v_companion.id;

  RETURN v_restore_stage;
END;
$function$;

CREATE OR REPLACE FUNCTION public.normalize_companion_xp_visual_evolution_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_claimed_stage INTEGER := 0;
  v_earned_level INTEGER := 0;
  v_next_visual_stage INTEGER := NULL;
  v_pending_evolution_count INTEGER := 0;
  v_should_evolve BOOLEAN := FALSE;
BEGIN
  IF NEW.event_metadata IS NULL THEN
    RETURN NEW;
  END IF;

  v_claimed_stage := COALESCE(
    NULLIF(NEW.event_metadata->>'claimed_stage_after', '')::INTEGER,
    NULLIF(NEW.event_metadata->>'level_before', '')::INTEGER,
    0
  );
  v_earned_level := COALESCE(
    NULLIF(NEW.event_metadata->>'earned_level_after', '')::INTEGER,
    NULLIF(NEW.event_metadata->>'level_after', '')::INTEGER,
    public.resolve_companion_stage_from_xp(COALESCE(NULLIF(NEW.event_metadata->>'xp_after', '')::BIGINT, 0))
  );
  v_next_visual_stage := public.get_next_visual_evolution_stage(v_claimed_stage);
  v_pending_evolution_count := public.get_pending_visual_evolution_count(v_claimed_stage, v_earned_level);
  v_should_evolve := v_pending_evolution_count > 0;

  NEW.event_metadata := NEW.event_metadata || jsonb_build_object(
    'should_evolve', v_should_evolve,
    'next_threshold', public.get_next_evolution_threshold(v_claimed_stage),
    'next_visual_stage', v_next_visual_stage,
    'pending_evolution_count', v_pending_evolution_count
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS companion_xp_visual_evolution_metadata ON public.xp_events;
CREATE TRIGGER companion_xp_visual_evolution_metadata
BEFORE INSERT OR UPDATE
ON public.xp_events
FOR EACH ROW
EXECUTE FUNCTION public.normalize_companion_xp_visual_evolution_metadata();

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
  v_event_type TEXT := lower(trim(COALESCE(p_event_type, '')));
  v_is_mission_event BOOLEAN := v_event_type IN ('daily_mission_complete', 'mission_complete');
  v_max_positive_xp INTEGER;
  v_effective_xp_amount INTEGER := COALESCE(p_xp_amount, 0);
  v_effective_event_metadata JSONB := COALESCE(p_event_metadata, '{}'::jsonb);
  v_astral_xp_today INTEGER := 0;
  v_astral_cap_applied BOOLEAN := FALSE;
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
      'campaign_create',
      'challenge_complete',
      'check_in',
      'context_match',
      'daily_mission_complete',
      'daily_review',
      'epic_complete',
      'evening_reflection',
      'focus_session',
      'guided_tutorial_hatch_ready_top_up',
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
    WHEN v_event_type = 'campaign_create' THEN 10
    WHEN v_event_type = 'daily_review' THEN 10
    WHEN v_event_type = 'all_subtasks_complete' THEN 10
    WHEN v_event_type = 'quote_shared' THEN 10
    WHEN v_event_type = 'on_time_completion' THEN 10
    WHEN v_event_type = 'guided_tutorial_hatch_ready_top_up' THEN 10
    WHEN v_event_type = 'guided_tutorial_step_complete' THEN 10
    WHEN v_event_type = 'inbox_zero' THEN 10
    WHEN v_event_type = 'pep_talk_listen' THEN 8
    WHEN v_event_type = 'check_in' THEN 8
    WHEN v_event_type = 'evening_reflection' THEN 8
    WHEN v_event_type = 'reflection' THEN 8
    WHEN v_event_type = 'subtask_complete' THEN 5
    WHEN v_event_type = 'voice_capture' THEN 5
    WHEN v_event_type = 'weekly_recap_viewed' THEN 5
    WHEN v_event_type = 'inbox_processed' THEN 5
    WHEN v_event_type = 'context_match' THEN 5
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

  IF v_event_type = 'astral_encounter' AND COALESCE(p_xp_amount, 0) > 0 THEN
    SELECT COALESCE(SUM(GREATEST(xe.xp_earned, 0)), 0)
    INTO v_astral_xp_today
    FROM public.xp_events xe
    WHERE xe.user_id = auth.uid()
      AND xe.event_type = 'astral_encounter'
      AND xe.created_at::date = CURRENT_DATE;

    IF v_astral_xp_today >= 150 THEN
      v_effective_xp_amount := 0;
      v_astral_cap_applied := TRUE;
      v_effective_event_metadata := v_effective_event_metadata || jsonb_build_object(
        'astral_daily_cap_applied', TRUE,
        'astral_daily_cap', 150,
        'astral_xp_today_before_award', v_astral_xp_today
      );
    END IF;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT *
    FROM public.award_xp_v2_unsafe_base(
      v_event_type,
      v_effective_xp_amount,
      v_effective_event_metadata,
      p_idempotency_key
    )
  ),
  visual AS (
    SELECT
      base.*,
      public.get_next_visual_evolution_stage(base.claimed_stage_after) AS next_visual_stage
    FROM base
  )
  SELECT
    visual.xp_awarded,
    visual.xp_before,
    visual.xp_after,
    (
      visual.next_visual_stage IS NOT NULL
      AND visual.earned_level_after >= visual.next_visual_stage
    ) AS should_evolve,
    public.get_next_evolution_threshold(visual.claimed_stage_after) AS next_threshold,
    (visual.cap_applied OR v_astral_cap_applied) AS cap_applied,
    visual.level_before,
    visual.level_after,
    visual.tier_before,
    visual.tier_after,
    visual.earned_level_after,
    visual.earned_tier_after,
    visual.claimed_stage_after,
    public.get_pending_visual_evolution_count(
      visual.claimed_stage_after,
      visual.earned_level_after
    ) AS pending_evolution_count
  FROM visual;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO service_role;

COMMENT ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT)
IS 'Atomic XP writer for the unified progression system; reports manual companion evolution only at visual-boundary levels.';
