-- Backfill image URLs for stage-0 AI eggs whose current_image_url and/or
-- initial_image_url were left NULL or empty by older onboarding flows that
-- relied on async generation to populate them. The UI already falls back to
-- the same universal egg asset, so this just brings the database in sync
-- with what users actually see.
--
-- The fallback path mirrors `getUniversalEggAssetUrl` in
-- src/lib/companionAssetResolver.ts. `coerceCompanionElementId` maps unknown
-- elements to "fire", so we do the same here.

WITH egg_assets AS (
  SELECT
    uc.id,
    '/companion-eggs/egg__t0_egg__normal__'
      || CASE
           WHEN BTRIM(COALESCE(uc.core_element, '')) IN ('fire', 'ice', 'storm', 'nature', 'void', 'light')
             THEN BTRIM(uc.core_element)
           ELSE 'fire'
         END
      || '.png' AS fallback_url
  FROM public.user_companion AS uc
  WHERE uc.current_stage = 0
    AND uc.preset_id IS NULL
    AND (
      uc.current_image_url IS NULL OR BTRIM(uc.current_image_url) = ''
      OR uc.initial_image_url IS NULL OR BTRIM(uc.initial_image_url) = ''
    )
)
UPDATE public.user_companion AS uc
SET
  current_image_url = CASE
    WHEN uc.current_image_url IS NULL OR BTRIM(uc.current_image_url) = ''
      THEN egg_assets.fallback_url
    ELSE uc.current_image_url
  END,
  initial_image_url = CASE
    WHEN uc.initial_image_url IS NULL OR BTRIM(uc.initial_image_url) = ''
      THEN egg_assets.fallback_url
    ELSE uc.initial_image_url
  END,
  updated_at = now()
FROM egg_assets
WHERE uc.id = egg_assets.id;
