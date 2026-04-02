-- Launch preset-based companion catalog with deterministic shared assets.

INSERT INTO storage.buckets (id, name, public)
VALUES ('companion-presets', 'companion-presets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view companion preset assets" ON storage.objects;
CREATE POLICY "Public can view companion preset assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'companion-presets');

DROP POLICY IF EXISTS "Service role can upload companion preset assets" ON storage.objects;
CREATE POLICY "Service role can upload companion preset assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'companion-presets' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can update companion preset assets" ON storage.objects;
CREATE POLICY "Service role can update companion preset assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'companion-presets' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'companion-presets' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can delete companion preset assets" ON storage.objects;
CREATE POLICY "Service role can delete companion preset assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'companion-presets' AND auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.companion_presets (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  carousel_order INTEGER NOT NULL UNIQUE,
  role TEXT NOT NULL,
  signature_identity TEXT NOT NULL,
  anatomy_lock TEXT NOT NULL,
  reveal_copy TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_preset_assets (
  preset_id TEXT NOT NULL REFERENCES public.companion_presets(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('t0_egg', 't1_youth', 't2_guardian', 't3_champion', 't4_mythic', 't5_apex')),
  state TEXT NOT NULL CHECK (state IN ('normal', 'neglected', 'dormant')),
  element TEXT NOT NULL CHECK (element IN ('fire', 'ice', 'storm', 'nature', 'void', 'light')),
  bucket_name TEXT NOT NULL DEFAULT 'companion-presets',
  storage_path TEXT NOT NULL,
  stage_start INTEGER NOT NULL CHECK (stage_start >= 0 AND stage_start <= 14),
  stage_end INTEGER NOT NULL CHECK (stage_end >= stage_start AND stage_end <= 14),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (preset_id, tier, state, element)
);

ALTER TABLE public.companion_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_preset_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view companion presets" ON public.companion_presets;
CREATE POLICY "Anyone can view companion presets"
ON public.companion_presets
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Anyone can view companion preset assets" ON public.companion_preset_assets;
CREATE POLICY "Anyone can view companion preset assets"
ON public.companion_preset_assets
FOR SELECT
USING (true);

DROP TRIGGER IF EXISTS update_companion_presets_updated_at ON public.companion_presets;
CREATE TRIGGER update_companion_presets_updated_at
  BEFORE UPDATE ON public.companion_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companion_preset_assets_updated_at ON public.companion_preset_assets;
CREATE TRIGGER update_companion_preset_assets_updated_at
  BEFORE UPDATE ON public.companion_preset_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.companion_presets (
  id,
  display_name,
  carousel_order,
  role,
  signature_identity,
  anatomy_lock,
  reveal_copy
)
VALUES
  ('dragon', 'Dragon', 1, 'flagship mythic', 'western dragon silhouette, swept horns, luminous chest core, long tail', '4 legs + 2 wings; no feathers', 'Ancient, bold, and born for legendary arcs.'),
  ('wolf', 'Wolf', 2, 'grounded protector', 'thick neck ruff, alert ears, confident forward stance', '4 legs; no wings', 'Loyal, sharp, and steady through every trial.'),
  ('fox', 'Kitsune', 3, 'mystic trickster', 'fox spirit silhouette, oversized ears, luminous cheek markings, and a flowing tail fan', '4 legs; fox silhouette with magical tails', 'Mystical, clever, and lit by fox-fire.'),
  ('owl', 'Owl', 4, 'quiet oracle', 'round facial disk, ear tufts, bright moon-eyes', '2 legs + 2 wings', 'Watchful, wise, and calm under moonlit pressure.'),
  ('lion', 'Lion', 5, 'regal guardian', 'solar mane, broad paws, tufted tail', '4 legs; no wings', 'Majestic, brave, and built to hold the line.'),
  ('phoenix', 'Phoenix', 6, 'rebel mythic', 'flame crest, ember tail streamers, radiant wing edges', '2 legs + 2 wings', 'Fiery, defiant, and impossible to keep down.'),
  ('pegasus', 'Pegasus', 7, 'noble aspirational', 'feathered wings, windswept mane, athletic horse build', '4 legs + 2 wings; no horn', 'Graceful, bright, and always reaching upward.'),
  ('raven', 'Raven', 8, 'shadow scout', 'sleek hooked beak, iridescent neck sheen, intelligent stare', '2 legs + 2 wings', 'Clever, mysterious, and always one step ahead.'),
  ('leviathan', 'Leviathan', 9, 'abyssal legend', 'serpentine body, fin-frill silhouette, luminous gill lines', 'aquatic serpent; no legs', 'Deep, colossal, and pulled from ancient tides.'),
  ('buttercat', 'Buttercat', 10, 'whimsical rare', 'cat face, butterfly wings, soft antennae optional, plush tail', '4 cat legs + 2 butterfly wings; no insect eyes', 'Dreamy, playful, and delightfully strange.')
ON CONFLICT (id) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  carousel_order = EXCLUDED.carousel_order,
  role = EXCLUDED.role,
  signature_identity = EXCLUDED.signature_identity,
  anatomy_lock = EXCLUDED.anatomy_lock,
  reveal_copy = EXCLUDED.reveal_copy,
  updated_at = now();

WITH tiers AS (
  SELECT * FROM (VALUES
    ('t0_egg', 0, 0),
    ('t1_youth', 1, 3),
    ('t2_guardian', 4, 6),
    ('t3_champion', 7, 9),
    ('t4_mythic', 10, 12),
    ('t5_apex', 13, 14)
  ) AS t(tier, stage_start, stage_end)
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
  p.id || '/' || t.tier || '/' || s.state || '/' || p.id || '__' || t.tier || '__' || s.state || '__' || e.element || '.png',
  t.stage_start,
  t.stage_end
FROM public.companion_presets AS p
CROSS JOIN tiers AS t
CROSS JOIN states AS s
CROSS JOIN elements AS e
ON CONFLICT (preset_id, tier, state, element) DO UPDATE
SET
  storage_path = EXCLUDED.storage_path,
  stage_start = EXCLUDED.stage_start,
  stage_end = EXCLUDED.stage_end,
  bucket_name = EXCLUDED.bucket_name,
  updated_at = now();

ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS preset_id TEXT REFERENCES public.companion_presets(id);

CREATE INDEX IF NOT EXISTS idx_user_companion_preset_id
  ON public.user_companion(preset_id);

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

DELETE FROM public.evolution_thresholds
WHERE stage > 14;

INSERT INTO public.evolution_thresholds (stage, xp_required, stage_name) VALUES
  (0, 0, 'Egg'),
  (1, 10, 'Hatchling'),
  (2, 100, 'Youngling'),
  (3, 250, 'Juvenile'),
  (4, 600, 'Scout'),
  (5, 1200, 'Warrior'),
  (6, 2200, 'Guardian'),
  (7, 3800, 'Champion'),
  (8, 6000, 'Ascended'),
  (9, 9000, 'Titan'),
  (10, 13000, 'Mythic'),
  (11, 18000, 'Prime'),
  (12, 24000, 'Transcendent'),
  (13, 31000, 'Apex'),
  (14, 38000, 'Ultimate Form')
ON CONFLICT (stage) DO UPDATE
SET
  xp_required = EXCLUDED.xp_required,
  stage_name = EXCLUDED.stage_name;

UPDATE public.user_companion
SET current_stage = public.resolve_companion_stage_from_xp(current_xp)
WHERE current_stage IS DISTINCT FROM public.resolve_companion_stage_from_xp(current_xp);

UPDATE public.companion_evolution_jobs
SET requested_stage = LEAST(requested_stage, 14)
WHERE requested_stage > 14;

ALTER TABLE public.user_companion
DROP CONSTRAINT IF EXISTS user_companion_current_stage_check;

ALTER TABLE public.user_companion
ADD CONSTRAINT user_companion_current_stage_check
CHECK (current_stage >= 0 AND current_stage <= 14);

ALTER TABLE public.companion_evolution_jobs
DROP CONSTRAINT IF EXISTS companion_evolution_jobs_requested_stage_check;

ALTER TABLE public.companion_evolution_jobs
ADD CONSTRAINT companion_evolution_jobs_requested_stage_check
CHECK (requested_stage >= 0 AND requested_stage <= 14);

ALTER TABLE public.referral_completions
DROP CONSTRAINT IF EXISTS valid_stage_reached;

ALTER TABLE public.referral_completions
ADD CONSTRAINT valid_stage_reached
CHECK (stage_reached >= 3 AND stage_reached <= 14);

DROP FUNCTION IF EXISTS public.create_companion_if_not_exists(uuid, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_companion_if_not_exists(
  p_user_id uuid,
  p_preset_id text,
  p_favorite_color text,
  p_spirit_animal text,
  p_core_element text,
  p_story_tone text,
  p_current_image_url text,
  p_initial_image_url text,
  p_eye_color text,
  p_fur_color text
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  preset_id text,
  favorite_color text,
  spirit_animal text,
  core_element text,
  story_tone text,
  current_stage integer,
  current_xp integer,
  current_image_url text,
  initial_image_url text,
  eye_color text,
  fur_color text,
  mind integer,
  body integer,
  soul integer,
  current_mood text,
  last_mood_update timestamp with time zone,
  last_energy_update timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  is_new boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_companion user_companion%ROWTYPE;
  v_is_new boolean := false;
BEGIN
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create companion for another user';
  END IF;

  SELECT *
  INTO v_companion
  FROM public.user_companion
  WHERE user_companion.user_id = p_user_id
  ORDER BY user_companion.created_at DESC NULLS LAST, user_companion.id DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.user_companion (
      user_id,
      preset_id,
      favorite_color,
      spirit_animal,
      core_element,
      story_tone,
      current_image_url,
      initial_image_url,
      eye_color,
      fur_color
    ) VALUES (
      p_user_id,
      p_preset_id,
      p_favorite_color,
      p_spirit_animal,
      p_core_element,
      p_story_tone,
      p_current_image_url,
      p_initial_image_url,
      p_eye_color,
      p_fur_color
    )
    RETURNING * INTO v_companion;

    v_is_new := true;
  END IF;

  RETURN QUERY SELECT
    v_companion.id,
    v_companion.user_id,
    v_companion.preset_id,
    v_companion.favorite_color,
    v_companion.spirit_animal,
    v_companion.core_element,
    v_companion.story_tone,
    v_companion.current_stage,
    v_companion.current_xp,
    v_companion.current_image_url,
    v_companion.initial_image_url,
    v_companion.eye_color,
    v_companion.fur_color,
    v_companion.mind,
    v_companion.body,
    v_companion.soul,
    v_companion.current_mood,
    v_companion.last_mood_update,
    v_companion.last_energy_update,
    v_companion.created_at,
    v_companion.updated_at,
    v_is_new;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_companion_if_not_exists(uuid, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_companion_if_not_exists(uuid, text, text, text, text, text, text, text, text, text) TO authenticated;

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
    current_stage = LEAST(GREATEST(COALESCE(p_current_stage, 0), 0), 14),
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

REVOKE EXECUTE ON FUNCTION public.apply_companion_preset_selection(uuid, text, text, text, text, text, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_companion_preset_selection(uuid, text, text, text, text, text, integer, text, text) TO authenticated;
