-- Unified Level 0-100 progression rollout.
-- Keeps current_stage as the persisted level column for compatibility.

DELETE FROM public.evolution_thresholds;

INSERT INTO public.evolution_thresholds (stage, xp_required, stage_name) VALUES
  (0, 0, 'Egg'),
  (1, 10, 'Hatchling'),
  (2, 30, 'Hatchling'),
  (3, 60, 'Hatchling'),
  (4, 80, 'Hatchling'),
  (5, 100, 'Initiate'),
  (6, 240, 'Initiate'),
  (7, 380, 'Initiate'),
  (8, 510, 'Initiate'),
  (9, 650, 'Initiate'),
  (10, 790, 'Initiate'),
  (11, 930, 'Initiate'),
  (12, 1060, 'Initiate'),
  (13, 1200, 'Awakened'),
  (14, 1550, 'Awakened'),
  (15, 1900, 'Awakened'),
  (16, 2250, 'Awakened'),
  (17, 2600, 'Awakened'),
  (18, 2950, 'Awakened'),
  (19, 3300, 'Awakened'),
  (20, 3650, 'Awakened'),
  (21, 4000, 'Guardian'),
  (22, 4400, 'Guardian'),
  (23, 4800, 'Guardian'),
  (24, 5200, 'Guardian'),
  (25, 5600, 'Guardian'),
  (26, 6000, 'Guardian'),
  (27, 6400, 'Guardian'),
  (28, 6800, 'Guardian'),
  (29, 7200, 'Guardian'),
  (30, 7600, 'Guardian'),
  (31, 8000, 'Guardian'),
  (32, 8400, 'Guardian'),
  (33, 8800, 'Guardian'),
  (34, 9200, 'Guardian'),
  (35, 9600, 'Guardian'),
  (36, 10000, 'Champion'),
  (37, 10500, 'Champion'),
  (38, 11000, 'Champion'),
  (39, 11500, 'Champion'),
  (40, 12000, 'Champion'),
  (41, 12500, 'Champion'),
  (42, 13000, 'Champion'),
  (43, 13500, 'Champion'),
  (44, 14000, 'Champion'),
  (45, 14500, 'Champion'),
  (46, 15000, 'Champion'),
  (47, 15500, 'Champion'),
  (48, 16000, 'Champion'),
  (49, 16500, 'Champion'),
  (50, 17000, 'Champion'),
  (51, 17500, 'Champion'),
  (52, 18000, 'Champion'),
  (53, 18500, 'Champion'),
  (54, 19000, 'Champion'),
  (55, 19500, 'Champion'),
  (56, 20000, 'Mythic'),
  (57, 20400, 'Mythic'),
  (58, 20800, 'Mythic'),
  (59, 21200, 'Mythic'),
  (60, 21600, 'Mythic'),
  (61, 22000, 'Mythic'),
  (62, 22400, 'Mythic'),
  (63, 22800, 'Mythic'),
  (64, 23200, 'Mythic'),
  (65, 23600, 'Mythic'),
  (66, 24000, 'Mythic'),
  (67, 24400, 'Mythic'),
  (68, 24800, 'Mythic'),
  (69, 25200, 'Mythic'),
  (70, 25600, 'Mythic'),
  (71, 26000, 'Mythic'),
  (72, 26400, 'Mythic'),
  (73, 26800, 'Mythic'),
  (74, 27200, 'Mythic'),
  (75, 27600, 'Mythic'),
  (76, 28000, 'Mythic'),
  (77, 28400, 'Mythic'),
  (78, 28800, 'Mythic'),
  (79, 29200, 'Mythic'),
  (80, 29600, 'Mythic'),
  (81, 30000, 'Ascended'),
  (82, 30420, 'Ascended'),
  (83, 30840, 'Ascended'),
  (84, 31260, 'Ascended'),
  (85, 31680, 'Ascended'),
  (86, 32110, 'Ascended'),
  (87, 32530, 'Ascended'),
  (88, 32950, 'Ascended'),
  (89, 33370, 'Ascended'),
  (90, 33790, 'Ascended'),
  (91, 34210, 'Ascended'),
  (92, 34630, 'Ascended'),
  (93, 35050, 'Ascended'),
  (94, 35470, 'Ascended'),
  (95, 35890, 'Ascended'),
  (96, 36320, 'Ascended'),
  (97, 36740, 'Ascended'),
  (98, 37160, 'Ascended'),
  (99, 37580, 'Ascended'),
  (100, 38000, 'Ascended');

