import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const { enforceDailyTurnCap, hasVerifiedPremiumAccess } = await import("./index.ts");

function createTurnCapSupabase(count: number) {
  const queries: string[] = [];

  return {
    queries,
    supabase: {
      from(table: string) {
        queries.push(table);
        if (table !== "companion_chats") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select(_selection: string, options: { count?: string; head?: boolean }) {
            assertEquals(options, { count: "exact", head: true });
            return {
              eq(column: string, value: unknown) {
                assertEquals(column, "user_id");
                assertEquals(value, "user-1");
                return {
                  eq(roleColumn: string, role: unknown) {
                    assertEquals(roleColumn, "role");
                    assertEquals(role, "user");
                    return {
                      gte(dateColumn: string, value: unknown) {
                        assertEquals(dateColumn, "created_at");
                        assertEquals(typeof value, "string");
                        return Promise.resolve({ count, error: null });
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

function createPremiumAccessSupabase() {
  return {
    from(table: string) {
      if (table === "account_entitlements") {
        return {
          select: () => ({
            eq: (_column: string, userId: string) => ({
              maybeSingle: async () => ({
                data: {
                  user_id: userId,
                  source: "subscription",
                  status: "active",
                  plan: "yearly",
                  is_active: true,
                  ends_at: "2099-01-01T00:00:00.000Z",
                  trial_ends_at: null,
                },
                error: null,
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

Deno.test("enforceDailyTurnCap bypasses the daily cap for verified premium users", async () => {
  const mock = createTurnCapSupabase(40);

  const allowed = await enforceDailyTurnCap(mock.supabase, "user-1", {
    hasVerifiedPremiumAccess: true,
  });

  assertEquals(allowed, true);
  assertEquals(mock.queries, []);
});

Deno.test("enforceDailyTurnCap blocks non-premium users at the daily cap for DAILY_LIMIT_REACHED", async () => {
  const mock = createTurnCapSupabase(40);

  const allowed = await enforceDailyTurnCap(mock.supabase, "user-1", {
    hasVerifiedPremiumAccess: false,
  });

  assertEquals(allowed, false);
  assertEquals(mock.queries, ["companion_chats"]);
});

Deno.test("hasVerifiedPremiumAccess trusts active backend subscription entitlements", async () => {
  const allowed = await hasVerifiedPremiumAccess(createPremiumAccessSupabase(), "user-1");

  assertEquals(allowed, true);
});
