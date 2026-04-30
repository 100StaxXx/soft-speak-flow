CREATE TABLE IF NOT EXISTS public.companion_cosmiq_title_cards (
  profile_key TEXT PRIMARY KEY,
  prompt_version INTEGER NOT NULL,
  title TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'cosmic')),
  momentum TEXT NOT NULL CHECK (momentum IN ('rising', 'steady', 'recovering', 'slipping')),
  dominant_stat TEXT NOT NULL CHECK (dominant_stat IN ('vitality', 'wisdom', 'discipline', 'resolve', 'creativity', 'alignment')),
  secondary_stat TEXT NOT NULL CHECK (secondary_stat IN ('vitality', 'wisdom', 'discipline', 'resolve', 'creativity', 'alignment')),
  rebalance_stat TEXT NOT NULL CHECK (rebalance_stat IN ('vitality', 'wisdom', 'discipline', 'resolve', 'creativity', 'alignment')),
  fusion BOOLEAN NOT NULL DEFAULT false,
  band_signature TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'unavailable')),
  error_message TEXT,
  generation_started_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT companion_cosmiq_title_cards_profile_key_not_blank CHECK (btrim(profile_key) <> ''),
  CONSTRAINT companion_cosmiq_title_cards_title_not_blank CHECK (btrim(title) <> ''),
  CONSTRAINT companion_cosmiq_title_cards_band_signature_not_blank CHECK (btrim(band_signature) <> '')
);

CREATE INDEX IF NOT EXISTS companion_cosmiq_title_cards_status_idx
  ON public.companion_cosmiq_title_cards(status, updated_at DESC);

ALTER TABLE public.companion_cosmiq_title_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view Cosmiq title cards" ON public.companion_cosmiq_title_cards;
CREATE POLICY "Authenticated users can view Cosmiq title cards"
ON public.companion_cosmiq_title_cards
FOR SELECT
TO authenticated
USING (true);

REVOKE ALL ON public.companion_cosmiq_title_cards FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.companion_cosmiq_title_cards TO authenticated;
GRANT ALL ON public.companion_cosmiq_title_cards TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cosmiq-title-cards', 'cosmiq-title-cards', true)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Public can view Cosmiq title card images" ON storage.objects;
CREATE POLICY "Public can view Cosmiq title card images"
ON storage.objects FOR SELECT
USING (bucket_id = 'cosmiq-title-cards');

