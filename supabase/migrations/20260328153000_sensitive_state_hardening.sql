-- Sensitive state hardening:
-- 1) Move premium / trial / billing snapshot data out of profiles.
-- 2) Split planner usage counts into a private server-owned table.
-- 3) Make admin roles and AI learning state service-managed.

-- ---------------------------------------------------------------------------
-- Current entitlement snapshot (service-managed only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_entitlements (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'none'
    CHECK (source = ANY (ARRAY['subscription', 'promo_code', 'trial', 'manual', 'none'])),
  status TEXT NOT NULL DEFAULT 'inactive'
    CHECK (status = ANY (ARRAY['active', 'trialing', 'cancelled', 'past_due', 'expired', 'inactive', 'incomplete'])),
  plan TEXT
    CHECK (plan IS NULL OR plan = ANY (ARRAY['monthly', 'yearly', 'promo', 'lifetime', 'trial'])),
  is_active BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  billing_customer_id TEXT,
  billing_subscription_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_account_entitlements_updated_at
BEFORE UPDATE ON public.account_entitlements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage account entitlements" ON public.account_entitlements;
CREATE POLICY "Service role can manage account entitlements"
ON public.account_entitlements
FOR ALL
USING (public.is_service_role())
WITH CHECK (public.is_service_role());

-- ---------------------------------------------------------------------------
-- Subscription trigger should update the private entitlement snapshot,
-- not the client-editable profiles row.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_premium_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source TEXT := CASE
    WHEN COALESCE(NEW.source, 'receipt') = 'promo_code' THEN 'promo_code'
    ELSE 'subscription'
  END;
  v_is_active BOOLEAN := (
    NEW.current_period_end > now()
    AND NEW.status = ANY (ARRAY['active', 'trialing', 'past_due', 'cancelled'])
  );
BEGIN
  INSERT INTO public.account_entitlements (
    user_id,
    source,
    status,
    plan,
    is_active,
    started_at,
    ends_at,
    trial_started_at,
    trial_ends_at,
    billing_customer_id,
    billing_subscription_id,
    metadata
  )
  VALUES (
    NEW.user_id,
    v_source,
    NEW.status,
    NEW.plan,
    v_is_active,
    COALESCE(NEW.current_period_start, now()),
    NEW.current_period_end,
    COALESCE(NEW.current_period_start, now()),
    NEW.trial_ends_at,
    NEW.stripe_customer_id,
    NEW.stripe_subscription_id,
    jsonb_strip_nulls(jsonb_build_object(
      'environment', NEW.environment,
      'subscription_source', NEW.source
    ))
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    source = EXCLUDED.source,
    status = EXCLUDED.status,
    plan = EXCLUDED.plan,
    is_active = EXCLUDED.is_active,
    started_at = COALESCE(public.account_entitlements.started_at, EXCLUDED.started_at),
    ends_at = EXCLUDED.ends_at,
    trial_started_at = COALESCE(public.account_entitlements.trial_started_at, EXCLUDED.trial_started_at),
    trial_ends_at = EXCLUDED.trial_ends_at,
    billing_customer_id = EXCLUDED.billing_customer_id,
    billing_subscription_id = EXCLUDED.billing_subscription_id,
    metadata = public.account_entitlements.metadata || EXCLUDED.metadata,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Backfill entitlement snapshot from subscriptions, promo grants, and legacy
-- profile state before dropping the old profile columns.
-- ---------------------------------------------------------------------------
INSERT INTO public.account_entitlements (
  user_id,
  source,
  status,
  plan,
  is_active,
  started_at,
  ends_at,
  trial_started_at,
  trial_ends_at,
  billing_customer_id,
  billing_subscription_id,
  metadata
)
SELECT DISTINCT ON (s.user_id)
  s.user_id,
  CASE
    WHEN COALESCE(s.source, 'receipt') = 'promo_code' THEN 'promo_code'
    ELSE 'subscription'
  END AS source,
  s.status,
  s.plan,
  (
    s.current_period_end > now()
    AND s.status = ANY (ARRAY['active', 'trialing', 'past_due', 'cancelled'])
  ) AS is_active,
  s.current_period_start,
  s.current_period_end,
  s.current_period_start,
  s.trial_ends_at,
  s.stripe_customer_id,
  s.stripe_subscription_id,
  jsonb_strip_nulls(jsonb_build_object(
    'backfilled_from', 'subscriptions',
    'environment', s.environment,
    'subscription_source', s.source
  ))
FROM public.subscriptions s
ORDER BY s.user_id, s.current_period_end DESC, s.updated_at DESC NULLS LAST
ON CONFLICT (user_id) DO UPDATE
SET
  source = EXCLUDED.source,
  status = EXCLUDED.status,
  plan = EXCLUDED.plan,
  is_active = EXCLUDED.is_active,
  started_at = COALESCE(public.account_entitlements.started_at, EXCLUDED.started_at),
  ends_at = EXCLUDED.ends_at,
  trial_started_at = COALESCE(public.account_entitlements.trial_started_at, EXCLUDED.trial_started_at),
  trial_ends_at = EXCLUDED.trial_ends_at,
  billing_customer_id = EXCLUDED.billing_customer_id,
  billing_subscription_id = EXCLUDED.billing_subscription_id,
  metadata = public.account_entitlements.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO public.account_entitlements (
  user_id,
  source,
  status,
  plan,
  is_active,
  started_at,
  ends_at,
  trial_started_at,
  trial_ends_at,
  metadata
)
SELECT
  r.user_id,
  'promo_code',
  CASE WHEN r.granted_until > now() THEN 'active' ELSE 'expired' END,
  'promo',
  r.granted_until > now(),
  r.redeemed_at,
  r.granted_until,
  NULL,
  NULL,
  jsonb_strip_nulls(jsonb_build_object(
    'backfilled_from', 'promo_code_redemptions',
    'redeemed_code', r.redeemed_code
  ))
FROM public.promo_code_redemptions r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.user_id = r.user_id
    AND s.current_period_end > now()
    AND s.status = ANY (ARRAY['active', 'trialing', 'past_due', 'cancelled'])
    AND COALESCE(s.source, 'receipt') <> 'promo_code'
)
ON CONFLICT (user_id) DO UPDATE
SET
  source = EXCLUDED.source,
  status = EXCLUDED.status,
  plan = EXCLUDED.plan,
  is_active = EXCLUDED.is_active,
  started_at = COALESCE(public.account_entitlements.started_at, EXCLUDED.started_at),
  ends_at = GREATEST(COALESCE(public.account_entitlements.ends_at, EXCLUDED.ends_at), EXCLUDED.ends_at),
  metadata = public.account_entitlements.metadata || EXCLUDED.metadata,
  updated_at = now()
WHERE public.account_entitlements.source <> 'subscription'
   OR public.account_entitlements.is_active = false;

INSERT INTO public.account_entitlements (
  user_id,
  source,
  status,
  plan,
  is_active,
  started_at,
  ends_at,
  trial_started_at,
  trial_ends_at,
  billing_customer_id,
  metadata
)
SELECT
  p.id,
  CASE
    WHEN p.trial_started_at IS NOT NULL OR p.trial_ends_at IS NOT NULL THEN 'trial'
    WHEN COALESCE(p.is_premium, false) THEN 'manual'
    ELSE 'none'
  END,
  CASE
    WHEN p.subscription_status = ANY (ARRAY['active', 'trialing', 'cancelled', 'past_due', 'expired', 'inactive', 'incomplete'])
      THEN p.subscription_status
    WHEN p.trial_ends_at IS NOT NULL AND p.trial_ends_at > now() THEN 'trialing'
    WHEN p.trial_ends_at IS NOT NULL THEN 'expired'
    WHEN COALESCE(p.is_premium, false) THEN 'active'
    ELSE 'inactive'
  END,
  CASE
    WHEN COALESCE(p.is_premium, false) THEN 'trial'
    ELSE NULL
  END,
  CASE
    WHEN p.subscription_expires_at IS NOT NULL THEN p.subscription_expires_at > now()
    WHEN p.trial_ends_at IS NOT NULL THEN p.trial_ends_at > now()
    ELSE COALESCE(p.is_premium, false)
  END,
  COALESCE(p.subscription_started_at, p.trial_started_at, p.created_at),
  COALESCE(p.subscription_expires_at, p.trial_ends_at),
  p.trial_started_at,
  p.trial_ends_at,
  p.stripe_customer_id,
  jsonb_strip_nulls(jsonb_build_object('backfilled_from', 'profiles'))
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.account_entitlements ae
  WHERE ae.user_id = p.id
)
AND (
  p.trial_started_at IS NOT NULL
  OR p.trial_ends_at IS NOT NULL
  OR p.subscription_status IS NOT NULL
  OR p.subscription_started_at IS NOT NULL
  OR p.subscription_expires_at IS NOT NULL
  OR p.stripe_customer_id IS NOT NULL
  OR COALESCE(p.is_premium, false)
);

-- ---------------------------------------------------------------------------
-- Promo-code access should update the private entitlement snapshot, not profiles.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_promo_code_secure(
  p_user_id UUID,
  p_promo_code TEXT
)
RETURNS TABLE(success BOOLEAN, status TEXT, message TEXT, access_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_code TEXT := UPPER(TRIM(COALESCE(p_promo_code, '')));
  v_promo RECORD;
  v_existing_redemption RECORD;
  v_granted_until TIMESTAMPTZ;
  v_active_subscription RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN QUERY SELECT false, 'unauthorized'::TEXT, 'Unauthorized request'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_code = '' THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Enter a valid promo code'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT id, granted_until
  INTO v_existing_redemption
  FROM public.promo_code_redemptions
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'used'::TEXT,
      'A promo code has already been redeemed for this account'::TEXT,
      v_existing_redemption.granted_until;
    RETURN;
  END IF;

  SELECT id
  INTO v_active_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status IN ('active', 'trialing')
    AND current_period_end > v_now
    AND COALESCE(source, 'receipt') <> 'promo_code'
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      'already_active'::TEXT,
      'Your account already has an active subscription'::TEXT,
      NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT *
  INTO v_promo
  FROM public.promo_codes
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND OR v_promo.is_active IS NOT TRUE THEN
    RETURN QUERY SELECT false, 'invalid'::TEXT, 'Invalid promo code'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < v_now THEN
    RETURN QUERY SELECT false, 'expired'::TEXT, 'This promo code has expired'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_promo.max_redemptions IS NOT NULL AND v_promo.redeemed_count >= v_promo.max_redemptions THEN
    RETURN QUERY SELECT false, 'used'::TEXT, 'This promo code has reached its redemption limit'::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_granted_until := v_now + make_interval(days => GREATEST(COALESCE(v_promo.grant_days, 30), 1));

  INSERT INTO public.promo_code_redemptions (
    promo_code_id,
    user_id,
    redeemed_code,
    redeemed_at,
    granted_until
  ) VALUES (
    v_promo.id,
    p_user_id,
    v_code,
    v_now,
    v_granted_until
  );

  UPDATE public.promo_codes
  SET
    redeemed_count = redeemed_count + 1,
    updated_at = v_now
  WHERE id = v_promo.id;

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
  VALUES (
    p_user_id,
    'promo_code',
    'active',
    'promo',
    true,
    v_now,
    v_granted_until,
    jsonb_build_object(
      'promo_code_id', v_promo.id,
      'redeemed_code', v_code
    )
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    source = 'promo_code',
    status = 'active',
    plan = 'promo',
    is_active = true,
    started_at = COALESCE(public.account_entitlements.started_at, v_now),
    ends_at = GREATEST(COALESCE(public.account_entitlements.ends_at, v_now), v_granted_until),
    metadata = public.account_entitlements.metadata || jsonb_build_object(
      'promo_code_id', v_promo.id,
      'redeemed_code', v_code
    ),
    updated_at = v_now
  WHERE public.account_entitlements.source <> 'subscription'
     OR public.account_entitlements.is_active = false;

  RETURN QUERY SELECT true, 'success'::TEXT, 'Promo code applied successfully'::TEXT, v_granted_until;
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'used'::TEXT, 'A promo code has already been redeemed for this account'::TEXT, NULL::TIMESTAMPTZ;
END;
$$;

-- ---------------------------------------------------------------------------
-- Planner usage counts belong in a private table, not in preferences.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_planning_usage (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  times_used INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_daily_planning_usage_updated_at
BEFORE UPDATE ON public.daily_planning_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.daily_planning_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage daily planning usage" ON public.daily_planning_usage;
CREATE POLICY "Service role can manage daily planning usage"
ON public.daily_planning_usage
FOR ALL
USING (public.is_service_role())
WITH CHECK (public.is_service_role());

INSERT INTO public.daily_planning_usage (
  user_id,
  times_used,
  last_used_at
)
SELECT
  user_id,
  COALESCE(times_used, 0),
  last_used_at
FROM public.daily_planning_preferences
ON CONFLICT (user_id) DO UPDATE
SET
  times_used = EXCLUDED.times_used,
  last_used_at = EXCLUDED.last_used_at,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- AI interaction / learning tables are server-managed only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own AI interactions" ON public.ai_interactions;
DROP POLICY IF EXISTS "Users can create their own AI interactions" ON public.ai_interactions;
DROP POLICY IF EXISTS "Users can update their own AI interactions" ON public.ai_interactions;
DROP POLICY IF EXISTS "Users can view their own AI learning profile" ON public.user_ai_learning;
DROP POLICY IF EXISTS "Users can create their own AI learning profile" ON public.user_ai_learning;
DROP POLICY IF EXISTS "Users can update their own AI learning profile" ON public.user_ai_learning;

DROP POLICY IF EXISTS "Service role can manage AI interactions" ON public.ai_interactions;
CREATE POLICY "Service role can manage AI interactions"
ON public.ai_interactions
FOR ALL
USING (public.is_service_role())
WITH CHECK (public.is_service_role());

DROP POLICY IF EXISTS "Service role can manage AI learning" ON public.user_ai_learning;
CREATE POLICY "Service role can manage AI learning"
ON public.user_ai_learning
FOR ALL
USING (public.is_service_role())
WITH CHECK (public.is_service_role());

-- ---------------------------------------------------------------------------
-- Admin flags should stay readable to admins but writable only by service role.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Service role can manage user roles" ON public.user_roles;

CREATE POLICY "Service role can manage user roles"
ON public.user_roles
FOR ALL
USING (public.is_service_role())
WITH CHECK (public.is_service_role());

-- ---------------------------------------------------------------------------
-- Drop obsolete profile access columns and rebuild the restricted update policy.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS set_trial_on_profile_create ON public.profiles;
DROP FUNCTION IF EXISTS public.set_trial_end_date();

DROP POLICY IF EXISTS "Users can update own profile (restricted)" ON public.profiles;

ALTER TABLE public.daily_planning_preferences
  DROP COLUMN IF EXISTS times_used,
  DROP COLUMN IF EXISTS last_used_at;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS is_premium,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_started_at,
  DROP COLUMN IF EXISTS subscription_expires_at,
  DROP COLUMN IF EXISTS trial_started_at,
  DROP COLUMN IF EXISTS trial_ends_at;

CREATE POLICY "Users can update own profile (restricted)"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id AND auth.uid() IS NOT NULL)
WITH CHECK (
  auth.uid() = id
  AND auth.uid() IS NOT NULL
  AND referral_count IS NOT DISTINCT FROM (
    SELECT p.referral_count FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND referral_code IS NOT DISTINCT FROM (
    SELECT p.referral_code FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND referred_by IS NOT DISTINCT FROM (
    SELECT p.referred_by FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND referred_by_code IS NOT DISTINCT FROM (
    SELECT p.referred_by_code FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_freezes_available IS NOT DISTINCT FROM (
    SELECT p.streak_freezes_available FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_freezes_reset_at IS NOT DISTINCT FROM (
    SELECT p.streak_freezes_reset_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND last_streak_freeze_used IS NOT DISTINCT FROM (
    SELECT p.last_streak_freeze_used FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND life_status IS NOT DISTINCT FROM (
    SELECT p.life_status FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND life_status_expires_at IS NOT DISTINCT FROM (
    SELECT p.life_status_expires_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND life_status_set_at IS NOT DISTINCT FROM (
    SELECT p.life_status_set_at FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND current_habit_streak IS NOT DISTINCT FROM (
    SELECT p.current_habit_streak FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND longest_habit_streak IS NOT DISTINCT FROM (
    SELECT p.longest_habit_streak FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND last_encounter_quest_count IS NOT DISTINCT FROM (
    SELECT p.last_encounter_quest_count FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND last_weekly_encounter IS NOT DISTINCT FROM (
    SELECT p.last_weekly_encounter FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND next_encounter_quest_count IS NOT DISTINCT FROM (
    SELECT p.next_encounter_quest_count FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_at_risk IS NOT DISTINCT FROM (
    SELECT p.streak_at_risk FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND streak_at_risk_since IS NOT DISTINCT FROM (
    SELECT p.streak_at_risk_since FROM public.profiles p WHERE p.id = auth.uid()
  )
  AND total_quests_completed IS NOT DISTINCT FROM (
    SELECT p.total_quests_completed FROM public.profiles p WHERE p.id = auth.uid()
  )
);
