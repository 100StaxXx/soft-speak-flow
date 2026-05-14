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
};

function createMockSupabase(state: MockState) {
  return {
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
                  const row = state[table].find((entry) => entry[column] === value) ?? null;
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
                      const index = state[table].findIndex((entry) => entry[column] === value);
                      if (index < 0) {
                        return { data: null, error: new Error(`Missing ${String(table)} row`) };
                      }

                      state[table][index] = { ...state[table][index], ...payload };
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
                  const key = table === "account_entitlements" ? "user_id" : "id";
                  const index = state[table].findIndex((entry) => entry[key] === payload[key]);
                  if (index >= 0) {
                    state[table][index] = { ...state[table][index], ...payload };
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
  };
  const supabase = createMockSupabase(state);

  const response = await manageAppleBindingModule.handleManageAppleSubscriptionBinding(
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
      now: () => new Date("2026-05-14T00:00:00.000Z"),
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
    (binding.metadata as Record<string, any>).apple_binding_admin_transfer.target_user_id ===
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
  assert(previousEntitlement?.status === "transferred", "Expected previous entitlement to be marked transferred");
  assert(previousEntitlement?.is_active === false, "Expected previous entitlement to be inactive");

  const targetEntitlement = state.account_entitlements.find((entry) =>
    entry.user_id === "22222222-2222-4222-8222-222222222222"
  );
  assert(targetEntitlement?.source === "subscription", "Expected target subscription entitlement");
  assert(targetEntitlement?.is_active === true, "Expected target entitlement to be active");
});
