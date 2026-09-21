-- Product ownership is an account property, not something that should be
-- inferred from editable companion fields. New product-scoped auth identities
-- carry the trusted value in auth.users.raw_app_meta_data.

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
    -- Graceward assigns a reviewed premade form at hatch, so preset_id is no
    -- longer a reliable product discriminator. Trusted account metadata owns
    -- the boundary regardless of the companion's editable visual fields.
    NEW.product_mode := v_account_product_mode;
  ELSIF NEW.product_mode IN ('graceward', 'cosmiq') THEN
    -- Preserve the explicit identity of unbound legacy rows. In particular, a
    -- Graceward egg must stay Graceward when hatch fills preset_id.
    NEW.product_mode := NEW.product_mode;
  ELSIF NEW.preset_id IS NOT NULL
    OR lower(trim(COALESCE(NEW.spirit_animal, ''))) = 'egg' THEN
    -- Legacy accounts created before product-scoped auth retain the historical
    -- content inference until they are explicitly bound by a trusted login.
    NEW.product_mode := 'cosmiq';
  ELSIF NEW.product_mode IS NULL
    OR NEW.product_mode NOT IN ('graceward', 'cosmiq') THEN
    NEW.product_mode := 'graceward';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_companion_product_mode() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.normalize_profile_product_mode()
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
  WHERE id = NEW.id;

  IF v_account_product_mode IN ('graceward', 'cosmiq') THEN
    NEW.onboarding_data := jsonb_set(
      COALESCE(NEW.onboarding_data, '{}'::jsonb),
      '{product_mode}',
      to_jsonb(v_account_product_mode),
      true
    );
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.normalize_profile_product_mode() FROM PUBLIC;

-- Existing trusted accounts must not wait for a later onboarding_data write to
-- receive their profile binding. Companion rows are intentionally not
-- reclassified here: an incompatible legacy visual stays quarantined under its
-- original product instead of being relabeled into the other app.
UPDATE public.profiles AS profile
SET onboarding_data = jsonb_set(
  COALESCE(profile.onboarding_data, '{}'::jsonb),
  '{product_mode}',
  to_jsonb(account.raw_app_meta_data ->> 'auth_product_mode'),
  true
)
FROM auth.users AS account
WHERE account.id = profile.id
  AND account.raw_app_meta_data ->> 'auth_product_mode' IN ('graceward', 'cosmiq')
  AND profile.onboarding_data ->> 'product_mode'
    IS DISTINCT FROM account.raw_app_meta_data ->> 'auth_product_mode';

DROP TRIGGER IF EXISTS profile_00_normalize_product_mode ON public.profiles;
CREATE TRIGGER profile_00_normalize_product_mode
BEFORE INSERT OR UPDATE OF onboarding_data
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.normalize_profile_product_mode();

COMMENT ON FUNCTION public.normalize_companion_product_mode() IS
  'Binds compatible companions to trusted auth app metadata and rejects cross-product visual families.';
COMMENT ON FUNCTION public.normalize_profile_product_mode() IS
  'Keeps profile onboarding product identity aligned with trusted auth app metadata.';
