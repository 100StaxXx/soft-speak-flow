CREATE OR REPLACE FUNCTION public.normalize_companion_element_slug(
  p_element TEXT
)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE lower(trim(COALESCE(p_element, 'fire')))
    WHEN 'fire' THEN 'fire'
    WHEN 'water' THEN 'ice'
    WHEN 'ice' THEN 'ice'
    WHEN 'frost' THEN 'ice'
    WHEN 'lightning' THEN 'storm'
    WHEN 'storm' THEN 'storm'
    WHEN 'air' THEN 'storm'
    WHEN 'earth' THEN 'nature'
    WHEN 'nature' THEN 'nature'
    WHEN 'shadow' THEN 'void'
    WHEN 'dark' THEN 'void'
    WHEN 'void' THEN 'void'
    WHEN 'cosmic' THEN 'void'
    WHEN 'light' THEN 'light'
    ELSE 'fire'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.normalize_companion_preset_slug(
  p_preset_id TEXT
)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE lower(trim(COALESCE(p_preset_id, '')))
    WHEN 'kitsune' THEN 'fox'
    ELSE lower(trim(COALESCE(p_preset_id, '')))
  END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_supabase_project_url()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_project_url TEXT := NULL;
BEGIN
  BEGIN
    SELECT decrypted_secret
    INTO v_project_url
    FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_URL', 'supabase_url')
    ORDER BY created_at DESC
    LIMIT 1;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      v_project_url := NULL;
  END;

  RETURN COALESCE(
    v_project_url,
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    NULLIF(current_setting('supabase_url', true), '')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_stage_zero_companion_image_url(
  p_image_url TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT CASE
    WHEN p_image_url IS NULL OR btrim(p_image_url) = '' THEN FALSE
    ELSE (
      p_image_url ILIKE '%/companion-eggs/%'
      OR p_image_url ILIKE '%companion-eggs/%'
      OR p_image_url ILIKE '%/t0_egg/%'
      OR p_image_url ILIKE '%t0_egg/%'
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.has_completed_companion_hatch_tutorial(
  p_onboarding_data JSONB
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE(p_onboarding_data #> '{guided_tutorial,completedSteps}', '[]'::jsonb)
      ) AS completed(step_id)
      WHERE completed.step_id IN (
        'evolve_companion',
        'post_evolution_companion_intro',
        'mentor_closeout'
      )
    )
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(
        COALESCE(p_onboarding_data #> '{guided_tutorial,milestonesCompleted}', '[]'::jsonb)
      ) AS milestones(step_id)
      WHERE milestones.step_id IN (
        'complete_companion_evolution',
        'post_evolution_companion_intro'
      )
    );
$function$;

CREATE OR REPLACE FUNCTION public.resolve_companion_preset_stage_image_url(
  p_preset_id TEXT,
  p_stage INTEGER,
  p_element TEXT,
  p_state TEXT DEFAULT 'normal'
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_stage INTEGER := LEAST(GREATEST(COALESCE(p_stage, 0), 0), 100);
  v_preset_id TEXT := public.normalize_companion_preset_slug(p_preset_id);
  v_element TEXT := public.normalize_companion_element_slug(p_element);
  v_state TEXT := lower(trim(COALESCE(p_state, 'normal')));
  v_bucket_name TEXT := NULL;
  v_storage_path TEXT := NULL;
  v_project_url TEXT := NULL;
  v_has_bundled_youth BOOLEAN := FALSE;
BEGIN
  IF v_preset_id = '' THEN
    RETURN NULL;
  END IF;

  SELECT
    cpa.bucket_name,
    cpa.storage_path
  INTO
    v_bucket_name,
    v_storage_path
  FROM public.companion_preset_assets cpa
  WHERE cpa.preset_id = v_preset_id
    AND cpa.state = v_state
    AND cpa.element = v_element
    AND v_stage BETWEEN cpa.stage_start AND cpa.stage_end
  ORDER BY cpa.stage_start DESC, cpa.stage_end ASC
  LIMIT 1;

  IF v_storage_path IS NULL THEN
    RETURN NULL;
  END IF;

  v_has_bundled_youth := v_preset_id IN (
    'dragon',
    'wolf',
    'fox',
    'owl',
    'lion',
    'phoenix',
    'pegasus',
    'griffin',
    'sphinx',
    'leviathan',
    'mechanicaldragon',
    'tanuki',
    'buttercat'
  );

  IF v_state = 'normal' AND v_stage BETWEEN 1 AND 4 AND v_has_bundled_youth THEN
    RETURN '/' || COALESCE(v_bucket_name, 'companion-presets') || '/' || v_storage_path;
  END IF;

  v_project_url := public.resolve_supabase_project_url();
  IF v_project_url IS NULL THEN
    RETURN '/' || COALESCE(v_bucket_name, 'companion-presets') || '/' || v_storage_path;
  END IF;

  RETURN v_project_url || '/storage/v1/object/public/' || COALESCE(v_bucket_name, 'companion-presets') || '/' || v_storage_path;
END;
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
    WHERE ce.companion_id = v_companion.id
      AND ce.stage > 0
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

  FOR v_stage IN GREATEST(v_last_real_stage + 1, 1)..v_restore_stage LOOP
    SELECT et.xp_required
    INTO v_stage_threshold
    FROM public.evolution_thresholds et
    WHERE et.stage = v_stage;

    IF v_stage_threshold IS NULL THEN
      CONTINUE;
    END IF;

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
  v_original_companion public.user_companion%ROWTYPE;
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
  INTO v_original_companion
  FROM public.user_companion
  WHERE public.user_companion.id = p_companion_id
    AND public.user_companion.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  PERFORM public.backfill_legacy_companion_evolution_claims(v_original_companion.id);

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE public.user_companion.id = p_companion_id
    AND public.user_companion.user_id = v_user_id
  FOR UPDATE;

  SELECT public.get_highest_valid_claimed_companion_stage(v_companion.id)
  INTO v_last_real_stage;

  IF COALESCE(v_companion.current_stage, 0) <= v_last_real_stage THEN
    RETURN QUERY
    SELECT
      (
        COALESCE(v_companion.current_stage, 0) IS DISTINCT FROM COALESCE(v_original_companion.current_stage, 0)
        OR v_companion.current_image_url IS DISTINCT FROM v_original_companion.current_image_url
        OR v_companion.current_image_focal_x IS DISTINCT FROM v_original_companion.current_image_focal_x
        OR v_companion.current_image_focal_y IS DISTINCT FROM v_original_companion.current_image_focal_y
      ),
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
      '/companion-eggs/egg__t0_egg__normal__' || public.normalize_companion_element_slug(v_companion.core_element) || '.png'
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

    v_restored_image_url := COALESCE(
      v_restored_image_url,
      public.resolve_companion_preset_stage_image_url(
        v_companion.preset_id,
        v_last_real_stage,
        v_companion.core_element,
        'normal'
      ),
      v_companion.current_image_url
    );
    v_restored_image_focal_x := CASE
      WHEN v_restored_image_url IS DISTINCT FROM v_companion.current_image_url THEN NULL
      ELSE v_companion.current_image_focal_x
    END;
    v_restored_image_focal_y := CASE
      WHEN v_restored_image_url IS DISTINCT FROM v_companion.current_image_url THEN NULL
      ELSE v_companion.current_image_focal_y
    END;
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

REVOKE EXECUTE ON FUNCTION public.repair_auto_advanced_companion_state(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.repair_auto_advanced_companion_state(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_auto_advanced_companion_state(UUID) TO service_role;

DO $function$
DECLARE
  v_companion RECORD;
BEGIN
  FOR v_companion IN
    SELECT uc.id
    FROM public.user_companion uc
    WHERE uc.preset_id IS NOT NULL
      AND COALESCE(uc.current_xp, 0) > 0
  LOOP
    PERFORM public.backfill_legacy_companion_evolution_claims(v_companion.id);
  END LOOP;
END;
$function$;
