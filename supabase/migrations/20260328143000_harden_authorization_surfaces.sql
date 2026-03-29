-- Harden Supabase authorization surfaces identified in the 2026-03-28 audit.

-- ---------------------------------------------------------------------------
-- Referral code RPC: prevent applying codes on behalf of another user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_referral_code_secure(
  p_user_id UUID,
  p_referral_code TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_record RECORD;
  v_referrer_id UUID;
  v_already_referred BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot apply a referral code for another user'
      USING ERRCODE = '42501';
  END IF;

  SELECT rc.id, rc.code, rc.owner_type, rc.owner_user_id, rc.is_active
  INTO v_code_record
  FROM public.referral_codes rc
  WHERE UPPER(rc.code) = UPPER(p_referral_code)
    AND rc.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false AS success, 'Invalid referral code'::TEXT AS message;
    RETURN;
  END IF;

  IF v_code_record.owner_type = 'user' AND v_code_record.owner_user_id = p_user_id THEN
    RETURN QUERY SELECT false AS success, 'Cannot use your own referral code'::TEXT AS message;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = p_user_id
      AND referred_by_code IS NOT NULL
  ) INTO v_already_referred;

  IF v_already_referred THEN
    RETURN QUERY SELECT false AS success, 'You have already used a referral code'::TEXT AS message;
    RETURN;
  END IF;

  v_referrer_id := v_code_record.owner_user_id;

  UPDATE public.profiles
  SET
    referred_by_code = UPPER(p_referral_code),
    referred_by = v_referrer_id
  WHERE id = p_user_id;

  IF v_code_record.owner_type = 'user' AND v_referrer_id IS NOT NULL THEN
    UPDATE public.profiles
    SET referral_count = COALESCE(referral_count, 0) + 1
    WHERE id = v_referrer_id;
  END IF;

  IF v_code_record.owner_type = 'influencer' THEN
    UPDATE public.referral_codes
    SET total_signups = COALESCE(total_signups, 0) + 1
    WHERE id = v_code_record.id;
  END IF;

  RETURN QUERY SELECT true AS success, 'Referral code applied successfully'::TEXT AS message;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_referral_code_secure(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_referral_code_secure(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: freeze premium, referral, payout, streak-freeze, and life-state
-- system fields so they cannot be client-edited.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;

CREATE POLICY "Users can update own profile (restricted)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() = id
  AND auth.uid() IS NOT NULL
  AND referral_count IS NOT DISTINCT FROM (
    SELECT p.referral_count FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND referral_code IS NOT DISTINCT FROM (
    SELECT p.referral_code FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND referred_by IS NOT DISTINCT FROM (
    SELECT p.referred_by FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND referred_by_code IS NOT DISTINCT FROM (
    SELECT p.referred_by_code FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND stripe_customer_id IS NOT DISTINCT FROM (
    SELECT p.stripe_customer_id FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND subscription_status IS NOT DISTINCT FROM (
    SELECT p.subscription_status FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND subscription_started_at IS NOT DISTINCT FROM (
    SELECT p.subscription_started_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND subscription_expires_at IS NOT DISTINCT FROM (
    SELECT p.subscription_expires_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND trial_started_at IS NOT DISTINCT FROM (
    SELECT p.trial_started_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND trial_ends_at IS NOT DISTINCT FROM (
    SELECT p.trial_ends_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND is_premium IS NOT DISTINCT FROM (
    SELECT p.is_premium FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_freezes_available IS NOT DISTINCT FROM (
    SELECT p.streak_freezes_available FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_freezes_reset_at IS NOT DISTINCT FROM (
    SELECT p.streak_freezes_reset_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND last_streak_freeze_used IS NOT DISTINCT FROM (
    SELECT p.last_streak_freeze_used FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND life_status IS NOT DISTINCT FROM (
    SELECT p.life_status FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND life_status_expires_at IS NOT DISTINCT FROM (
    SELECT p.life_status_expires_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND life_status_set_at IS NOT DISTINCT FROM (
    SELECT p.life_status_set_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND current_habit_streak IS NOT DISTINCT FROM (
    SELECT p.current_habit_streak FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND longest_habit_streak IS NOT DISTINCT FROM (
    SELECT p.longest_habit_streak FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND last_encounter_quest_count IS NOT DISTINCT FROM (
    SELECT p.last_encounter_quest_count FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND last_weekly_encounter IS NOT DISTINCT FROM (
    SELECT p.last_weekly_encounter FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND next_encounter_quest_count IS NOT DISTINCT FROM (
    SELECT p.next_encounter_quest_count FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_at_risk IS NOT DISTINCT FROM (
    SELECT p.streak_at_risk FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_at_risk_since IS NOT DISTINCT FROM (
    SELECT p.streak_at_risk_since FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND total_quests_completed IS NOT DISTINCT FROM (
    SELECT p.total_quests_completed FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- user_companion: freeze progression, lifecycle, and generated asset fields.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own companion" ON public.user_companion;

CREATE POLICY "Users can update own companion"
ON public.user_companion
FOR UPDATE
USING (auth.uid() = user_id AND auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() = user_id
  AND auth.uid() IS NOT NULL
  AND id IS NOT DISTINCT FROM (
    SELECT uc.id FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND created_at IS NOT DISTINCT FROM (
    SELECT uc.created_at FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND current_image_url IS NOT DISTINCT FROM (
    SELECT uc.current_image_url FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND dormant_image_url IS NOT DISTINCT FROM (
    SELECT uc.dormant_image_url FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND neglected_image_url IS NOT DISTINCT FROM (
    SELECT uc.neglected_image_url FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND scarred_image_url IS NOT DISTINCT FROM (
    SELECT uc.scarred_image_url FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND initial_image_url IS NOT DISTINCT FROM (
    SELECT uc.initial_image_url FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND current_stage IS NOT DISTINCT FROM (
    SELECT uc.current_stage FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND current_xp IS NOT DISTINCT FROM (
    SELECT uc.current_xp FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND last_activity_date IS NOT DISTINCT FROM (
    SELECT uc.last_activity_date FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND inactive_days IS NOT DISTINCT FROM (
    SELECT uc.inactive_days FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND current_mood IS NOT DISTINCT FROM (
    SELECT uc.current_mood FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND image_regenerations_used IS NOT DISTINCT FROM (
    SELECT uc.image_regenerations_used FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND is_alive IS NOT DISTINCT FROM (
    SELECT uc.is_alive FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND death_date IS NOT DISTINCT FROM (
    SELECT uc.death_date FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND death_cause IS NOT DISTINCT FROM (
    SELECT uc.death_cause FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND dormant_since IS NOT DISTINCT FROM (
    SELECT uc.dormant_since FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND dormancy_count IS NOT DISTINCT FROM (
    SELECT uc.dormancy_count FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND dormancy_recovery_days IS NOT DISTINCT FROM (
    SELECT uc.dormancy_recovery_days FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND evolution_path IS NOT DISTINCT FROM (
    SELECT uc.evolution_path FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND evolution_path_locked IS NOT DISTINCT FROM (
    SELECT uc.evolution_path_locked FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND path_determination_date IS NOT DISTINCT FROM (
    SELECT uc.path_determination_date FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND bond_level IS NOT DISTINCT FROM (
    SELECT uc.bond_level FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND bond_portrait_urls IS NOT DISTINCT FROM (
    SELECT uc.bond_portrait_urls FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND total_interactions IS NOT DISTINCT FROM (
    SELECT uc.total_interactions FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND completion_timestamps IS NOT DISTINCT FROM (
    SELECT uc.completion_timestamps FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND scar_history IS NOT DISTINCT FROM (
    SELECT uc.scar_history FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND scars IS NOT DISTINCT FROM (
    SELECT uc.scars FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND recovery_progress IS NOT DISTINCT FROM (
    SELECT uc.recovery_progress FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND last_7_days_activity IS NOT DISTINCT FROM (
    SELECT uc.last_7_days_activity FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND last_interaction_at IS NOT DISTINCT FROM (
    SELECT uc.last_interaction_at FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND last_maintenance_at IS NOT DISTINCT FROM (
    SELECT uc.last_maintenance_at FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND last_maintenance_summary IS NOT DISTINCT FROM (
    SELECT uc.last_maintenance_summary FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
  AND last_weekly_maintenance_date IS NOT DISTINCT FROM (
    SELECT uc.last_weekly_maintenance_date FROM public.user_companion uc WHERE uc.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Secure activity writer so decay-reset fields are server-controlled.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_companion_active()
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_today DATE := CURRENT_DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_companion
  SET
    last_activity_date = v_today,
    inactive_days = 0,
    current_mood = 'happy'
  WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  RETURN v_today;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_companion_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_companion_active() TO authenticated;

-- ---------------------------------------------------------------------------
-- Secure regeneration writer so the refresh counter is enforced server-side.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_companion_regeneration(
  p_companion_id UUID,
  p_image_url TEXT
)
RETURNS TABLE(
  image_regenerations_used INTEGER,
  current_image_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_companion_id IS NULL THEN
    RAISE EXCEPTION 'companion_id is required';
  END IF;

  IF p_image_url IS NULL OR btrim(p_image_url) = '' THEN
    RAISE EXCEPTION 'image_url is required';
  END IF;

  RETURN QUERY
  UPDATE public.user_companion
  SET
    current_image_url = p_image_url,
    dormant_image_url = NULL,
    neglected_image_url = NULL,
    scarred_image_url = NULL,
    image_regenerations_used = COALESCE(public.user_companion.image_regenerations_used, 0) + 1
  WHERE id = p_companion_id
    AND user_id = v_user_id
    AND COALESCE(public.user_companion.image_regenerations_used, 0) < 2
  RETURNING
    public.user_companion.image_regenerations_used,
    public.user_companion.current_image_url;

  IF FOUND THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_companion
    WHERE id = p_companion_id
      AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  RAISE EXCEPTION 'No look refreshes remaining';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_companion_regeneration(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_companion_regeneration(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- System-generated tables: clients can read their own data, but writes must go
-- through trusted backend paths.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own evening reflections" ON public.evening_reflections;

DROP POLICY IF EXISTS "Users can insert own weekly recaps" ON public.weekly_recaps;
DROP POLICY IF EXISTS "Users can update own weekly recaps" ON public.weekly_recaps;

CREATE OR REPLACE FUNCTION public.mark_weekly_recap_viewed(
  p_recap_id UUID
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_viewed_at TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.weekly_recaps
  SET viewed_at = COALESCE(viewed_at, now())
  WHERE id = p_recap_id
    AND user_id = v_user_id
  RETURNING viewed_at INTO v_viewed_at;

  IF v_viewed_at IS NULL THEN
    RAISE EXCEPTION 'Weekly recap not found';
  END IF;

  RETURN v_viewed_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_weekly_recap_viewed(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_weekly_recap_viewed(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own journey paths" ON public.epic_journey_paths;
DROP POLICY IF EXISTS "Users can update their own journey paths" ON public.epic_journey_paths;

-- ---------------------------------------------------------------------------
-- XP RPC: wrap the existing implementation with event-type and XP-bound guards.
-- This reduces arbitrary client-side XP minting while preserving current app
-- behavior. A future follow-up should move more event validation server-side.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'award_xp_v2'
      AND oidvectortypes(p.proargtypes) = 'text, integer, jsonb, text'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'award_xp_v2_unsafe_base'
      AND oidvectortypes(p.proargtypes) = 'text, integer, jsonb, text'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) RENAME TO award_xp_v2_unsafe_base';
  END IF;
END
$$;

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
  cap_applied BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_type TEXT := COALESCE(btrim(p_event_type), '');
  v_is_mission_event BOOLEAN := v_event_type LIKE 'mission_%';
  v_max_positive_xp INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_event_type = '' THEN
    RAISE EXCEPTION 'event_type is required';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  IF NOT (
    v_is_mission_event
    OR v_event_type = ANY (ARRAY[
      'all_habits_complete',
      'all_subtasks_complete',
      'all_top_three_complete',
      'astral_encounter',
      'challenge_complete',
      'check_in',
      'context_match',
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
    p_event_type,
    p_xp_amount,
    COALESCE(p_event_metadata, '{}'::jsonb),
    p_idempotency_key
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'award_xp_v2_unsafe_base'
      AND oidvectortypes(p.proargtypes) = 'text, integer, jsonb, text'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.award_xp_v2_unsafe_base(TEXT, INTEGER, JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- Quest attachments: enforce ownership plus server-side type and size checks.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_quest_attachment_object()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_extension TEXT := lower(COALESCE(substring(NEW.name from '\.[^.]+$'), ''));
  v_mime_type TEXT := lower(COALESCE(NEW.metadata->>'mimetype', ''));
  v_size_bytes BIGINT := COALESCE(NULLIF(NEW.metadata->>'size', '')::BIGINT, 0);
  v_allowed_extensions CONSTANT TEXT[] := ARRAY[
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.pdf',
    '.doc',
    '.docx',
    '.txt',
    '.csv'
  ];
  v_allowed_mime_types CONSTANT TEXT[] := ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ];
BEGIN
  IF NEW.bucket_id <> 'quest-attachments' THEN
    RETURN NEW;
  END IF;

  IF v_extension = '' THEN
    RAISE EXCEPTION 'Quest attachments must include a file extension';
  END IF;

  IF NOT (v_extension = ANY (v_allowed_extensions)) THEN
    RAISE EXCEPTION 'Unsupported quest attachment file extension: %', v_extension;
  END IF;

  IF v_mime_type <> ''
    AND v_mime_type !~ '^image/'
    AND NOT (v_mime_type = ANY (v_allowed_mime_types)) THEN
    RAISE EXCEPTION 'Unsupported quest attachment MIME type: %', v_mime_type;
  END IF;

  IF v_size_bytes > 10 * 1024 * 1024 THEN
    RAISE EXCEPTION 'Quest attachments must be 10 MB or smaller';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_quest_attachment_object ON storage.objects;
CREATE TRIGGER validate_quest_attachment_object
  BEFORE INSERT OR UPDATE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_quest_attachment_object();

-- ---------------------------------------------------------------------------
-- Storage buckets: uploads should be limited to trusted server paths.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can upload journey path images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage journey path images" ON storage.objects;

CREATE POLICY "Service role can manage journey path images"
ON storage.objects
FOR ALL
USING (bucket_id = 'journey-paths' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'journey-paths' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can upload mentor audio" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage mentor audio" ON storage.objects;

CREATE POLICY "Service role can manage mentor audio"
ON storage.objects
FOR ALL
USING (bucket_id = 'mentor-audio' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'mentor-audio' AND auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- Orphaned client-visible tables/views: enable or tighten access if present.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.achievements') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own achievements" ON public.achievements';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own achievements" ON public.achievements';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own achievements" ON public.achievements';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own achievements" ON public.achievements';
    EXECUTE 'CREATE POLICY "Users can view own achievements" ON public.achievements FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own achievements" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own achievements" ON public.achievements FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own achievements" ON public.achievements FOR DELETE USING (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.user_reflections') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.user_reflections ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own reflections" ON public.user_reflections';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own reflections" ON public.user_reflections';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own reflections" ON public.user_reflections';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own reflections" ON public.user_reflections';
    EXECUTE 'CREATE POLICY "Users can view own reflections" ON public.user_reflections FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can insert own reflections" ON public.user_reflections FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can update own reflections" ON public.user_reflections FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users can delete own reflections" ON public.user_reflections FOR DELETE USING (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.challenge_tasks') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.challenge_tasks ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view challenge tasks" ON public.challenge_tasks';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can insert challenge tasks" ON public.challenge_tasks';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can update challenge tasks" ON public.challenge_tasks';
    EXECUTE 'DROP POLICY IF EXISTS "Admins can delete challenge tasks" ON public.challenge_tasks';
    EXECUTE 'CREATE POLICY "Anyone can view challenge tasks" ON public.challenge_tasks FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Admins can insert challenge tasks" ON public.challenge_tasks FOR INSERT WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
    EXECUTE 'CREATE POLICY "Admins can update challenge tasks" ON public.challenge_tasks FOR UPDATE USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))';
    EXECUTE 'CREATE POLICY "Admins can delete challenge tasks" ON public.challenge_tasks FOR DELETE USING (public.has_role(auth.uid(), ''admin''::public.app_role))';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'user_achievement_stats'
  ) THEN
    EXECUTE 'ALTER VIEW public.user_achievement_stats SET (security_invoker = true)';
  END IF;
END
$$;
