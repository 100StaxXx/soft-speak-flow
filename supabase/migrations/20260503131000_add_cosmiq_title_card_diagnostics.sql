ALTER TABLE public.companion_cosmiq_title_cards
ADD COLUMN IF NOT EXISTS failure_code TEXT,
ADD COLUMN IF NOT EXISTS failure_message TEXT,
ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

ALTER TABLE public.companion_cosmiq_title_cards
DROP CONSTRAINT IF EXISTS companion_cosmiq_title_cards_failure_code_not_blank;

ALTER TABLE public.companion_cosmiq_title_cards
ADD CONSTRAINT companion_cosmiq_title_cards_failure_code_not_blank
CHECK (failure_code IS NULL OR btrim(failure_code) <> '');

ALTER TABLE public.companion_cosmiq_title_cards
DROP CONSTRAINT IF EXISTS companion_cosmiq_title_cards_failure_message_not_blank;

ALTER TABLE public.companion_cosmiq_title_cards
ADD CONSTRAINT companion_cosmiq_title_cards_failure_message_not_blank
CHECK (failure_message IS NULL OR btrim(failure_message) <> '');

DROP FUNCTION IF EXISTS public.complete_cosmiq_title_card_generation(TEXT, TEXT, TEXT, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.complete_cosmiq_title_card_generation(
  p_profile_key TEXT,
  p_status TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_image_urls JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_failure_code TEXT DEFAULT NULL,
  p_retryable BOOLEAN DEFAULT false
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_image_urls JSONB := '[]'::jsonb;
  v_primary_image_url TEXT := NULLIF(btrim(COALESCE(p_image_url, '')), '');
  v_failure_code TEXT := NULLIF(btrim(COALESCE(p_failure_code, '')), '');
  v_failure_message TEXT := NULLIF(btrim(COALESCE(p_error_message, '')), '');
  v_first_image_url TEXT;
BEGIN
  IF p_profile_key IS NULL OR btrim(p_profile_key) = '' THEN
    RAISE EXCEPTION 'profile_key is required';
  END IF;

  IF p_status NOT IN ('ready', 'unavailable') THEN
    RAISE EXCEPTION 'invalid Cosmiq title card status: %', p_status;
  END IF;

  IF p_image_urls IS NOT NULL THEN
    IF jsonb_typeof(p_image_urls) <> 'array' THEN
      RAISE EXCEPTION 'image_urls must be an array';
    END IF;

    SELECT COALESCE(jsonb_agg(image_url ORDER BY ordinal), '[]'::jsonb)
    INTO v_image_urls
    FROM (
      SELECT btrim(value) AS image_url, ordinal
      FROM jsonb_array_elements_text(p_image_urls) WITH ORDINALITY AS image_values(value, ordinal)
      WHERE btrim(value) <> ''
    ) normalized;
  END IF;

  SELECT value
  INTO v_first_image_url
  FROM jsonb_array_elements_text(v_image_urls)
  LIMIT 1;

  v_primary_image_url := COALESCE(v_primary_image_url, v_first_image_url);

  UPDATE public.companion_cosmiq_title_cards
  SET
    status = p_status,
    image_url = CASE WHEN p_status = 'ready' THEN v_primary_image_url ELSE image_url END,
    image_urls = CASE
      WHEN p_status = 'ready' AND jsonb_array_length(v_image_urls) > 0 THEN v_image_urls
      WHEN p_status = 'ready' AND v_primary_image_url IS NOT NULL THEN jsonb_build_array(v_primary_image_url)
      ELSE image_urls
    END,
    error_message = CASE WHEN p_status = 'unavailable' THEN v_failure_message ELSE NULL END,
    failure_code = CASE WHEN p_status = 'unavailable' THEN v_failure_code ELSE NULL END,
    failure_message = CASE WHEN p_status = 'unavailable' THEN v_failure_message ELSE NULL END,
    retryable = CASE WHEN p_status = 'unavailable' THEN COALESCE(p_retryable, false) ELSE false END,
    last_attempt_at = timezone('utc', now()),
    generated_at = CASE WHEN p_status = 'ready' THEN timezone('utc', now()) ELSE generated_at END,
    updated_at = timezone('utc', now())
  WHERE profile_key = btrim(p_profile_key);
END;
$function$;

DROP FUNCTION IF EXISTS public.begin_cosmiq_title_card_generation(
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  INTERVAL
);

CREATE OR REPLACE FUNCTION public.begin_cosmiq_title_card_generation(
  p_profile_key TEXT,
  p_prompt_version INTEGER,
  p_visual_persona TEXT DEFAULT 'neutral',
  p_title TEXT DEFAULT NULL,
  p_rarity TEXT DEFAULT NULL,
  p_momentum TEXT DEFAULT NULL,
  p_dominant_stat TEXT DEFAULT NULL,
  p_secondary_stat TEXT DEFAULT NULL,
  p_rebalance_stat TEXT DEFAULT NULL,
  p_fusion BOOLEAN DEFAULT false,
  p_band_signature TEXT DEFAULT NULL,
  p_force_refresh BOOLEAN DEFAULT false,
  p_stale_after INTERVAL DEFAULT interval '3 minutes'
)
RETURNS TABLE(
  action TEXT,
  status TEXT,
  image_url TEXT,
  image_urls JSONB,
  prompt_version INTEGER,
  failure_code TEXT,
  failure_message TEXT,
  retryable BOOLEAN,
  last_attempt_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_card public.companion_cosmiq_title_cards%ROWTYPE;
  v_visual_persona TEXT := CASE
    WHEN p_visual_persona IN ('male', 'female', 'neutral') THEN p_visual_persona
    ELSE 'neutral'
  END;
BEGIN
  IF p_profile_key IS NULL OR btrim(p_profile_key) = '' THEN
    RAISE EXCEPTION 'profile_key is required';
  END IF;

  INSERT INTO public.companion_cosmiq_title_cards (
    profile_key,
    prompt_version,
    visual_persona,
    title,
    rarity,
    momentum,
    dominant_stat,
    secondary_stat,
    rebalance_stat,
    fusion,
    band_signature,
    status,
    retryable,
    generation_started_at,
    last_attempt_at
  ) VALUES (
    btrim(p_profile_key),
    p_prompt_version,
    v_visual_persona,
    btrim(p_title),
    p_rarity,
    p_momentum,
    p_dominant_stat,
    p_secondary_stat,
    p_rebalance_stat,
    COALESCE(p_fusion, false),
    btrim(p_band_signature),
    'generating',
    false,
    timezone('utc', now()),
    timezone('utc', now())
  )
  ON CONFLICT (profile_key) DO NOTHING
  RETURNING * INTO v_card;

  IF FOUND THEN
    RETURN QUERY SELECT
      'started'::TEXT,
      v_card.status,
      v_card.image_url,
      v_card.image_urls,
      v_card.prompt_version,
      v_card.failure_code,
      v_card.failure_message,
      v_card.retryable,
      v_card.last_attempt_at;
    RETURN;
  END IF;

  SELECT *
  INTO v_card
  FROM public.companion_cosmiq_title_cards
  WHERE profile_key = btrim(p_profile_key)
  FOR UPDATE;

  IF NOT COALESCE(p_force_refresh, false)
     AND v_card.status = 'ready'
     AND v_card.image_url IS NOT NULL THEN
    RETURN QUERY SELECT
      'ready'::TEXT,
      v_card.status,
      v_card.image_url,
      v_card.image_urls,
      v_card.prompt_version,
      v_card.failure_code,
      v_card.failure_message,
      v_card.retryable,
      v_card.last_attempt_at;
    RETURN;
  END IF;

  IF NOT COALESCE(p_force_refresh, false)
     AND v_card.status = 'generating'
     AND v_card.generation_started_at IS NOT NULL
     AND v_card.generation_started_at > timezone('utc', now()) - p_stale_after THEN
    RETURN QUERY SELECT
      'generating'::TEXT,
      v_card.status,
      v_card.image_url,
      v_card.image_urls,
      v_card.prompt_version,
      v_card.failure_code,
      v_card.failure_message,
      v_card.retryable,
      v_card.last_attempt_at;
    RETURN;
  END IF;

  UPDATE public.companion_cosmiq_title_cards
  SET
    prompt_version = p_prompt_version,
    visual_persona = v_visual_persona,
    title = btrim(p_title),
    rarity = p_rarity,
    momentum = p_momentum,
    dominant_stat = p_dominant_stat,
    secondary_stat = p_secondary_stat,
    rebalance_stat = p_rebalance_stat,
    fusion = COALESCE(p_fusion, false),
    band_signature = btrim(p_band_signature),
    image_url = CASE WHEN COALESCE(p_force_refresh, false) THEN NULL ELSE image_url END,
    image_urls = CASE WHEN COALESCE(p_force_refresh, false) THEN '[]'::jsonb ELSE image_urls END,
    status = 'generating',
    error_message = NULL,
    failure_code = NULL,
    failure_message = NULL,
    retryable = false,
    generation_started_at = timezone('utc', now()),
    last_attempt_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE profile_key = btrim(p_profile_key)
  RETURNING * INTO v_card;

  RETURN QUERY SELECT
    'started'::TEXT,
    v_card.status,
    v_card.image_url,
    v_card.image_urls,
    v_card.prompt_version,
    v_card.failure_code,
    v_card.failure_message,
    v_card.retryable,
    v_card.last_attempt_at;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_cosmiq_title_card_generation(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.begin_cosmiq_title_card_generation(
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  INTERVAL
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_cosmiq_title_card_generation(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BOOLEAN)
TO service_role;

GRANT EXECUTE ON FUNCTION public.begin_cosmiq_title_card_generation(
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  BOOLEAN,
  INTERVAL
) TO service_role;
