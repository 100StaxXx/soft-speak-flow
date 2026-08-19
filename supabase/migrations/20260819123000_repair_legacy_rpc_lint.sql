-- Keep legacy RPCs executable against the current schema. They are retained
-- for compatibility, but must obey the same ownership and XP audit invariants
-- as the modern clients.

CREATE OR REPLACE FUNCTION public.complete_quest_with_xp(
  p_task_id uuid,
  p_user_id uuid,
  p_xp_amount integer
)
RETURNS json
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_companion_id uuid;
  v_new_xp bigint;
  v_current_stage integer;
  v_should_evolve boolean;
  v_next_threshold bigint;
BEGIN
  IF p_task_id IS NULL OR p_user_id IS NULL OR p_xp_amount IS NULL OR p_xp_amount < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid quest completion input');
  END IF;

  IF auth.uid() IS DISTINCT FROM p_user_id
    AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Unauthorized quest completion';
  END IF;

  UPDATE public.daily_tasks AS task
  SET completed = true,
      completed_at = now()
  WHERE task.id = p_task_id
    AND task.user_id = p_user_id
    AND task.completed IS DISTINCT FROM true;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Quest already completed or not found'
    );
  END IF;

  UPDATE public.user_companion AS companion
  SET current_xp = GREATEST(0, companion.current_xp + p_xp_amount)
  WHERE companion.user_id = p_user_id
  RETURNING companion.id, companion.current_xp, companion.current_stage
  INTO v_companion_id, v_new_xp, v_current_stage;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No companion found for user';
  END IF;

  SELECT public.should_evolve(v_current_stage, v_new_xp)
  INTO v_should_evolve;
  SELECT public.get_next_evolution_threshold(v_current_stage)
  INTO v_next_threshold;

  INSERT INTO public.xp_events (
    user_id,
    companion_id,
    xp_earned,
    event_type,
    event_metadata,
    idempotency_key
  ) VALUES (
    p_user_id,
    v_companion_id,
    p_xp_amount,
    'quest_complete',
    jsonb_build_object('task_id', p_task_id),
    'legacy_complete_quest:' || p_task_id::text
  )
  ON CONFLICT (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
  DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'companion_id', v_companion_id,
    'new_xp', v_new_xp,
    'current_stage', v_current_stage,
    'should_evolve', v_should_evolve,
    'next_threshold', v_next_threshold
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_quest_with_xp(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_quest_with_xp(uuid, uuid, integer)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_referral_count(referrer_id uuid)
RETURNS TABLE(referral_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_referral_count integer;
BEGIN
  IF referrer_id IS NULL THEN
    RETURN;
  END IF;

  IF auth.uid() IS NOT NULL
    AND auth.uid() IS DISTINCT FROM referrer_id
    AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
  THEN
    RAISE EXCEPTION 'Unauthorized referral increment';
  END IF;

  UPDATE public.profiles AS profile
  SET referral_count = COALESCE(profile.referral_count, 0) + 1
  WHERE profile.id = referrer_id
  RETURNING profile.referral_count
  INTO v_referral_count;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT v_referral_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_referral_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_referral_count(uuid)
  TO authenticated, service_role;
