function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const premiumAccessModule = await import("./premiumAccess.ts");

function createPremiumAccessSupabase(options: {
  entitlement?: Record<string, unknown> | null;
  subscriptionCount?: number;
  subscriptionRows?: Record<string, unknown>[];
}) {
  return {
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
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          in() {
            return builder;
          },
          async gte() {
            const rows = options.subscriptionRows ??
              Array.from({ length: options.subscriptionCount ?? 0 }, (_, index) => ({
                id: `subscription-${index + 1}`,
                cancelled_at: null,
              }));
            return { data: rows, error: null };
          },
        };
        return builder;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

Deno.test("hasPremiumAccess grants active account entitlement", async () => {
  const hasAccess = await premiumAccessModule.hasPremiumAccess(
    createPremiumAccessSupabase({
      entitlement: {
        source: "subscription",
        is_active: true,
        ends_at: "2999-01-01T00:00:00.000Z",
      },
      subscriptionCount: 0,
    }),
    "user-1",
  );

  assert(hasAccess === true, "Expected active entitlement to grant premium access");
});

Deno.test("hasPremiumAccess falls back to active subscription rows", async () => {
  const hasAccess = await premiumAccessModule.hasPremiumAccess(
    createPremiumAccessSupabase({
      entitlement: null,
      subscriptionCount: 1,
    }),
    "user-1",
  );

  assert(hasAccess === true, "Expected subscription fallback to grant premium access");
});

Deno.test("hasPremiumAccess rejects revoked subscription fallback rows", async () => {
  const hasAccess = await premiumAccessModule.hasPremiumAccess(
    createPremiumAccessSupabase({
      entitlement: null,
      subscriptionRows: [
        {
          id: "subscription-1",
          cancelled_at: "2026-05-01T00:00:00.000Z",
        },
      ],
    }),
    "user-1",
  );

  assert(hasAccess === false, "Expected revoked subscription rows to deny premium access");
});

Deno.test("hasPremiumAccess rejects expired entitlement without subscription fallback", async () => {
  const hasAccess = await premiumAccessModule.hasPremiumAccess(
    createPremiumAccessSupabase({
      entitlement: {
        source: "subscription",
        is_active: true,
        ends_at: "2000-01-01T00:00:00.000Z",
      },
      subscriptionCount: 0,
    }),
    "user-1",
  );

  assert(hasAccess === false, "Expected expired entitlement to require an active subscription fallback");
});
