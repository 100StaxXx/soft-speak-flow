-- Restore the BIGFELLA2026 promo code after March hardening disabled the
-- original repo-seeded campaign entry.
INSERT INTO public.promo_codes (
  code,
  label,
  is_active,
  grant_days,
  max_redemptions,
  expires_at,
  metadata
)
VALUES (
  'BIGFELLA2026',
  'Big Fella 2026',
  true,
  365,
  NULL,
  NULL,
  jsonb_build_object(
    'campaign', 'bigfella2026',
    'notes', 'One free year access',
    'reactivated_reason', 'restore_repo_seed_2026_04_05'
  )
)
ON CONFLICT (code) DO UPDATE
SET
  label = EXCLUDED.label,
  is_active = true,
  grant_days = EXCLUDED.grant_days,
  max_redemptions = NULL,
  expires_at = NULL,
  metadata = (COALESCE(public.promo_codes.metadata, '{}'::jsonb) - 'disabled_reason')
    || EXCLUDED.metadata,
  updated_at = NOW();