CREATE OR REPLACE FUNCTION public.resolve_companion_stage_from_xp(p_xp BIGINT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(MAX(stage), 0)::INTEGER
  FROM public.evolution_thresholds
  WHERE xp_required <= GREATEST(COALESCE(p_xp, 0), 0)
$$;

CREATE OR REPLACE FUNCTION public.get_next_evolution_threshold(current_stage INTEGER)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT xp_required
  FROM public.evolution_thresholds
  WHERE stage = LEAST(GREATEST(COALESCE(current_stage, 0), 0) + 1, 100)
    AND stage > GREATEST(COALESCE(current_stage, 0), 0)
$$;

CREATE OR REPLACE FUNCTION public.should_evolve(current_stage INTEGER, current_xp BIGINT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.get_next_evolution_threshold(current_stage) IS NULL THEN FALSE
    ELSE GREATEST(COALESCE(current_xp, 0), 0) >= public.get_next_evolution_threshold(current_stage)
  END
$$;

ALTER TABLE public.user_companion
DROP CONSTRAINT IF EXISTS user_companion_current_stage_check;

ALTER TABLE public.user_companion
ADD CONSTRAINT user_companion_current_stage_check
CHECK (current_stage >= 0 AND current_stage <= 100);

ALTER TABLE public.companion_evolution_jobs
DROP CONSTRAINT IF EXISTS companion_evolution_jobs_requested_stage_check;

ALTER TABLE public.companion_evolution_jobs
ADD CONSTRAINT companion_evolution_jobs_requested_stage_check
CHECK (requested_stage >= 0 AND requested_stage <= 100);

ALTER TABLE public.referral_completions
DROP CONSTRAINT IF EXISTS valid_stage_reached;

ALTER TABLE public.referral_completions
ADD CONSTRAINT valid_stage_reached
CHECK (stage_reached >= 3 AND stage_reached <= 100);

ALTER TABLE public.companion_preset_assets
DROP CONSTRAINT IF EXISTS companion_preset_assets_tier_check;

ALTER TABLE public.companion_preset_assets
DROP CONSTRAINT IF EXISTS companion_preset_assets_stage_start_check;

ALTER TABLE public.companion_preset_assets
DROP CONSTRAINT IF EXISTS companion_preset_assets_stage_end_check;

ALTER TABLE public.companion_preset_assets
ADD CONSTRAINT companion_preset_assets_tier_check
CHECK (
  tier IN (
    't0_egg',
    't1_hatchling',
    't2_initiate',
    't3_awakened',
    't4_guardian',
    't5_champion',
    't6_mythic',
    't7_ascended'
  )
);

ALTER TABLE public.companion_preset_assets
ADD CONSTRAINT companion_preset_assets_stage_start_check
CHECK (stage_start >= 0 AND stage_start <= 100);

ALTER TABLE public.companion_preset_assets
ADD CONSTRAINT companion_preset_assets_stage_end_check
CHECK (stage_end >= stage_start AND stage_end <= 100);

DELETE FROM public.companion_preset_assets;

WITH tiers AS (
  SELECT * FROM (VALUES
    ('t0_egg', 't0_egg', 0, 0),
    ('t1_hatchling', 't1_youth', 1, 4),
    ('t2_initiate', 't2_guardian', 5, 12),
    ('t3_awakened', 't2_guardian', 13, 20),
    ('t4_guardian', 't3_champion', 21, 35),
    ('t5_champion', 't4_mythic', 36, 55),
    ('t6_mythic', 't5_apex', 56, 80),
    ('t7_ascended', 't5_apex', 81, 100)
  ) AS t(tier, storage_tier, stage_start, stage_end)
),
states AS (
  SELECT * FROM (VALUES ('normal'), ('neglected'), ('dormant')) AS s(state)
),
elements AS (
  SELECT * FROM (VALUES ('fire'), ('ice'), ('storm'), ('nature'), ('void'), ('light')) AS e(element)
)
INSERT INTO public.companion_preset_assets (
  preset_id,
  tier,
  state,
  element,
  bucket_name,
  storage_path,
  stage_start,
  stage_end
)
SELECT
  p.id,
  t.tier,
  s.state,
  e.element,
  'companion-presets',
  p.id || '/' || t.storage_tier || '/' || s.state || '/' || p.id || '__' || t.storage_tier || '__' || s.state || '__' || e.element || '.png',
  t.stage_start,
  t.stage_end
FROM public.companion_presets AS p
CROSS JOIN tiers AS t
CROSS JOIN states AS s
CROSS JOIN elements AS e;

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  UPDATE public.user_companion
  SET
    preset_id = p_preset_id,
    spirit_animal = p_spirit_animal,
    favorite_color = p_favorite_color,
    core_element = p_core_element,
    story_tone = p_story_tone,
    current_stage = LEAST(GREATEST(COALESCE(p_current_stage, 0), 0), 100),
    current_image_url = p_current_image_url,
    initial_image_url = p_initial_image_url,
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

CREATE OR REPLACE FUNCTION complete_referral_stage3(
  p_referee_id UUID,
  p_referrer_id UUID
) RETURNS JSONB AS $complete_referral$
DECLARE
  v_new_count INTEGER;
  v_skin_id UUID;
  v_skin_unlocked BOOLEAN := false;
BEGIN
  IF p_referee_id IS NULL OR p_referrer_id IS NULL THEN
    RAISE EXCEPTION 'referee_id and referrer_id cannot be NULL';
  END IF;

  IF p_referee_id = p_referrer_id THEN
    RAISE EXCEPTION 'Cannot refer yourself';
  END IF;

  SET LOCAL lock_timeout = '5s';

  PERFORM 1 FROM referral_completions
  WHERE referee_id = p_referee_id
    AND referrer_id = p_referrer_id
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_completed',
      'message', 'This referral has already been counted'
    );
  END IF;

  INSERT INTO referral_completions (referee_id, referrer_id, stage_reached)
  VALUES (p_referee_id, p_referrer_id, 5);

  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = p_referrer_id
  RETURNING referral_count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'Referrer profile not found: %', p_referrer_id;
  END IF;

  IF v_new_count IN (1, 3, 5) THEN
    SELECT id INTO v_skin_id
    FROM companion_skins
    WHERE unlock_type = 'referral'
      AND unlock_requirement = v_new_count
    LIMIT 1;

    IF v_skin_id IS NOT NULL THEN
      INSERT INTO user_companion_skins (user_id, skin_id, acquired_via)
      VALUES (p_referrer_id, v_skin_id, 'referral_milestone_' || v_new_count)
      ON CONFLICT (user_id, skin_id) DO NOTHING;

      v_skin_unlocked := true;
    END IF;
  END IF;

  UPDATE profiles
  SET referred_by = NULL
  WHERE id = p_referee_id;

  INSERT INTO referral_audit_log (
    referrer_id,
    referee_id,
    event_type,
    old_count,
    new_count,
    metadata
  ) VALUES (
    p_referrer_id,
    p_referee_id,
    'level_5_completed',
    v_new_count - 1,
    v_new_count,
    jsonb_build_object(
      'milestone_reached', v_new_count IN (1, 3, 5),
      'skin_unlocked', v_skin_unlocked
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_count', v_new_count,
    'milestone_reached', v_new_count IN (1, 3, 5),
    'skin_unlocked', v_skin_unlocked
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'concurrent_completion',
      'message', 'Another process already completed this referral'
    );
  WHEN OTHERS THEN
    RAISE WARNING 'complete_referral_stage3 failed for referee % referrer %: %',
      p_referee_id, p_referrer_id, SQLERRM;
    RAISE;
END;
$complete_referral$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT);

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
  tier_after TEXT
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
  v_has_preset BOOLEAN := FALSE;
  v_referrer_id UUID := NULL;
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
      COALESCE((xe.event_metadata->>'level_after')::INTEGER, 0),
      NULLIF(xe.event_metadata->>'tier_before', ''),
      NULLIF(xe.event_metadata->>'tier_after', '')
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
    COALESCE(uc.inactive_days, 0),
    uc.preset_id IS NOT NULL
  INTO
    v_companion_id,
    v_xp_before,
    v_current_stage,
    v_companion_inactive_days,
    v_has_preset
  FROM public.user_companion uc
  WHERE uc.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No companion found for user';
  END IF;

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
  v_level_before := GREATEST(COALESCE(v_current_stage, 0), 0);

  IF v_level_before = 0 AND NOT v_has_preset THEN
    v_level_after := 0;
  ELSE
    v_level_after := public.resolve_companion_stage_from_xp(v_xp_after);
  END IF;

  SELECT stage_name
  INTO v_tier_before
  FROM public.evolution_thresholds
  WHERE stage = v_level_before;

  SELECT stage_name
  INTO v_tier_after
  FROM public.evolution_thresholds
  WHERE stage = v_level_after;

  UPDATE public.user_companion
  SET
    current_xp = v_xp_after,
    current_stage = v_level_after
  WHERE id = v_companion_id;

  v_should_evolve := v_level_after > v_level_before AND v_tier_after IS DISTINCT FROM v_tier_before;
  v_next_threshold := public.get_next_evolution_threshold(v_level_after);

  IF v_level_before < 5 AND v_level_after >= 5 THEN
    SELECT referred_by
    INTO v_referrer_id
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_referrer_id IS NOT NULL THEN
      BEGIN
        PERFORM public.complete_referral_stage3(v_user_id, v_referrer_id);
      EXCEPTION
        WHEN OTHERS THEN
          RAISE WARNING 'Referral completion failed during award_xp_v2 for user %: %', v_user_id, SQLERRM;
      END;
    END IF;
  END IF;

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
    'tier_after', COALESCE(v_tier_after, 'Egg')
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
    COALESCE(v_tier_after, 'Egg');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT) TO service_role;

COMMENT ON FUNCTION public.award_xp_v2(TEXT, INTEGER, JSONB, TEXT)
IS 'Atomic XP writer for the unified Level 0-100 progression system.';

DELETE FROM public.companion_evolution_cards;
DELETE FROM public.companion_stories;
DELETE FROM public.companion_postcards;
DELETE FROM public.companion_memories;
DELETE FROM public.companion_evolutions;
DELETE FROM public.companion_evolution_jobs;
DELETE FROM public.xp_events;
DELETE FROM public.achievements
WHERE achievement_type LIKE 'companion_stage_%'
   OR achievement_type LIKE 'companion_level_%';
DELETE FROM public.user_companion;

UPDATE public.profiles
SET onboarding_data = COALESCE(onboarding_data, '{}'::jsonb) || jsonb_build_object('progression_reset_required', TRUE);
