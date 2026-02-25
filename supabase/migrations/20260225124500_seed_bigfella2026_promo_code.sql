-- Ensure BIGFELLA2026 exists even if the original promo migration was already applied before seed was added.
INSERT INTO public.promo_codes (
  code,
  label,
  is_active,
  grant_days,
  max_redemptions,
  metadata
)
VALUES (
  'BIGFELLA2026',
  'Big Fella 2026',
  true,
  365,
  NULL,
  jsonb_build_object('campaign', 'bigfella2026', 'notes', 'One free year access')
)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  is_active = EXCLUDED.is_active,
  grant_days = EXCLUDED.grant_days,
  max_redemptions = EXCLUDED.max_redemptions,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();