DROP POLICY IF EXISTS "Service role can manage Cosmiq title card images" ON storage.objects;
CREATE POLICY "Service role can manage Cosmiq title card images"
ON storage.objects FOR ALL
USING (bucket_id = 'cosmiq-title-cards' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'cosmiq-title-cards' AND auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.begin_cosmiq_title_card_generation(
  p_profile_key TEXT,
  p_prompt_version INTEGER,
  p_title TEXT,
  p_rarity TEXT,
  p_momentum TEXT,
  p_dominant_stat TEXT,
  p_secondary_stat TEXT,
  p_rebalance_stat TEXT,
  p_fusion BOOLEAN,
  p_band_signature TEXT,
  p_stale_after INTERVAL DEFAULT interval '3 minutes'
)
RETURNS TABLE(
  action TEXT,
  status TEXT,
  image_url TEXT,
  prompt_version INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_card public.companion_cosmiq_title_cards%ROWTYPE;
BEGIN
  IF p_profile_key IS NULL OR btrim(p_profile_key) = '' THEN
    RAISE EXCEPTION 'profile_key is required';
  END IF;

  INSERT INTO public.companion_cosmiq_title_cards (
    profile_key,
    prompt_version,
    title,
    rarity,
    momentum,
    dominant_stat,
    secondary_stat,
    rebalance_stat,
    fusion,
    band_signature,
    status,
    generation_started_at
  ) VALUES (
    btrim(p_profile_key),
    p_prompt_version,
    btrim(p_title),
    p_rarity,
    p_momentum,
    p_dominant_stat,
    p_secondary_stat,
    p_rebalance_stat,
    COALESCE(p_fusion, false),
    btrim(p_band_signature),
    'generating',
    timezone('utc', now())
  )
  ON CONFLICT (profile_key) DO NOTHING
  RETURNING * INTO v_card;

  IF FOUND THEN
    RETURN QUERY SELECT
      'started'::TEXT,
      v_card.status,
      v_card.image_url,
      v_card.prompt_version;
    RETURN;
  END IF;

  SELECT *
  INTO v_card
  FROM public.companion_cosmiq_title_cards
  WHERE profile_key = btrim(p_profile_key)
  FOR UPDATE;

  IF v_card.status = 'ready' AND v_card.image_url IS NOT NULL THEN
    RETURN QUERY SELECT
      'ready'::TEXT,
      v_card.status,
      v_card.image_url,
      v_card.prompt_version;
    RETURN;
  END IF;

  IF v_card.status = 'generating'
     AND v_card.generation_started_at IS NOT NULL
     AND v_card.generation_started_at > timezone('utc', now()) - p_stale_after THEN
    RETURN QUERY SELECT
      'generating'::TEXT,
      v_card.status,
      v_card.image_url,
      v_card.prompt_version;
    RETURN;
  END IF;

  UPDATE public.companion_cosmiq_title_cards
  SET
    prompt_version = p_prompt_version,
    title = btrim(p_title),
    rarity = p_rarity,
    momentum = p_momentum,
    dominant_stat = p_dominant_stat,
    secondary_stat = p_secondary_stat,
    rebalance_stat = p_rebalance_stat,
    fusion = COALESCE(p_fusion, false),
    band_signature = btrim(p_band_signature),
    status = 'generating',
    error_message = NULL,
    generation_started_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  WHERE profile_key = btrim(p_profile_key)
  RETURNING * INTO v_card;

  RETURN QUERY SELECT
    'started'::TEXT,
    v_card.status,
    v_card.image_url,
    v_card.prompt_version;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_cosmiq_title_card_generation(
  p_profile_key TEXT,
  p_status TEXT,
  p_image_url TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_profile_key IS NULL OR btrim(p_profile_key) = '' THEN
    RAISE EXCEPTION 'profile_key is required';
  END IF;

  IF p_status NOT IN ('ready', 'unavailable') THEN
    RAISE EXCEPTION 'invalid Cosmiq title card status: %', p_status;
  END IF;

  UPDATE public.companion_cosmiq_title_cards
  SET
    status = p_status,
    image_url = CASE WHEN p_status = 'ready' THEN p_image_url ELSE image_url END,
    error_message = CASE WHEN p_status = 'unavailable' THEN p_error_message ELSE NULL END,
    generated_at = CASE WHEN p_status = 'ready' THEN timezone('utc', now()) ELSE generated_at END,
    updated_at = timezone('utc', now())
  WHERE profile_key = btrim(p_profile_key);
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
  BOOLEAN,
  TEXT,
  INTERVAL
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_cosmiq_title_card_generation(TEXT, TEXT, TEXT, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.begin_cosmiq_title_card_generation(
  TEXT,
  INTEGER,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  BOOLEAN,
  TEXT,
  INTERVAL
) TO service_role;

GRANT EXECUTE ON FUNCTION public.complete_cosmiq_title_card_generation(TEXT, TEXT, TEXT, TEXT)
TO service_role;

INSERT INTO public.cost_guardrail_config (scope_type, scope_key, enabled, monthly_budget_usd, alert_thresholds, metadata)
VALUES
  ('endpoint', 'generate-cosmiq-title-card', true, 30.00, ARRAY[50,80,90,100], '{"risk":"high","description":"Shared Cosmiq title card image generation"}')
ON CONFLICT (scope_type, scope_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  monthly_budget_usd = EXCLUDED.monthly_budget_usd,
  alert_thresholds = EXCLUDED.alert_thresholds,
  metadata = EXCLUDED.metadata;
