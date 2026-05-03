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
    image_url = CASE
      WHEN COALESCE(p_force_refresh, false) THEN NULL
      ELSE companion_cosmiq_title_cards.image_url
    END,
    image_urls = CASE
      WHEN COALESCE(p_force_refresh, false) THEN '[]'::jsonb
      ELSE companion_cosmiq_title_cards.image_urls
    END,
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
