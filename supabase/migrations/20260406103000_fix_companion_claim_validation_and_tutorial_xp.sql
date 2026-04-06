CREATE OR REPLACE FUNCTION public.get_highest_valid_claimed_companion_stage(
  p_companion_id UUID
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  WITH RECURSIVE valid_stage_rows AS (
    SELECT DISTINCT ce.stage
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
      )
  ),
  contiguous_stages AS (
    SELECT 0 AS stage
    WHERE EXISTS (
      SELECT 1
      FROM valid_stage_rows
      WHERE valid_stage_rows.stage = 0
    )

    UNION ALL

    SELECT contiguous_stages.stage + 1
    FROM contiguous_stages
    JOIN valid_stage_rows
      ON valid_stage_rows.stage = contiguous_stages.stage + 1
  )
  SELECT COALESCE(MAX(contiguous_stages.stage), 0)::INTEGER
  FROM contiguous_stages;
$function$;

DELETE FROM public.companion_evolutions ce
USING public.evolution_thresholds et
WHERE ce.stage = et.stage
  AND ce.stage > 0
  AND COALESCE(ce.xp_at_evolution, -1) < et.xp_required;

CREATE OR REPLACE FUNCTION public.repair_auto_advanced_companion_state(
  p_companion_id UUID
)
RETURNS TABLE(
  repaired BOOLEAN,
  current_stage INTEGER,
  last_real_stage INTEGER,
  current_image_url TEXT,
  current_image_focal_x DOUBLE PRECISION,
  current_image_focal_y DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_companion public.user_companion%ROWTYPE;
  v_last_real_stage INTEGER := 0;
  v_restored_image_url TEXT := NULL;
  v_restored_image_focal_x DOUBLE PRECISION := NULL;
  v_restored_image_focal_y DOUBLE PRECISION := NULL;
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

  SELECT public.get_highest_valid_claimed_companion_stage(v_companion.id)
  INTO v_last_real_stage;

  IF COALESCE(v_companion.current_stage, 0) <= v_last_real_stage THEN
    RETURN QUERY
    SELECT
      FALSE,
      COALESCE(v_companion.current_stage, 0),
      v_last_real_stage,
      v_companion.current_image_url,
      v_companion.current_image_focal_x,
      v_companion.current_image_focal_y;
    RETURN;
  END IF;

  IF v_last_real_stage = 0 THEN
    v_restored_image_url := COALESCE(
      v_companion.initial_image_url,
      '/companion-eggs/egg__t0_egg__normal__' || lower(COALESCE(v_companion.core_element, 'fire')) || '.png'
    );
    v_restored_image_focal_x := COALESCE(v_companion.initial_image_focal_x, v_companion.current_image_focal_x);
    v_restored_image_focal_y := COALESCE(v_companion.initial_image_focal_y, v_companion.current_image_focal_y);
  ELSE
    SELECT ce.image_url
    INTO v_restored_image_url
    FROM public.companion_evolutions ce
    WHERE ce.companion_id = v_companion.id
      AND ce.stage = v_last_real_stage
      AND (
        ce.stage = 0
        OR COALESCE(ce.xp_at_evolution, -1) >= (
          SELECT et.xp_required
          FROM public.evolution_thresholds et
          WHERE et.stage = ce.stage
        )
      )
    ORDER BY ce.evolved_at DESC
    LIMIT 1;

    v_restored_image_url := COALESCE(v_restored_image_url, v_companion.current_image_url);
    v_restored_image_focal_x := v_companion.current_image_focal_x;
    v_restored_image_focal_y := v_companion.current_image_focal_y;
  END IF;

  UPDATE public.user_companion
  SET
    current_stage = v_last_real_stage,
    current_image_url = v_restored_image_url,
    current_image_focal_x = v_restored_image_focal_x,
    current_image_focal_y = v_restored_image_focal_y,
    updated_at = now()
  WHERE public.user_companion.id = v_companion.id
  RETURNING
    public.user_companion.current_stage,
    public.user_companion.current_image_url,
    public.user_companion.current_image_focal_x,
    public.user_companion.current_image_focal_y
  INTO current_stage, current_image_url, current_image_focal_x, current_image_focal_y;

  repaired := TRUE;
  last_real_stage := v_last_real_stage;

  RETURN NEXT;
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
  v_event_type TEXT := lower(trim(COALESCE(p_event_type, '')));
  v_max_positive_xp INTEGER;
BEGIN
  IF v_event_type = '' THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  IF v_event_type NOT IN (
      'habit_complete',
      'all_habits_complete',
      'challenge_complete',
      'weekly_challenge',
      'pep_talk_listen',
      'check_in',
      'evening_reflection',
      'reflection',
      'streak_milestone',
      'quote_shared',
      'focus_session',
      'guided_tutorial_step_complete',
      'weekly_recap_viewed',
      'all_top_three_complete',
      'high_productivity_day',
      'top_three_complete',
      'urgent_task_complete',
      'daily_review',
      'all_subtasks_complete',
      'on_time_completion',
      'subtask_complete',
      'voice_capture',
      'inbox_processed',
      'context_match',
      'inbox_zero',
      'weekly_review',
      'perfect_day',
      'phase_complete',
      'milestone_complete',
      'postcard_milestone',
      'epic_complete',
      'astral_encounter',
      'task_complete',
      'task_undo',
      'welcome_back_bonus'
    ) THEN
    RAISE EXCEPTION 'Unsupported event_type: %', p_event_type;
  END IF;

  v_max_positive_xp := CASE
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
    WHEN v_event_type = 'check_in' THEN 4
    WHEN v_event_type = 'evening_reflection' THEN 8
    WHEN v_event_type = 'reflection' THEN 8
    WHEN v_event_type = 'subtask_complete' THEN 5
    WHEN v_event_type = 'voice_capture' THEN 5
    WHEN v_event_type = 'weekly_recap_viewed' THEN 5
    WHEN v_event_type = 'guided_tutorial_step_complete' THEN 3
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

  SELECT public.get_highest_valid_claimed_companion_stage(v_companion.id)
  INTO v_last_real_stage;

  v_initial_image_to_store := COALESCE(
    v_companion.initial_image_url,
    p_initial_image_url,
    p_current_image_url,
    v_companion.current_image_url
  );

  v_current_image_to_store := CASE
    WHEN v_last_real_stage <= 0 THEN v_initial_image_to_store
    ELSE COALESCE(p_current_image_url, v_companion.current_image_url, v_initial_image_to_store)
  END;

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
    public.get_highest_valid_claimed_companion_stage(uc.id) AS last_real_stage
  FROM public.user_companion uc
),
latest_claimed_images AS (
  SELECT DISTINCT ON (ce.companion_id, ce.stage)
    ce.companion_id,
    ce.stage,
    ce.image_url
  FROM public.companion_evolutions ce
  LEFT JOIN public.evolution_thresholds et
    ON et.stage = ce.stage
  WHERE ce.stage = 0
    OR (
      et.stage IS NOT NULL
      AND COALESCE(ce.xp_at_evolution, -1) >= et.xp_required
    )
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
