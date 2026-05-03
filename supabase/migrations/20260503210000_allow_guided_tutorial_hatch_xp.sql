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
  SELECT
    base.xp_awarded,
    base.xp_before,
    base.xp_after,
    base.should_evolve,
    base.next_threshold,
    (base.cap_applied OR v_astral_cap_applied) AS cap_applied,
    base.level_before,
    base.level_after,
    base.tier_before,
    base.tier_after,
    base.earned_level_after,
    base.earned_tier_after,
    base.claimed_stage_after,
    base.pending_evolution_count
  FROM public.award_xp_v2_unsafe_base(
    v_event_type,
    v_effective_xp_amount,
    v_effective_event_metadata,
    p_idempotency_key
  ) AS base;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO service_role;

COMMENT ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT)
IS 'Atomic XP writer for the unified progression system with guided tutorial hatch XP and Astral encounter XP caps.';
