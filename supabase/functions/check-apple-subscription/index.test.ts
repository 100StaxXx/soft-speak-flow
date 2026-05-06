function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const checkAppleSubscriptionModule = await import("./index.ts");

function createTableClient(options: {
  entitlement?: Record<string, unknown> | null;
  subscription?: Record<string, unknown> | null;
  promoAccess?: Record<string, unknown> | null;
}) {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: { id: "user-1" },
        },
        error: null,
      }),
    },
    from(table: string) {
      if (table === "account_entitlements") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: options.entitlement ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "subscriptions") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: options.subscription ?? null, error: null };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "promo_code_redemptions") {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          gt() {
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return builder;
          },
          async maybeSingle() {
            return { data: options.promoAccess ?? null, error: null };
          },
        };
        return builder;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

Deno.test("check-apple-subscription falls through stale expired entitlement to active subscription", async () => {
  const response = await checkAppleSubscriptionModule.handleCheckAppleSubscription(
    new Request("http://localhost", {
      headers: { Authorization: "Bearer access-token" },
    }),
    {
      createSupabaseClient: () => createTableClient({
        entitlement: {
          user_id: "user-1",
          source: "subscription",
          status: "active",
          plan: "yearly",
          is_active: true,
          ends_at: "2000-01-01T00:00:00.000Z",
        },
        subscription: {
          status: "active",
          plan: "yearly",
          current_period_end: "2999-01-01T00:00:00.000Z",
          cancelled_at: null,
        },
      }) as never,
    },
  );

  assert(response.status === 200, `Expected 200 response, got ${response.status}`);
  const payload = await response.json();
  assert(payload.has_access === true, "Expected active subscription fallback to grant access");
  assert(payload.access_source === "subscription", `Expected subscription source, got ${payload.access_source}`);
});

Deno.test("check-apple-subscription returns stale entitlement denial when no fallback is active", async () => {
  const response = await checkAppleSubscriptionModule.handleCheckAppleSubscription(
    new Request("http://localhost", {
      headers: { Authorization: "Bearer access-token" },
    }),
    {
      createSupabaseClient: () => createTableClient({
        entitlement: {
          user_id: "user-1",
          source: "trial",
          status: "expired",
          plan: "trial",
          is_active: true,
          trial_ends_at: "2000-01-01T00:00:00.000Z",
        },
      }) as never,
    },
  );

  assert(response.status === 200, `Expected 200 response, got ${response.status}`);
  const payload = await response.json();
  assert(payload.has_access === false, "Expected expired entitlement to deny access without fallback");
  assert(payload.trial_ends_at === "2000-01-01T00:00:00.000Z", "Expected stale trial end to be preserved");
});
