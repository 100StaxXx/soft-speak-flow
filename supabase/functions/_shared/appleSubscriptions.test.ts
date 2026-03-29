function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const appleSubscriptionsModule = await import("./appleSubscriptions.ts");

function createBindingSupabase(initialRows: Record<string, unknown>[] = []) {
  const rows = [...initialRows];

  return {
    from(table: string) {
      if (table !== "apple_transaction_bindings") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select() {
          return {
            eq(column: string, value: unknown) {
              if (column !== "original_transaction_id") {
                throw new Error(`Unexpected select eq column: ${column}`);
              }

              return {
                async maybeSingle() {
                  const row = rows.find((entry) => entry.original_transaction_id === value) ?? null;
                  return { data: row, error: null };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          return {
            eq(column: string, value: unknown) {
              if (column !== "original_transaction_id") {
                throw new Error(`Unexpected update eq column: ${column}`);
              }

              return {
                select() {
                  return {
                    async single() {
                      const index = rows.findIndex((entry) => entry.original_transaction_id === value);
                      if (index < 0) {
                        return { data: null, error: new Error("missing binding") };
                      }

                      rows[index] = { ...rows[index], ...payload };
                      return { data: rows[index], error: null };
                    },
                  };
                },
              };
            },
          };
        },
        insert(payload: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  const existing = rows.find((entry) => entry.original_transaction_id === payload.original_transaction_id);
                  if (existing) {
                    return { data: null, error: new Error("duplicate key") };
                  }

                  rows.push(payload);
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

Deno.test("ensureAppleTransactionBinding creates the first binding when appAccountToken matches the user", async () => {
  const supabase = createBindingSupabase();
  const binding = await appleSubscriptionsModule.ensureAppleTransactionBinding(supabase, {
    userId: "11111111-1111-4111-8111-111111111111",
    transactionId: "tx-1",
    originalTransactionId: "orig-1",
    productId: "cosmiq_premium_monthly",
    appAccountToken: "11111111-1111-4111-8111-111111111111",
  });

  assert(binding.bound_user_id === "11111111-1111-4111-8111-111111111111", "Expected first binding to persist the owning user");
});

Deno.test("ensureAppleTransactionBinding rejects rebinding a purchase to another user", async () => {
  const supabase = createBindingSupabase([
    {
      original_transaction_id: "orig-1",
      bound_user_id: "11111111-1111-4111-8111-111111111111",
      app_account_token: "11111111-1111-4111-8111-111111111111",
      latest_transaction_id: "tx-1",
      product_id: "cosmiq_premium_monthly",
      environment: null,
      metadata: {},
    },
  ]);

  let error: unknown = null;
  try {
    await appleSubscriptionsModule.ensureAppleTransactionBinding(supabase, {
      userId: "22222222-2222-4222-8222-222222222222",
      transactionId: "tx-2",
      originalTransactionId: "orig-1",
      productId: "cosmiq_premium_monthly",
      appAccountToken: "22222222-2222-4222-8222-222222222222",
    });
  } catch (caught) {
    error = caught;
  }

  assert(
    error instanceof Error && error.message === appleSubscriptionsModule.APPLE_BINDING_CONFLICT_ERROR,
    "Expected conflicting rebind to be rejected",
  );
});

Deno.test("ensureAppleTransactionBinding rejects new bindings without an app-account token", async () => {
  const supabase = createBindingSupabase();

  let error: unknown = null;
  try {
    await appleSubscriptionsModule.ensureAppleTransactionBinding(supabase, {
      userId: "11111111-1111-4111-8111-111111111111",
      transactionId: "tx-1",
      originalTransactionId: "orig-1",
      productId: "cosmiq_premium_monthly",
      appAccountToken: null,
    });
  } catch (caught) {
    error = caught;
  }

  assert(
    error instanceof Error && error.message === appleSubscriptionsModule.APPLE_BINDING_MISSING_ERROR,
    "Expected missing app-account token to fail closed",
  );
});
