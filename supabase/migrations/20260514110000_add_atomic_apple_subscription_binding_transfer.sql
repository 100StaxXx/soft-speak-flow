-- Atomic support workflow for moving an App Store original transaction from
-- one Cosmiq account to another after support verifies ownership.

ALTER TABLE public.payment_history
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payment_history_apple_original_transaction_id
  ON public.payment_history (apple_original_transaction_id)
  WHERE apple_original_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_reassign_apple_subscription_binding(
  p_original_transaction_id TEXT,
  p_target_user_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_transaction_id TEXT := btrim(COALESCE(p_original_transaction_id, ''));
  v_reason TEXT := btrim(COALESCE(p_reason, ''));
  v_now TIMESTAMPTZ := now();
  v_binding public.apple_transaction_bindings%ROWTYPE;
  v_subscription public.subscriptions%ROWTYPE;
  v_target_subscription public.subscriptions%ROWTYPE;
  v_previous_bound_user_id UUID;
  v_previous_user_id UUID;
  v_previous_app_account_token UUID;
  v_subscription_found BOOLEAN := false;
  v_subscription_migrated BOOLEAN := false;
  v_previous_access_revoked BOOLEAN := false;
  v_previous_entitlements_revoked INTEGER := 0;
  v_payment_history_migrated INTEGER := 0;
  v_target_user JSONB;
  v_transfer_metadata JSONB;
  v_uuid_pattern TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF v_original_transaction_id = '' THEN
    RAISE EXCEPTION 'originalTransactionId is required';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'targetUserId is required';
  END IF;

  IF length(v_reason) < 8 THEN
    RAISE EXCEPTION 'A support reason of at least 8 characters is required';
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'email', COALESCE(p.email, u.email),
    'created_at', COALESCE(p.created_at, u.created_at)
  )
  INTO v_target_user
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = p_target_user_id;

  IF v_target_user IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  SELECT *
  INTO v_binding
  FROM public.apple_transaction_bindings
  WHERE original_transaction_id = v_original_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Apple transaction binding not found';
  END IF;

  v_previous_bound_user_id := v_binding.bound_user_id;
  v_previous_user_id := v_binding.bound_user_id;
  v_previous_app_account_token := v_binding.app_account_token;

  SELECT *
  INTO v_subscription
  FROM public.subscriptions
  WHERE stripe_subscription_id = v_original_transaction_id
  FOR UPDATE;

  v_subscription_found := FOUND;

  IF v_subscription_found AND v_subscription.user_id <> p_target_user_id THEN
    v_previous_user_id := v_subscription.user_id;
  END IF;

  SELECT *
  INTO v_target_subscription
  FROM public.subscriptions
  WHERE user_id = p_target_user_id
  FOR UPDATE;

  IF FOUND AND (NOT v_subscription_found OR v_target_subscription.id <> v_subscription.id) THEN
    RAISE EXCEPTION 'Target user already has a subscription row. Resolve the existing subscription before transfer.';
  END IF;

  IF v_binding.bound_user_id = p_target_user_id
    AND (NOT v_subscription_found OR v_subscription.user_id = p_target_user_id)
  THEN
    v_transfer_metadata := v_binding.metadata->'apple_binding_admin_transfer';
    IF jsonb_typeof(v_transfer_metadata) = 'object' THEN
      IF (v_transfer_metadata->>'previous_bound_user_id') ~* v_uuid_pattern THEN
        v_previous_bound_user_id := (v_transfer_metadata->>'previous_bound_user_id')::UUID;
      END IF;

      IF (v_transfer_metadata->>'previous_subscription_user_id') ~* v_uuid_pattern THEN
        v_previous_user_id := (v_transfer_metadata->>'previous_subscription_user_id')::UUID;
      ELSIF v_previous_bound_user_id IS NOT NULL THEN
        v_previous_user_id := v_previous_bound_user_id;
      END IF;
    END IF;

    IF (
      v_previous_user_id IS NOT NULL
      OR v_previous_bound_user_id IS NOT NULL
    ) THEN
      UPDATE public.account_entitlements AS ae
      SET
        source = 'subscription',
        status = 'inactive',
        is_active = false,
        ends_at = v_now,
        metadata = COALESCE(ae.metadata, '{}'::jsonb) || jsonb_build_object(
          'apple_binding_transfer_status', 'transferred_away',
          'transferred_to_user_id', p_target_user_id,
          'transfer_admin_user_id', p_admin_user_id,
          'transfer_reason', v_reason,
          'transferred_at', v_now,
          'original_transaction_id', v_original_transaction_id
        ),
        updated_at = v_now
      WHERE ae.user_id <> p_target_user_id
        AND (
          ae.user_id = v_previous_user_id
          OR ae.user_id = v_previous_bound_user_id
        )
        AND ae.source = 'subscription'
        AND (
          ae.billing_subscription_id = v_original_transaction_id
          OR ae.billing_customer_id = v_original_transaction_id
          OR (
            NOT EXISTS (
              SELECT 1
              FROM public.subscriptions s
              WHERE s.user_id = ae.user_id
            )
          )
        );

      GET DIAGNOSTICS v_previous_entitlements_revoked = ROW_COUNT;
      v_previous_access_revoked := v_previous_entitlements_revoked > 0;
    END IF;

    UPDATE public.payment_history
    SET
      user_id = p_target_user_id,
      subscription_id = CASE WHEN v_subscription_found THEN v_subscription.id ELSE subscription_id END,
      apple_original_transaction_id = v_original_transaction_id,
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'original_transaction_id', v_original_transaction_id,
        'apple_binding_transfer_status', 'transferred'
      ),
      updated_at = v_now
    WHERE (
        (
          v_subscription_found
          AND subscription_id = v_subscription.id
        )
        OR apple_original_transaction_id = v_original_transaction_id
        OR metadata->>'original_transaction_id' = v_original_transaction_id
        OR stripe_payment_intent_id = v_binding.latest_transaction_id
        OR stripe_invoice_id = v_binding.latest_transaction_id
      )
      AND (
        user_id <> p_target_user_id
        OR (
          v_subscription_found
          AND subscription_id IS DISTINCT FROM v_subscription.id
        )
        OR apple_original_transaction_id IS DISTINCT FROM v_original_transaction_id
        OR metadata->>'original_transaction_id' IS DISTINCT FROM v_original_transaction_id
        OR metadata->>'apple_binding_transfer_status' IS DISTINCT FROM 'transferred'
      );

    GET DIAGNOSTICS v_payment_history_migrated = ROW_COUNT;

    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'binding', to_jsonb(v_binding),
      'subscription', CASE WHEN v_subscription_found THEN to_jsonb(v_subscription) ELSE NULL END,
      'subscriptionMigrated', false,
      'previousAccessRevoked', v_previous_access_revoked,
      'paymentHistoryMigrated', v_payment_history_migrated,
      'targetUser', v_target_user
    );
  END IF;

  IF v_subscription_found AND v_subscription.user_id <> p_target_user_id THEN
    UPDATE public.subscriptions
    SET
      user_id = p_target_user_id,
      updated_at = v_now
    WHERE id = v_subscription.id
    RETURNING * INTO v_subscription;

    v_subscription_migrated := true;
  END IF;

  IF (
    v_previous_user_id IS NOT NULL
    OR v_previous_bound_user_id IS NOT NULL
  ) THEN
    UPDATE public.account_entitlements AS ae
    SET
      source = 'subscription',
      status = 'inactive',
      is_active = false,
      ends_at = v_now,
      metadata = COALESCE(ae.metadata, '{}'::jsonb) || jsonb_build_object(
        'apple_binding_transfer_status', 'transferred_away',
        'transferred_to_user_id', p_target_user_id,
        'transfer_admin_user_id', p_admin_user_id,
        'transfer_reason', v_reason,
        'transferred_at', v_now,
        'original_transaction_id', v_original_transaction_id
      ),
      updated_at = v_now
    WHERE ae.user_id <> p_target_user_id
      AND (
        ae.user_id = v_previous_user_id
        OR ae.user_id = v_previous_bound_user_id
      )
      AND ae.source = 'subscription'
      AND (
        ae.billing_subscription_id = v_original_transaction_id
        OR ae.billing_customer_id = v_original_transaction_id
        OR (
          NOT EXISTS (
            SELECT 1
            FROM public.subscriptions s
            WHERE s.user_id = ae.user_id
          )
        )
      );

    GET DIAGNOSTICS v_previous_entitlements_revoked = ROW_COUNT;
    v_previous_access_revoked := v_previous_entitlements_revoked > 0;
  END IF;

  IF v_subscription_found THEN
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
      metadata,
      updated_at
    )
    VALUES (
      p_target_user_id,
      'subscription',
      v_subscription.status,
      v_subscription.plan,
      v_subscription.current_period_end > v_now
        AND v_subscription.status = ANY (ARRAY['active', 'trialing', 'past_due', 'cancelled']),
      v_subscription.current_period_start,
      v_subscription.current_period_end,
      CASE WHEN v_subscription.status = 'trialing' THEN v_subscription.current_period_start ELSE NULL END,
      CASE WHEN v_subscription.status = 'trialing' THEN v_subscription.current_period_end ELSE NULL END,
      v_original_transaction_id,
      v_original_transaction_id,
      jsonb_build_object(
        'apple_binding_transfer_status', 'transferred_in',
        'transferred_from_user_id', v_previous_user_id,
        'transfer_admin_user_id', p_admin_user_id,
        'transfer_reason', v_reason,
        'transferred_at', v_now,
        'original_transaction_id', v_original_transaction_id
      ),
      v_now
    )
    ON CONFLICT (user_id) DO UPDATE
    SET
      source = EXCLUDED.source,
      status = EXCLUDED.status,
      plan = EXCLUDED.plan,
      is_active = EXCLUDED.is_active,
      started_at = EXCLUDED.started_at,
      ends_at = EXCLUDED.ends_at,
      trial_started_at = EXCLUDED.trial_started_at,
      trial_ends_at = EXCLUDED.trial_ends_at,
      billing_customer_id = EXCLUDED.billing_customer_id,
      billing_subscription_id = EXCLUDED.billing_subscription_id,
      metadata = COALESCE(public.account_entitlements.metadata, '{}'::jsonb) || EXCLUDED.metadata,
      updated_at = v_now;

  END IF;

  UPDATE public.payment_history
  SET
    user_id = p_target_user_id,
    subscription_id = CASE WHEN v_subscription_found THEN v_subscription.id ELSE subscription_id END,
    apple_original_transaction_id = v_original_transaction_id,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'original_transaction_id', v_original_transaction_id,
      'apple_binding_transfer_status', 'transferred'
    ),
    updated_at = v_now
  WHERE (
      (
        v_subscription_found
        AND subscription_id = v_subscription.id
      )
      OR apple_original_transaction_id = v_original_transaction_id
      OR metadata->>'original_transaction_id' = v_original_transaction_id
      OR stripe_payment_intent_id = v_binding.latest_transaction_id
      OR stripe_invoice_id = v_binding.latest_transaction_id
    )
    AND (
      user_id <> p_target_user_id
      OR (
        v_subscription_found
        AND subscription_id IS DISTINCT FROM v_subscription.id
      )
      OR apple_original_transaction_id IS DISTINCT FROM v_original_transaction_id
      OR metadata->>'original_transaction_id' IS DISTINCT FROM v_original_transaction_id
      OR metadata->>'apple_binding_transfer_status' IS DISTINCT FROM 'transferred'
    );

  GET DIAGNOSTICS v_payment_history_migrated = ROW_COUNT;

  v_transfer_metadata := jsonb_build_object(
    'previous_bound_user_id', v_previous_bound_user_id,
    'previous_subscription_user_id', CASE WHEN v_previous_user_id <> v_previous_bound_user_id THEN v_previous_user_id ELSE NULL END,
    'target_user_id', p_target_user_id,
    'previous_app_account_token', v_previous_app_account_token,
    'transfer_admin_user_id', p_admin_user_id,
    'transfer_reason', v_reason,
    'transferred_at', v_now
  );

  UPDATE public.apple_transaction_bindings
  SET
    bound_user_id = p_target_user_id,
    app_account_token = v_previous_app_account_token,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'apple_binding_admin_transfer', v_transfer_metadata
    ),
    last_verified_at = v_now
  WHERE original_transaction_id = v_original_transaction_id
  RETURNING * INTO v_binding;

  RETURN jsonb_build_object(
    'success', true,
    'binding', to_jsonb(v_binding),
    'subscription', CASE WHEN v_subscription_found THEN to_jsonb(v_subscription) ELSE NULL END,
    'subscriptionMigrated', v_subscription_migrated,
    'previousAccessRevoked', v_previous_access_revoked,
    'paymentHistoryMigrated', v_payment_history_migrated,
    'targetUser', v_target_user
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reassign_apple_subscription_binding(TEXT, UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reassign_apple_subscription_binding(TEXT, UUID, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
