-- Native Supabase Apple exchange can create an unbound pre-split account.
-- Preserve every trusted or explicit existing product; otherwise use Cosmiq,
-- matching the legacy default in the server product resolver and auth gateway.
BEGIN;
DO $migration$
DECLARE
  definition text;
  marker text := E'  SELECT *\n  INTO v_companion\n  FROM public.user_companion';
  binding text := $binding$
  -- Serialize first creation against concurrent account binding.
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
  UPDATE auth.users AS account SET raw_app_meta_data =
    jsonb_set(coalesce(account.raw_app_meta_data, '{}'::jsonb), '{auth_product_mode}',
      to_jsonb(CASE WHEN EXISTS (
        SELECT 1 FROM public.profiles profile WHERE profile.id = p_user_id
          AND profile.onboarding_data->>'product_mode' IN ('graceward', 'christian')
      ) OR EXISTS (
        SELECT 1 FROM public.user_companion c WHERE c.user_id = p_user_id AND c.product_mode = 'graceward'
      ) THEN 'graceward'::text ELSE 'cosmiq'::text END), true)
  WHERE account.id = p_user_id
    AND coalesce(account.raw_app_meta_data->>'auth_product_mode', '') NOT IN ('cosmiq','graceward');
  UPDATE public.profiles SET onboarding_data = coalesce(onboarding_data, '{}'::jsonb)
  WHERE public.profiles.id = p_user_id;

$binding$;
BEGIN
  SELECT pg_get_functiondef(oid) INTO STRICT definition FROM pg_proc
  WHERE pronamespace='public'::regnamespace AND proname='create_companion_if_not_exists';
  IF position('Serialize first creation against concurrent account binding' in definition) = 0 THEN
    IF position(marker in definition) = 0 THEN
      RAISE EXCEPTION 'Unexpected companion creation definition; review before applying';
    END IF;
    definition := replace(definition, 'IF p_user_id != auth.uid() THEN',
      'IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN');
    EXECUTE replace(definition, marker, binding || marker);
  END IF;
END;
$migration$;
COMMIT;
