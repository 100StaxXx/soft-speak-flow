function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const manageAppleBindingModule = await import("./index.ts");

type MockState = {
  apple_transaction_bindings: Record<string, unknown>[];
  subscriptions: Record<string, unknown>[];
  profiles: Record<string, unknown>[];
  account_entitlements: Record<string, unknown>[];
  payment_history: Record<string, unknown>[];
};

function createMockSupabase(state: MockState) {
  return {
    async rpc(functionName: string, args: Record<string, unknown>) {
      if (functionName !== "admin_reassign_apple_subscription_binding") {
        throw new Error(`Unexpected rpc: ${functionName}`);
      }

      const originalTransactionId = args.p_original_transaction_id;
      const targetUserId = args.p_target_user_id;
      const adminUserId = args.p_admin_user_id;
      const reason = args.p_reason;
      const nowIso = "2026-05-14T00:00:00.000Z";

      const binding = state.apple_transaction_bindings.find((entry) =>
        entry.original_transaction_id === originalTransactionId
      );
      if (!binding) {
        return {
          data: null,
          error: new Error("Apple transaction binding not found"),
        };
      }

      const targetUser = state.profiles.find((entry) =>
        entry.id === targetUserId
      );
      if (!targetUser) {
        return { data: null, error: new Error("Target user not found") };
      }

      let previousBoundUserId = binding.bound_user_id;
      let previousUserId = previousBoundUserId;
      const previousAppAccountToken = binding.app_account_token;
      const subscription = state.subscriptions.find((entry) =>
        entry.stripe_subscription_id === originalTransactionId
      );

      if (subscription && subscription.user_id !== targetUserId) {
        previousUserId = subscription.user_id;
      }

      const transferMetadata =
        (binding.metadata as Record<string, any> | undefined)
          ?.apple_binding_admin_transfer;
      if (binding.bound_user_id === targetUserId && transferMetadata) {
        if (typeof transferMetadata.previous_bound_user_id === "string") {
          previousBoundUserId = transferMetadata.previous_bound_user_id;
        }
        if (
          typeof transferMetadata.previous_subscription_user_id === "string"
        ) {
          previousUserId = transferMetadata.previous_subscription_user_id;
        } else {
          previousUserId = previousBoundUserId;
        }
      }

      const migratePaymentHistory = () => {
        let migrated = 0;
        for (const payment of state.payment_history) {
          const paymentMetadata = payment.metadata as
            | Record<string, unknown>
            | undefined;
          const matchesPayment =
            (subscription && payment.subscription_id === subscription.id) ||
            payment.apple_original_transaction_id === originalTransactionId ||
            paymentMetadata?.original_transaction_id ===
              originalTransactionId ||
            payment.stripe_payment_intent_id ===
              binding.latest_transaction_id ||
            payment.stripe_invoice_id === binding.latest_transaction_id;
          const needsMigration = payment.user_id !== targetUserId ||
            (subscription && payment.subscription_id !== subscription.id) ||
            payment.apple_original_transaction_id !== originalTransactionId ||
            paymentMetadata?.original_transaction_id !==
              originalTransactionId ||
            paymentMetadata?.apple_binding_transfer_status !== "transferred";
          if (matchesPayment && needsMigration) {
            payment.user_id = targetUserId;
            if (subscription) payment.subscription_id = subscription.id;
            payment.apple_original_transaction_id = originalTransactionId;
            payment.metadata = {
              ...(payment.metadata as Record<string, unknown> | undefined),
              original_transaction_id: originalTransactionId,
              apple_binding_transfer_status: "transferred",
            };
            payment.updated_at = nowIso;
            migrated += 1;
          }
        }
        return migrated;
      };

      const revokePreviousAccess = () => {
        let previousAccessRevoked = false;
        for (const entitlement of state.account_entitlements) {
          const shouldRevoke = entitlement.user_id !== targetUserId &&
            (entitlement.user_id === previousUserId ||
              entitlement.user_id === previousBoundUserId) &&
            entitlement.source === "subscription" &&
            (entitlement.billing_subscription_id === originalTransactionId ||
              entitlement.billing_customer_id === originalTransactionId ||
              !state.subscriptions.some((subscriptionEntry) =>
                subscriptionEntry.user_id === entitlement.user_id
              ));
          if (shouldRevoke) {
            entitlement.status = "inactive";
            entitlement.is_active = false;
            entitlement.ends_at = nowIso;
            entitlement.metadata = {
              ...(entitlement.metadata as Record<string, unknown> | undefined),
              apple_binding_transfer_status: "transferred_away",
              transferred_to_user_id: targetUserId,
              transfer_admin_user_id: adminUserId,
              transfer_reason: reason,
              transferred_at: nowIso,
              original_transaction_id: originalTransactionId,
            };
            previousAccessRevoked = true;
          }
        }
        return previousAccessRevoked;
      };

      const targetSubscription = state.subscriptions.find((entry) =>
        entry.user_id === targetUserId
      );
      if (
        targetSubscription &&
        (!subscription || targetSubscription.id !== subscription.id)
      ) {
        return {
          data: null,
          error: new Error(
            "Target user already has a subscription row. Resolve the existing subscription before transfer.",
          ),
        };
      }

      if (
        binding.bound_user_id === targetUserId &&
        (!subscription || subscription.user_id === targetUserId)
      ) {
        const previousAccessRevoked = revokePreviousAccess();
        const paymentHistoryMigrated = migratePaymentHistory();
        return {
          data: {
            success: true,
            idempotent: true,
            binding,
            subscription: subscription ?? null,
            subscriptionMigrated: false,
            previousAccessRevoked,
            paymentHistoryMigrated,
            targetUser,
          },
          error: null,
        };
      }

      let subscriptionMigrated = false;
      if (subscription && subscription.user_id !== targetUserId) {
        subscription.user_id = targetUserId;
        subscription.updated_at = nowIso;
        subscriptionMigrated = true;
      }

      const previousAccessRevoked = revokePreviousAccess();

      if (subscription) {
        const targetEntitlement = {
          user_id: targetUserId,
          source: "subscription",
          status: subscription.status,
          plan: subscription.plan,
          is_active: true,
          started_at: subscription.current_period_start,
          ends_at: subscription.current_period_end,
          billing_customer_id: originalTransactionId,
          billing_subscription_id: originalTransactionId,
          metadata: {
            apple_binding_transfer_status: "transferred_in",
            transferred_from_user_id: previousUserId,
            transfer_admin_user_id: adminUserId,
            transfer_reason: reason,
            transferred_at: nowIso,
            original_transaction_id: originalTransactionId,
          },
        };
        const existingTargetIndex = state.account_entitlements.findIndex((
          entry,
        ) => entry.user_id === targetUserId);
        if (existingTargetIndex >= 0) {
          state.account_entitlements[existingTargetIndex] = {
            ...state.account_entitlements[existingTargetIndex],
            ...targetEntitlement,
          };
        } else {
          state.account_entitlements.push(targetEntitlement);
        }
      }

      const paymentHistoryMigrated = migratePaymentHistory();

      binding.bound_user_id = targetUserId;
      binding.app_account_token = previousAppAccountToken;
      binding.metadata = {
        ...(binding.metadata as Record<string, unknown> | undefined),
        apple_binding_admin_transfer: {
          previous_bound_user_id: previousBoundUserId,
          previous_subscription_user_id: previousUserId !== previousBoundUserId
            ? previousUserId
            : null,
          target_user_id: targetUserId,
          previous_app_account_token: previousAppAccountToken,
          transfer_admin_user_id: adminUserId,
          transfer_reason: reason,
          transferred_at: nowIso,
        },
      };
      binding.last_verified_at = nowIso;

      return {
        data: {
          success: true,
          binding,
          subscription: subscription ?? null,
          subscriptionMigrated,
          previousAccessRevoked,
          paymentHistoryMigrated,
          targetUser,
        },
        error: null,
      };
    },
    from(table: keyof MockState) {
      if (!(table in state)) {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select() {
          return {
            eq(column: string, value: unknown) {
              return {
                async maybeSingle() {
                  const row =
                    state[table].find((entry) => entry[column] === value) ??
                      null;
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              return {
                select() {
                  return {
                    async single() {
                      const index = state[table].findIndex((entry) =>
                        entry[column] === value
                      );
                      if (index < 0) {
                        return {
                          data: null,
                          error: new Error(`Missing ${String(table)} row`),
                        };
                      }

                      state[table][index] = {
                        ...state[table][index],
                        ...payload,
                      };
                      return { data: state[table][index], error: null };
                    },
                  };
                },
              };
            },
          };
        },
        upsert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                async maybeSingle() {
                  const key = table === "account_entitlements"
                    ? "user_id"
                    : "id";
                  const index = state[table].findIndex((entry) =>
                    entry[key] === payload[key]
                  );
                  if (index >= 0) {
                    state[table][index] = {
                      ...state[table][index],
                      ...payload,
                    };
                    return { data: state[table][index], error: null };
                  }

                  state[table].push(payload);
                  return { data: payload, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

Deno.test("manage-apple-subscription-binding reassigns a verified purchase to a support-verified target user", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "11111111-1111-4111-8111-111111111111",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [
      {
        id: "sub-1",
        user_id: "11111111-1111-4111-8111-111111111111",
        stripe_subscription_id: "orig-1",
        stripe_customer_id: "orig-1",
        plan: "yearly",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2027-05-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        source: "subscription",
        status: "active",
        plan: "yearly",
        is_active: true,
        ends_at: "2027-05-01T00:00:00.000Z",
        billing_customer_id: "orig-1",
        billing_subscription_id: "orig-1",
        metadata: {},
      },
    ],
    payment_history: [
      {
        id: "payment-1",
        user_id: "11111111-1111-4111-8111-111111111111",
        subscription_id: "sub-1",
        stripe_payment_intent_id: "tx-1",
        stripe_invoice_id: "tx-1",
      },
    ],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  const payload = await response.json();
  assert(payload.success === true, "Expected success response");

  const binding = state.apple_transaction_bindings[0];
  assert(
    binding.bound_user_id === "22222222-2222-4222-8222-222222222222",
    "Expected binding to move to target user",
  );
  assert(
    binding.app_account_token === "11111111-1111-4111-8111-111111111111",
    "Expected original Apple app account token to be preserved",
  );
  assert(
    (binding.metadata as Record<string, any>).apple_binding_admin_transfer
      .target_user_id ===
      "22222222-2222-4222-8222-222222222222",
    "Expected transfer metadata for future restores",
  );

  assert(
    state.subscriptions[0].user_id === "22222222-2222-4222-8222-222222222222",
    "Expected subscription row to move to target user",
  );

  const previousEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "11111111-1111-4111-8111-111111111111"
  );
  assert(
    previousEntitlement?.status === "inactive",
    "Expected previous entitlement to be marked inactive",
  );
  assert(
    previousEntitlement?.is_active === false,
    "Expected previous entitlement to be inactive",
  );

  const targetEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "22222222-2222-4222-8222-222222222222"
  );
  assert(
    targetEntitlement?.source === "subscription",
    "Expected target subscription entitlement",
  );
  assert(
    targetEntitlement?.is_active === true,
    "Expected target entitlement to be active",
  );

  assert(
    state.payment_history[0].user_id === "22222222-2222-4222-8222-222222222222",
    "Expected payment history to move to target user",
  );
});

Deno.test("manage-apple-subscription-binding rejects a missing-source transfer when the target already has a subscription", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "11111111-1111-4111-8111-111111111111",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [
      {
        id: "sub-target",
        user_id: "22222222-2222-4222-8222-222222222222",
        stripe_subscription_id: "orig-target",
        stripe_customer_id: "orig-target",
        plan: "monthly",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2026-06-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [],
    payment_history: [],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 409, `Expected 409, got ${response.status}`);
  const payload = await response.json();
  assert(
    typeof payload.error === "string" &&
      payload.error.includes("Target user already has a subscription row"),
    "Expected target subscription conflict",
  );
  assert(
    state.apple_transaction_bindings[0].bound_user_id ===
      "11111111-1111-4111-8111-111111111111",
    "Expected binding to remain with the original user",
  );
});

Deno.test("manage-apple-subscription-binding rejects an idempotent-looking transfer when the target already has another subscription", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "22222222-2222-4222-8222-222222222222",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [
      {
        id: "sub-target",
        user_id: "22222222-2222-4222-8222-222222222222",
        stripe_subscription_id: "orig-target",
        stripe_customer_id: "orig-target",
        plan: "monthly",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2026-06-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [],
    payment_history: [],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 409, `Expected 409, got ${response.status}`);
});

Deno.test("manage-apple-subscription-binding keeps successful reassignments idempotent", async () => {
  const transferMetadata = {
    previous_bound_user_id: "11111111-1111-4111-8111-111111111111",
    target_user_id: "22222222-2222-4222-8222-222222222222",
    previous_app_account_token: "11111111-1111-4111-8111-111111111111",
    transfer_admin_user_id: "33333333-3333-4333-8333-333333333333",
    transfer_reason: "Verified duplicate account support ticket",
    transferred_at: "2026-05-14T00:00:00.000Z",
  };
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "22222222-2222-4222-8222-222222222222",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {
          apple_binding_admin_transfer: transferMetadata,
        },
      },
    ],
    subscriptions: [
      {
        id: "sub-1",
        user_id: "22222222-2222-4222-8222-222222222222",
        stripe_subscription_id: "orig-1",
        stripe_customer_id: "orig-1",
        plan: "yearly",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2027-05-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        source: "subscription",
        status: "active",
        plan: "yearly",
        is_active: true,
        ends_at: "2027-05-01T00:00:00.000Z",
        billing_customer_id: null,
        billing_subscription_id: null,
        metadata: {},
      },
    ],
    payment_history: [
      {
        id: "payment-1",
        user_id: "22222222-2222-4222-8222-222222222222",
        subscription_id: "sub-1",
        stripe_payment_intent_id: "tx-1",
        stripe_invoice_id: "tx-1",
      },
    ],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  const payload = await response.json();
  assert(payload.idempotent === true, "Expected idempotent no-op response");
  assert(
    payload.paymentHistoryMigrated === 1,
    "Expected idempotent repair to stamp payment history metadata",
  );
  assert(
    payload.previousAccessRevoked === true,
    "Expected idempotent repair to revoke stale previous access",
  );
  assert(
    (state.apple_transaction_bindings[0].metadata as Record<string, any>)
      .apple_binding_admin_transfer
      .previous_bound_user_id === "11111111-1111-4111-8111-111111111111",
    "Expected original transfer metadata to be preserved",
  );
  assert(
    state.payment_history[0].user_id === "22222222-2222-4222-8222-222222222222",
    "Expected idempotent repair to keep payment history on the target user",
  );
  assert(
    state.payment_history[0].apple_original_transaction_id === "orig-1",
    "Expected idempotent repair to stamp the original transaction id",
  );
  const previousEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "11111111-1111-4111-8111-111111111111"
  );
  assert(
    previousEntitlement?.status === "inactive",
    "Expected idempotent repair to revoke the prior owner entitlement",
  );
});

Deno.test("manage-apple-subscription-binding migrates orphaned payment history without a subscription row", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "11111111-1111-4111-8111-111111111111",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [],
    payment_history: [
      {
        id: "payment-1",
        user_id: "11111111-1111-4111-8111-111111111111",
        subscription_id: null,
        stripe_payment_intent_id: "tx-1",
        stripe_invoice_id: "tx-1",
      },
      {
        id: "payment-2",
        user_id: "11111111-1111-4111-8111-111111111111",
        subscription_id: null,
        apple_original_transaction_id: "orig-1",
        stripe_payment_intent_id: "tx-old",
        stripe_invoice_id: "tx-old",
      },
    ],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  const payload = await response.json();
  assert(
    payload.paymentHistoryMigrated === 2,
    "Expected orphaned payment history to move",
  );
  assert(
    state.payment_history[0].user_id === "22222222-2222-4222-8222-222222222222",
    "Expected orphaned payment history to move to target user",
  );
  assert(
    state.payment_history[0].subscription_id === null,
    "Expected orphaned payment history to remain unlinked until restore recreates the subscription row",
  );
  assert(
    state.payment_history[1].user_id === "22222222-2222-4222-8222-222222222222",
    "Expected older keyed payment history to move to target user",
  );
});

Deno.test("manage-apple-subscription-binding revokes stale previous subscription entitlement after migration", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "11111111-1111-4111-8111-111111111111",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [
      {
        id: "sub-1",
        user_id: "11111111-1111-4111-8111-111111111111",
        stripe_subscription_id: "orig-1",
        stripe_customer_id: "orig-1",
        plan: "yearly",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2027-05-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        source: "subscription",
        status: "active",
        plan: "yearly",
        is_active: true,
        ends_at: "2027-05-01T00:00:00.000Z",
        billing_customer_id: null,
        billing_subscription_id: null,
        metadata: {},
      },
    ],
    payment_history: [],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  const previousEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "11111111-1111-4111-8111-111111111111"
  );
  assert(
    previousEntitlement?.status === "inactive",
    "Expected stale previous entitlement to be revoked",
  );
  assert(
    previousEntitlement?.is_active === false,
    "Expected stale previous entitlement to be inactive",
  );
});

