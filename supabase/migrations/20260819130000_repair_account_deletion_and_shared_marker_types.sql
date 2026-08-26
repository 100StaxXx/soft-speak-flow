-- Repair two production-only schema drifts without duplicating the large,
-- hardened account-deletion routine. The installed function remains the
-- source of truth; this migration removes only the obsolete global-playlist
-- cleanup branch and preserves every other cleanup and authorization guard.

DO $migration$
DECLARE
  v_definition text;
  v_playlist_start integer;
  v_referral_start integer;
  v_referral_codes_start integer;
  v_referral_cleanup text;
BEGIN
  SELECT pg_get_functiondef('public.delete_user_account(uuid)'::regprocedure)
  INTO v_definition;

  v_playlist_start := strpos(
    v_definition,
    '  IF to_regclass(''public.playlists'') IS NOT NULL AND to_regclass(''public.playlist_items'') IS NOT NULL THEN'
  );
  v_referral_start := strpos(
    v_definition,
    '  IF to_regclass(''public.referral_payouts'') IS NOT NULL THEN'
  );

  IF v_playlist_start > 0 THEN
    IF v_referral_start <= v_playlist_start THEN
      RAISE EXCEPTION 'Unable to locate the end of the obsolete playlist cleanup branch in delete_user_account';
    END IF;

    v_definition := substr(v_definition, 1, v_playlist_start - 1)
      || substr(v_definition, v_referral_start);
  END IF;

  -- The current referral payout contract uses referrer_id/referee_id. Older
  -- constant-string fallbacks referenced retired columns; plpgsql_check plans
  -- those strings even when their exception branches can never run.
  v_referral_start := strpos(
    v_definition,
    '  IF to_regclass(''public.referral_payouts'') IS NOT NULL THEN'
  );
  v_referral_codes_start := strpos(
    v_definition,
    '  IF to_regclass(''public.referral_codes'') IS NOT NULL THEN'
  );

  IF v_referral_start <= 0 OR v_referral_codes_start <= v_referral_start THEN
    RAISE EXCEPTION 'Unable to locate referral cleanup branches in delete_user_account';
  END IF;

  v_referral_cleanup := $cleanup$  IF to_regclass('public.referral_payouts') IS NOT NULL THEN
    BEGIN
      EXECUTE
        'DELETE FROM public.referral_payouts
         WHERE referrer_id = $1 OR referee_id = $1'
      USING p_user_id;
    EXCEPTION WHEN undefined_column OR undefined_table THEN
      NULL;
    END;
  END IF;

$cleanup$;
  v_definition := substr(v_definition, 1, v_referral_start - 1)
    || v_referral_cleanup
    || substr(v_definition, v_referral_codes_start);
  EXECUTE v_definition;
END;
$migration$;

-- Focal coordinates are stored as double precision in production, while the
-- display-safe marker contract returns numeric. Make the conversion explicit
-- so the RPC cannot fail at RETURN QUERY planning time.
DO $migration$
DECLARE
  v_definition text;
  v_repaired_definition text;
BEGIN
  SELECT pg_get_functiondef('public.get_shared_epic_path_markers(uuid)'::regprocedure)
  INTO v_definition;

  v_repaired_definition := replace(
    v_definition,
    'companion_display.safe_companion_image_focal_x AS companion_image_focal_x',
    '(companion_display.safe_companion_image_focal_x)::numeric AS companion_image_focal_x'
  );
  v_repaired_definition := replace(
    v_repaired_definition,
    'companion_display.safe_companion_image_focal_y AS companion_image_focal_y',
    '(companion_display.safe_companion_image_focal_y)::numeric AS companion_image_focal_y'
  );

  IF v_repaired_definition = v_definition THEN
    IF strpos(
      v_definition,
      '(companion_display.safe_companion_image_focal_x)::numeric AS companion_image_focal_x'
    ) <= 0 OR strpos(
      v_definition,
      '(companion_display.safe_companion_image_focal_y)::numeric AS companion_image_focal_y'
    ) <= 0 THEN
      RAISE EXCEPTION 'Unable to locate shared marker focal coordinate projections';
    END IF;
  ELSE
    EXECUTE v_repaired_definition;
  END IF;
END;
$migration$;

NOTIFY pgrst, 'reload schema';
