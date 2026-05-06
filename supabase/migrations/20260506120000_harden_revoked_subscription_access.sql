-- Treat cancelled_at as an immediate revocation marker for entitlement snapshots.
-- Paid-through auto-renew cancellations use cancel_at without cancelled_at.

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
    NEW.cancelled_at IS NULL
    AND NEW.current_period_end > now()
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
    CASE WHEN NEW.cancelled_at IS NOT NULL THEN NEW.cancelled_at ELSE NEW.current_period_end END,
    COALESCE(NEW.current_period_start, now()),
    NEW.trial_ends_at,
    NEW.stripe_customer_id,
    NEW.stripe_subscription_id,
    jsonb_strip_nulls(jsonb_build_object(
      'environment', NEW.environment,
      'subscription_source', NEW.source,
      'cancelled_at', NEW.cancelled_at
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