Deno.test("manage-apple-subscription-binding revokes stale previous entitlement without a subscription row", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "11111111-1111-4111-8111-111111111111",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        source: "subscription",
        status: "active",
        plan: "yearly",
        is_active: true,
        ends_at: "2027-05-01T00:00:00.000Z",
        billing_customer_id: null,
        billing_subscription_id: null,
        metadata: {},
      },
    ],
    payment_history: [],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  const previousEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "11111111-1111-4111-8111-111111111111"
  );
  assert(
    previousEntitlement?.status === "inactive",
    "Expected previous entitlement with no backing subscription to be revoked",
  );
});

Deno.test("manage-apple-subscription-binding revokes stale previous entitlement when subscription already belongs to target", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "11111111-1111-4111-8111-111111111111",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [
      {
        id: "sub-1",
        user_id: "22222222-2222-4222-8222-222222222222",
        stripe_subscription_id: "orig-1",
        stripe_customer_id: "orig-1",
        plan: "yearly",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2027-05-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        source: "subscription",
        status: "active",
        plan: "yearly",
        is_active: true,
        ends_at: "2027-05-01T00:00:00.000Z",
        billing_customer_id: null,
        billing_subscription_id: null,
        metadata: {},
      },
    ],
    payment_history: [],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  const previousEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "11111111-1111-4111-8111-111111111111"
  );
  assert(
    previousEntitlement?.status === "inactive",
    "Expected stale previous entitlement to be revoked even when subscription is already on target",
  );
});

