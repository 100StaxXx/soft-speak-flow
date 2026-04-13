CREATE OR REPLACE FUNCTION public.complete_daily_mission_with_xp(
  p_mission_id UUID,
  p_completion_source TEXT DEFAULT 'manual',
  p_progress_current INTEGER DEFAULT NULL
)
RETURNS TABLE(
  status TEXT,
  message TEXT,
  mission_id UUID,
  completed_at TIMESTAMPTZ,
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
  v_mission public.daily_missions%ROWTYPE;
  v_award RECORD;
  v_completed_at TIMESTAMPTZ;
  v_completion_source TEXT := nullif(btrim(COALESCE(p_completion_source, '')), '');
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY
    SELECT
      'failed'::TEXT,
      'Not authenticated'::TEXT,
      p_mission_id,
      NULL::TIMESTAMPTZ,
      0,
      NULL::INTEGER,
      NULL::INTEGER,
      FALSE,
      NULL::INTEGER,
      FALSE,
      NULL::INTEGER,
      NULL::INTEGER,
      NULL::TEXT,
      NULL::TEXT,
      NULL::INTEGER,
      NULL::TEXT,
      NULL::INTEGER,
      0;
    RETURN;
  END IF;

  IF p_mission_id IS NULL THEN
    RETURN QUERY
    SELECT
      'failed'::TEXT,
      'Mission id is required'::TEXT,
      NULL::UUID,
      NULL::TIMESTAMPTZ,
      0,
      NULL::INTEGER,
      NULL::INTEGER,
      FALSE,
      NULL::INTEGER,
      FALSE,
      NULL::INTEGER,
      NULL::INTEGER,
      NULL::TEXT,
      NULL::TEXT,
      NULL::INTEGER,
      NULL::TEXT,
      NULL::INTEGER,
      0;
    RETURN;
  END IF;

  BEGIN
    SELECT *
    INTO v_mission
    FROM public.daily_missions
    WHERE id = p_mission_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY
      SELECT
        'failed'::TEXT,
        'Mission not found'::TEXT,
        p_mission_id,
        NULL::TIMESTAMPTZ,
        0,
        NULL::INTEGER,
        NULL::INTEGER,
        FALSE,
        NULL::INTEGER,
        FALSE,
        NULL::INTEGER,
        NULL::INTEGER,
        NULL::TEXT,
        NULL::TEXT,
        NULL::INTEGER,
        NULL::TEXT,
        NULL::INTEGER,
        0;
      RETURN;
    END IF;

    IF COALESCE(v_mission.completed, FALSE) THEN
      RETURN QUERY
      SELECT
        'already_completed'::TEXT,
        'XP has already been claimed for this mission.'::TEXT,
        v_mission.id,
        v_mission.completed_at,
        0,
        NULL::INTEGER,
        NULL::INTEGER,
        FALSE,
        NULL::INTEGER,
        FALSE,
        NULL::INTEGER,
        NULL::INTEGER,
        NULL::TEXT,
        NULL::TEXT,
        NULL::INTEGER,
        NULL::TEXT,
        NULL::INTEGER,
        0;
      RETURN;
    END IF;

    UPDATE public.daily_missions
    SET
      completed = TRUE,
      completed_at = timezone('utc', now()),
      progress_current = CASE
        WHEN p_progress_current IS NULL THEN progress_current
        WHEN progress_target IS NULL THEN GREATEST(COALESCE(progress_current, 0), p_progress_current)
        ELSE LEAST(GREATEST(COALESCE(progress_current, 0), p_progress_current), progress_target)
      END
    WHERE id = v_mission.id
    RETURNING daily_missions.completed_at
    INTO v_completed_at;

    SELECT *
    INTO v_award
    FROM public.award_xp_v2(
      'mission_complete',
      v_mission.xp_reward,
      jsonb_strip_nulls(
        jsonb_build_object(
          'mission_id', v_mission.id,
          'mission_type', v_mission.mission_type,
          'mission_category', v_mission.category,
          'source', v_completion_source
        )
      ),
      'daily_mission:' || v_mission.id::TEXT
    );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'XP award returned no data';
    END IF;

    RETURN QUERY
    SELECT
      'completed'::TEXT,
      NULL::TEXT,
      v_mission.id,
      v_completed_at,
      COALESCE(v_award.xp_awarded, 0),
      v_award.xp_before,
      v_award.xp_after,
      COALESCE(v_award.should_evolve, FALSE),
      v_award.next_threshold,
      COALESCE(v_award.cap_applied, FALSE),
      v_award.level_before,
      v_award.level_after,
      v_award.tier_before,
      v_award.tier_after,
      v_award.earned_level_after,
      v_award.earned_tier_after,
      v_award.claimed_stage_after,
      COALESCE(v_award.pending_evolution_count, 0);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT
        'failed'::TEXT,
        SQLERRM,
        COALESCE(v_mission.id, p_mission_id),
        NULL::TIMESTAMPTZ,
        0,
        NULL::INTEGER,
        NULL::INTEGER,
        FALSE,
        NULL::INTEGER,
        FALSE,
        NULL::INTEGER,
        NULL::INTEGER,
        NULL::TEXT,
        NULL::TEXT,
        NULL::INTEGER,
        NULL::TEXT,
        NULL::INTEGER,
        0;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_daily_mission_with_xp(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_daily_mission_with_xp(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_daily_mission_with_xp(UUID, TEXT, INTEGER) TO service_role;

COMMENT ON FUNCTION public.complete_daily_mission_with_xp(UUID, TEXT, INTEGER)
IS 'Atomically completes a daily mission and awards mission XP in one transaction-safe RPC.';
