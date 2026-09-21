-- Graceward now assigns a reviewed premade form during hatch. `preset_id` is
-- therefore no longer a product discriminator once an account or row already
-- has an explicit product binding.
CREATE OR REPLACE FUNCTION public.normalize_companion_product_mode()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $function$
DECLARE
  v_account_product_mode text;
BEGIN
  SELECT raw_app_meta_data ->> 'auth_product_mode'
  INTO v_account_product_mode
  FROM auth.users
  WHERE id = NEW.user_id;

  IF v_account_product_mode IN ('graceward', 'cosmiq') THEN
    NEW.product_mode := v_account_product_mode;
  ELSIF NEW.product_mode IN ('graceward', 'cosmiq') THEN
    NEW.product_mode := NEW.product_mode;
  ELSIF NEW.preset_id IS NOT NULL
    OR lower(trim(COALESCE(NEW.spirit_animal, ''))) = 'egg' THEN
    NEW.product_mode := 'cosmiq';
  ELSE
    NEW.product_mode := 'graceward';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_companion_product_mode() FROM PUBLIC;

-- Repair rows that were classified from visual fields before trusted account
-- ownership became authoritative. The trigger applies the same rule here.
UPDATE public.user_companion AS companion
SET
  product_mode = account.raw_app_meta_data ->> 'auth_product_mode',
  updated_at = now()
FROM auth.users AS account
WHERE account.id = companion.user_id
  AND account.raw_app_meta_data ->> 'auth_product_mode' IN ('graceward', 'cosmiq')
  AND companion.product_mode IS DISTINCT FROM
    account.raw_app_meta_data ->> 'auth_product_mode';

COMMENT ON FUNCTION public.normalize_companion_product_mode() IS
  'Binds companions to trusted account product metadata while preserving explicit legacy identity through Graceward premade hatch selection.';
