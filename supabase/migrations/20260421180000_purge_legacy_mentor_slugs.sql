-- Rewrite persisted legacy mentor slugs to the Final 6 canonical roster.
-- Reign is retired from runtime support; historical content maps to Rival,
-- which shares the closest performance-oriented voice lane.

UPDATE public.daily_pep_talks
SET mentor_slug = CASE mentor_slug
  WHEN 'atlas' THEN 'sage'
  WHEN 'carmen' THEN 'icon'
  WHEN 'solace' THEN 'charles'
  WHEN 'elizabeth' THEN 'charles'
  WHEN 'sienna' THEN 'princess'
  WHEN 'stryker' THEN 'operator'
  WHEN 'eli' THEN 'rival'
  WHEN 'reign' THEN 'rival'
  ELSE mentor_slug
END
WHERE mentor_slug IN ('atlas', 'carmen', 'solace', 'elizabeth', 'sienna', 'stryker', 'eli', 'reign');

UPDATE public.pep_talks
SET mentor_slug = CASE mentor_slug
  WHEN 'atlas' THEN 'sage'
  WHEN 'carmen' THEN 'icon'
  WHEN 'solace' THEN 'charles'
  WHEN 'elizabeth' THEN 'charles'
  WHEN 'sienna' THEN 'princess'
  WHEN 'stryker' THEN 'operator'
  WHEN 'eli' THEN 'rival'
  WHEN 'reign' THEN 'rival'
  ELSE mentor_slug
END
WHERE mentor_slug IN ('atlas', 'carmen', 'solace', 'elizabeth', 'sienna', 'stryker', 'eli', 'reign');

UPDATE public.daily_quotes
SET mentor_slug = CASE mentor_slug
  WHEN 'atlas' THEN 'sage'
  WHEN 'carmen' THEN 'icon'
  WHEN 'solace' THEN 'charles'
  WHEN 'elizabeth' THEN 'charles'
  WHEN 'sienna' THEN 'princess'
  WHEN 'stryker' THEN 'operator'
  WHEN 'eli' THEN 'rival'
  WHEN 'reign' THEN 'rival'
  ELSE mentor_slug
END
WHERE mentor_slug IN ('atlas', 'carmen', 'solace', 'elizabeth', 'sienna', 'stryker', 'eli', 'reign');