Deno.test("manage-apple-subscription-binding revokes the subscription owner when binding and subscription owners diverge", async () => {
  const state: MockState = {
    apple_transaction_bindings: [
      {
        original_transaction_id: "orig-1",
        bound_user_id: "11111111-1111-4111-8111-111111111111",
        app_account_token: "11111111-1111-4111-8111-111111111111",
        latest_transaction_id: "tx-1",
        product_id: "cosmiq_premium_yearly",
        environment: "Production",
        metadata: {},
      },
    ],
    subscriptions: [
      {
        id: "sub-1",
        user_id: "44444444-4444-4444-8444-444444444444",
        stripe_subscription_id: "orig-1",
        stripe_customer_id: "orig-1",
        plan: "yearly",
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2027-05-01T00:00:00.000Z",
      },
    ],
    profiles: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        email: "target@example.com",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ],
    account_entitlements: [
      {
        user_id: "11111111-1111-4111-8111-111111111111",
        source: "subscription",
        status: "active",
        plan: "yearly",
        is_active: true,
        ends_at: "2027-05-01T00:00:00.000Z",
        billing_customer_id: "orig-1",
        billing_subscription_id: "orig-1",
        metadata: {},
      },
      {
        user_id: "44444444-4444-4444-8444-444444444444",
        source: "subscription",
        status: "active",
        plan: "yearly",
        is_active: true,
        ends_at: "2027-05-01T00:00:00.000Z",
        billing_customer_id: null,
        billing_subscription_id: null,
        metadata: {},
      },
    ],
    payment_history: [],
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule
    .handleManageAppleSubscriptionBinding(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "reassign",
          originalTransactionId: "orig-1",
          targetUserId: "22222222-2222-4222-8222-222222222222",
          reason: "Verified duplicate account support ticket",
        }),
      }),
      {
        createSupabaseClient: () => supabase as never,
        requireAdminRequestImpl: async () => ({
          userId: "33333333-3333-4333-8333-333333333333",
          isServiceRole: false,
        }),
      },
    );

  assert(response.status === 200, `Expected 200, got ${response.status}`);
  const bindingMetadata = state.apple_transaction_bindings[0]
    .metadata as Record<string, any>;
  assert(
    bindingMetadata.apple_binding_admin_transfer.previous_bound_user_id ===
      "11111111-1111-4111-8111-111111111111",
    "Expected binding audit metadata to preserve the previous binding owner",
  );
  assert(
    bindingMetadata.apple_binding_admin_transfer
      .previous_subscription_user_id ===
      "44444444-4444-4444-8444-444444444444",
    "Expected binding audit metadata to capture the subscription owner",
  );

  const bindingOwnerEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "11111111-1111-4111-8111-111111111111"
  );
  const subscriptionOwnerEntitlement = state.account_entitlements.find((
    entry,
  ) => entry.user_id === "44444444-4444-4444-8444-444444444444");
  assert(
    bindingOwnerEntitlement?.status === "inactive",
    "Expected previous binding owner entitlement with matching billing IDs to be revoked",
  );
  assert(
    subscriptionOwnerEntitlement?.status === "inactive",
    "Expected previous subscription owner entitlement to be revoked",
  );
});
