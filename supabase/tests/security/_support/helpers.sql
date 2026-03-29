CREATE SCHEMA IF NOT EXISTS test_security;

CREATE OR REPLACE FUNCTION test_security.set_auth(
  p_role TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_role NOT IN ('anon', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'Unsupported test auth role: %', p_role;
  END IF;

  EXECUTE format('SET LOCAL ROLE %I', p_role);
  PERFORM set_config('request.jwt.claim.role', p_role, true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_user_id::TEXT, ''), true);
END;
$$;

CREATE OR REPLACE FUNCTION test_security.reset_auth()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.role', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END;
$$;

CREATE OR REPLACE FUNCTION test_security.exec_row_count(p_sql TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_row_count INTEGER := 0;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count;
END;
$$;

CREATE OR REPLACE FUNCTION test_security.attempt_sql(p_sql TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION test_security.insert_storage_object(
  p_object_id UUID,
  p_bucket_id TEXT,
  p_name TEXT,
  p_owner UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_row_count INTEGER := 0;
BEGIN
  INSERT INTO storage.objects (
    id,
    bucket_id,
    name,
    owner,
    owner_id,
    metadata,
    user_metadata,
    version,
    created_at,
    updated_at,
    last_accessed_at
  )
  VALUES (
    p_object_id,
    p_bucket_id,
    p_name,
    p_owner,
    p_owner::TEXT,
    '{}'::jsonb,
    '{}'::jsonb,
    '1',
    NOW(),
    NOW(),
    NOW()
  );

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count;
END;
$$;

CREATE OR REPLACE FUNCTION test_security.try_insert_storage_object(
  p_object_id UUID,
  p_bucket_id TEXT,
  p_name TEXT,
  p_owner UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM test_security.insert_storage_object(
    p_object_id,
    p_bucket_id,
    p_name,
    p_owner
  );
  RETURN NULL;
EXCEPTION
  WHEN OTHERS THEN
    RETURN SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION test_security.seed_fixtures()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_a UUID := '10000000-0000-0000-0000-000000000001';
  v_user_b UUID := '10000000-0000-0000-0000-000000000002';
  v_admin UUID := '10000000-0000-0000-0000-000000000003';
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
      v_user_a,
      'authenticated',
      'authenticated',
      'security-user-a@example.com',
      crypt('password', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_user_b,
      'authenticated',
      'authenticated',
      'security-user-b@example.com',
      crypt('password', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    ),
    (
      '00000000-0000-0000-0000-000000000000',
      v_admin,
      'authenticated',
      'authenticated',
      'security-admin@example.com',
      crypt('password', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW()
    )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    updated_at = NOW();

  UPDATE public.profiles
  SET
    email = CASE id
      WHEN v_user_a THEN 'security-user-a@example.com'
      WHEN v_user_b THEN 'security-user-b@example.com'
      ELSE 'security-admin@example.com'
    END,
    timezone = CASE id
      WHEN v_user_a THEN 'America/Los_Angeles'
      WHEN v_user_b THEN 'America/New_York'
      ELSE 'UTC'
    END,
    referral_count = 0,
    referral_code = CASE id
      WHEN v_user_a THEN 'SECUSERA'
      WHEN v_user_b THEN 'SECUSERB'
      ELSE 'SECADMIN'
    END,
    referred_by = NULL,
    referred_by_code = NULL,
    streak_freezes_available = 1,
    life_status = 'active',
    total_quests_completed = 0,
    updated_at = NOW()
  WHERE id IN (v_user_a, v_user_b, v_admin);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.push_device_tokens (
    id,
    user_id,
    device_token,
    platform,
    user_agent
  )
  VALUES
    (
      '21000000-0000-0000-0000-000000000001',
      v_user_a,
      repeat('a', 64),
      'ios',
      'security-suite'
    ),
    (
      '21000000-0000-0000-0000-000000000002',
      v_user_b,
      repeat('b', 64),
      'ios',
      'security-suite'
    )
  ON CONFLICT (user_id, device_token) DO NOTHING;

  INSERT INTO public.user_companion (
    id,
    user_id,
    favorite_color,
    spirit_animal,
    core_element,
    story_tone,
    current_image_url,
    initial_image_url
  )
  VALUES
    (
      '22000000-0000-0000-0000-000000000001',
      v_user_a,
      'blue',
      'fox',
      'water',
      'epic_adventure',
      'https://example.com/security-user-a-current.png',
      'https://example.com/security-user-a-initial.png'
    ),
    (
      '22000000-0000-0000-0000-000000000002',
      v_user_b,
      'green',
      'owl',
      'earth',
      'epic_adventure',
      'https://example.com/security-user-b-current.png',
      'https://example.com/security-user-b-initial.png'
    )
  ON CONFLICT (user_id) DO UPDATE
  SET
    favorite_color = EXCLUDED.favorite_color,
    spirit_animal = EXCLUDED.spirit_animal,
    core_element = EXCLUDED.core_element,
    story_tone = EXCLUDED.story_tone,
    current_image_url = EXCLUDED.current_image_url,
    initial_image_url = EXCLUDED.initial_image_url,
    updated_at = NOW();

  INSERT INTO public.mentor_chats (
    id,
    user_id,
    role,
    content,
    created_at
  )
  VALUES (
    '23000000-0000-0000-0000-000000000001',
    v_user_b,
    'user',
    'Other user private mentor chat',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.referral_codes (
    id,
    code,
    owner_type,
    owner_user_id,
    is_active
  )
  VALUES (
    '24000000-0000-0000-0000-000000000001',
    'SECURITY-USER-B',
    'user',
    v_user_b,
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
    '25000000-0000-0000-0000-000000000001',
    v_user_b,
    v_admin,
    '24000000-0000-0000-0000-000000000001',
    12.50,
    'pending',
    'first_month'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subscriptions (
    id,
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    plan,
    status,
    current_period_start,
    current_period_end,
    source,
    environment
  )
  VALUES (
    '26000000-0000-0000-0000-000000000001',
    v_user_b,
    'cus_security_user_b',
    'sub_security_user_b',
    'monthly',
    'active',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '29 days',
    'receipt',
    'sandbox'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    plan = EXCLUDED.plan,
    status = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    source = EXCLUDED.source,
    environment = EXCLUDED.environment,
    updated_at = NOW();

  INSERT INTO public.account_entitlements (
    user_id,
    source,
    status,
    plan,
    is_active,
    started_at,
    ends_at,
    metadata
  )
  VALUES
    (
      v_user_a,
      'none',
      'inactive',
      NULL,
      false,
      NOW() - INTERVAL '1 day',
      NULL,
      '{"fixture":"user_a"}'::jsonb
    ),
    (
      v_user_b,
      'subscription',
      'active',
      'monthly',
      true,
      NOW() - INTERVAL '1 day',
      NOW() + INTERVAL '29 days',
      '{"fixture":"user_b"}'::jsonb
    )
  ON CONFLICT (user_id) DO UPDATE
  SET
    source = EXCLUDED.source,
    status = EXCLUDED.status,
    plan = EXCLUDED.plan,
    is_active = EXCLUDED.is_active,
    started_at = EXCLUDED.started_at,
    ends_at = EXCLUDED.ends_at,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  INSERT INTO public.promo_codes (
    id,
    code,
    label,
    is_active,
    grant_days,
    max_redemptions,
    redeemed_count,
    metadata
  )
  VALUES (
    '27000000-0000-0000-0000-000000000001',
    'SECURITYPROMO',
    'Security Test Promo',
    true,
    30,
    10,
    0,
    '{"suite":"security"}'::jsonb
  )
  ON CONFLICT (code) DO UPDATE
  SET
    label = EXCLUDED.label,
    is_active = EXCLUDED.is_active,
    grant_days = EXCLUDED.grant_days,
    max_redemptions = EXCLUDED.max_redemptions,
    redeemed_count = 0,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

  INSERT INTO storage.buckets (id, name, public)
  VALUES
    ('quest-attachments', 'quest-attachments', false),
    ('pep-talk-audio', 'pep-talk-audio', true)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    public = EXCLUDED.public;

  PERFORM test_security.insert_storage_object(
    '28000000-0000-0000-0000-000000000001',
    'quest-attachments',
    format('%s/existing.txt', v_user_a),
    v_user_a
  );
EXCEPTION
  WHEN unique_violation THEN
    NULL;
END;
$$;
