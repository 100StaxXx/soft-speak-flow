-- Smoke test sensitive-state hardening and clean up temporary rows.
DO $$
DECLARE
  v_user_id uuid := '66666666-6666-6666-6666-666666666666';
  v_other_user_id uuid := '77777777-7777-7777-7777-777777777777';
  v_profile_columns text[];
BEGIN
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'sensitive-smoke-user@example.com',
      crypt('password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_other_user_id,
      'authenticated',
      'authenticated',
      'sensitive-smoke-other@example.com',
      crypt('password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.account_entitlements (
    user_id,
    source,
    status,
    plan,
    is_active,
    started_at,
    ends_at
  )
  VALUES (
    v_user_id,
    'subscription',
    'active',
    'monthly',
    false,
    now() - interval '1 day',
    now() + interval '29 days'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    source = EXCLUDED.source,
    status = EXCLUDED.status,
    plan = EXCLUDED.plan,
    is_active = EXCLUDED.is_active,
    started_at = EXCLUDED.started_at,
    ends_at = EXCLUDED.ends_at,
    updated_at = now();

  INSERT INTO public.user_ai_learning (
    user_id,
    interaction_count,
    acceptance_rate,
    modification_rate,
    last_interaction_at
  )
  VALUES (
    v_user_id,
    1,
    25,
    50,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    interaction_count = 1,
    acceptance_rate = 25,
    modification_rate = 50,
    last_interaction_at = now(),
    updated_at = now();

  INSERT INTO public.daily_planning_usage (
    user_id,
    times_used,
    last_used_at
  )
  VALUES (
    v_user_id,
    3,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    times_used = 3,
    last_used_at = now(),
    updated_at = now();

  INSERT INTO public.referral_codes (
    id,
    code,
    owner_type,
    owner_user_id,
    is_active
  )
  VALUES (
    '88888888-8888-8888-8888-888888888888',
    'SENSITIVE-SMOKE',
    'user',
    v_user_id,
    true
  )
  ON CONFLICT (code) DO NOTHING;

  INSERT INTO public.referral_payouts (
    id,
    referrer_id,
    referee_id,
    referral_code_id,
    amount,
    status,
    payout_type
  )
  VALUES (
    '99999999-9999-9999-9999-999999999999',
    v_user_id,
    v_other_user_id,
    '88888888-8888-8888-8888-888888888888',
    12.50,
    'pending',
    'first_month'
  )
  ON CONFLICT (id) DO NOTHING;

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

DO $$
DECLARE
  v_user_id uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  EXECUTE 'set local role authenticated';
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);

  BEGIN
    UPDATE public.account_entitlements
    SET is_active = true
    WHERE user_id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'admin');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.ai_interactions (
      user_id,
      interaction_type,
      input_text,
      user_action
    )
    VALUES (
      v_user_id,
      'smoke',
      'client attempt',
      'accepted'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    UPDATE public.user_ai_learning
    SET interaction_count = 999
    WHERE user_id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    UPDATE public.daily_planning_usage
    SET times_used = 999
    WHERE user_id = v_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    UPDATE public.referral_payouts
    SET status = 'approved'
    WHERE id = '99999999-9999-9999-9999-999999999999';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    UPDATE public.referral_codes
    SET is_active = false
    WHERE id = '88888888-8888-8888-8888-888888888888';
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  EXECUTE 'reset role';

  IF EXISTS (
    SELECT 1
    FROM public.account_entitlements
    WHERE user_id = v_user_id
      AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Smoke test failed: authenticated users must not update account_entitlements';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_user_id
      AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Smoke test failed: authenticated users must not insert user_roles';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ai_interactions
    WHERE user_id = v_user_id
      AND interaction_type = 'smoke'
  ) THEN
    RAISE EXCEPTION 'Smoke test failed: authenticated users must not insert ai_interactions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_ai_learning
    WHERE user_id = v_user_id
      AND interaction_count = 999
  ) THEN
    RAISE EXCEPTION 'Smoke test failed: authenticated users must not update user_ai_learning';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.daily_planning_usage
    WHERE user_id = v_user_id
      AND times_used = 999
  ) THEN
    RAISE EXCEPTION 'Smoke test failed: authenticated users must not update daily_planning_usage';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.referral_payouts
    WHERE id = '99999999-9999-9999-9999-999999999999'
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Smoke test failed: authenticated users must not update referral_payouts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.referral_codes
    WHERE id = '88888888-8888-8888-8888-888888888888'
      AND is_active = false
  ) THEN
    RAISE EXCEPTION 'Smoke test failed: authenticated users must not update referral_codes';
  END IF;
END;
$$;

DELETE FROM public.referral_payouts WHERE id = '99999999-9999-9999-9999-999999999999';
DELETE FROM public.referral_codes WHERE id = '88888888-8888-8888-8888-888888888888';
DELETE FROM public.daily_planning_usage WHERE user_id = '66666666-6666-6666-6666-666666666666';
DELETE FROM public.user_ai_learning WHERE user_id = '66666666-6666-6666-6666-666666666666';
DELETE FROM public.account_entitlements WHERE user_id = '66666666-6666-6666-6666-666666666666';
DELETE FROM auth.users WHERE id IN (
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777'
);
