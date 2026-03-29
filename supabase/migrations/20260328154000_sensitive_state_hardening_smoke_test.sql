-- Smoke test sensitive-state hardening with schema-level assertions only.
DO $$
DECLARE
  v_profile_columns text[];
BEGIN
  IF to_regclass('public.account_entitlements') IS NULL THEN
    RAISE EXCEPTION 'Smoke test failed: account_entitlements table was not created';
  END IF;

  IF to_regclass('public.daily_planning_usage') IS NULL THEN
    RAISE EXCEPTION 'Smoke test failed: daily_planning_usage table was not created';
  END IF;

  SELECT array_agg(column_name ORDER BY column_name)
  INTO v_profile_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = ANY (ARRAY[
      'is_premium',
      'stripe_customer_id',
      'subscription_status',
      'subscription_started_at',
      'subscription_expires_at',
      'trial_started_at',
      'trial_ends_at'
    ]);

  IF coalesce(array_length(v_profile_columns, 1), 0) <> 0 THEN
    RAISE EXCEPTION 'Smoke test failed: legacy sensitive profile columns still exist: %', v_profile_columns;
  END IF;
END;
$$;
