function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const appleSubscriptionsModule = await import("./appleSubscriptions.ts");

Deno.test("buildSubscriptionStatus preserves StoreKit introductory offers as trialing", () => {
  const futureExpiration = new Date("2099-01-01T00:00:00.000Z");

  assert(
    appleSubscriptionsModule.buildSubscriptionStatus(futureExpiration, null, 1) === "trialing",
    "Expected StoreKit introductory offer type 1 to remain trialing",
  );
  assert(
    appleSubscriptionsModule.buildSubscriptionStatus(futureExpiration, null, null) === "active",
    "Expected a normal paid renewal to remain active",
  );
});

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
                  const row =
                    rows.find((entry) =>
                      entry.original_transaction_id === value
                    ) ?? null;
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
                      const index = rows.findIndex((entry) =>
                        entry.original_transaction_id === value
                      );
                      if (index < 0) {
                        return {
                          data: null,
                          error: new Error("missing binding"),
                        };
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
                  const existing = rows.find((entry) =>
                    entry.original_transaction_id ===
                      payload.original_transaction_id
                  );
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

type SubscriptionMockTable =
  | "apple_transaction_bindings"
  | "subscriptions"
  | "account_entitlements"
  | "payment_history";

type SubscriptionMockState = Record<
  SubscriptionMockTable,
  Record<string, unknown>[]
>;

function createSubscriptionSupabase(
  initialState: Partial<SubscriptionMockState> = {},
) {
  const state: SubscriptionMockState = {
    apple_transaction_bindings: [
      ...(initialState.apple_transaction_bindings ?? []),
    ],
    subscriptions: [...(initialState.subscriptions ?? [])],
    account_entitlements: [...(initialState.account_entitlements ?? [])],
    payment_history: [...(initialState.payment_history ?? [])],
  };

  let nextSubscriptionId = state.subscriptions.length + 1;
  let nextPaymentId = state.payment_history.length + 1;

  function findRow(
    rows: Record<string, unknown>[],
    column: string,
    value: unknown,
  ) {
    return rows.find((entry) => entry[column] === value) ?? null;
  }

  function primaryKeyFor(
    table: SubscriptionMockTable,
    payload: Record<string, unknown>,
  ) {
    if (table === "subscriptions") return payload.user_id;
    if (table === "account_entitlements") return payload.user_id;
    if (table === "apple_transaction_bindings") {
      return payload.original_transaction_id;
    }
    return payload.id;
  }

  return {
    state,
    client: {
      from(table: SubscriptionMockTable) {
        if (!(table in state)) {
          throw new Error(`Unexpected table: ${table}`);
        }

        const rows = state[table];
        return {
          select() {
            return {
              eq(column: string, value: unknown) {
                return {
                  async maybeSingle() {
                    return { data: findRow(rows, column, value), error: null };
                  },
                  async single() {
                    const row = findRow(rows, column, value);
                    return row ? { data: row, error: null } : {
                      data: null,
                      error: new Error(`Missing ${table} row`),
                    };
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            const row = {
              ...payload,
              id: payload.id ??
                (table === "payment_history"
                  ? `payment-${nextPaymentId++}`
                  : payload.id),
            };
            rows.push(row);
            return {
              data: row,
              error: null,
              select() {
                return {
                  async single() {
                    return { data: row, error: null };
                  },
                };
              },
            };
          },
          update(payload: Record<string, unknown>) {
            return {
              eq(column: string, value: unknown) {
                for (let index = 0; index < rows.length; index += 1) {
                  if (rows[index][column] === value) {
                    rows[index] = { ...rows[index], ...payload };
                  }
                }
                return { data: null, error: null };
              },
            };
          },
          upsert(payload: Record<string, unknown>) {
            const key = primaryKeyFor(table, payload);
            const existingIndex = rows.findIndex((entry) =>
              primaryKeyFor(table, entry) === key
            );
            const row = {
              ...payload,
              id: payload.id ??
                (existingIndex >= 0
                  ? rows[existingIndex].id
                  : table === "subscriptions"
                  ? `subscription-${nextSubscriptionId++}`
                  : payload.id),
            };
            if (existingIndex >= 0) {
              rows[existingIndex] = { ...rows[existingIndex], ...row };
            } else {
              rows.push(row);
            }

            const data = existingIndex >= 0 ? rows[existingIndex] : row;
            return {
              select() {
                return {
                  async single() {
                    return { data, error: null };
                  },
                  async maybeSingle() {
                    return { data, error: null };
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

Deno.test("ensureAppleTransactionBinding creates the first binding when appAccountToken matches the user", async () => {
  const supabase = createBindingSupabase();
  const binding = await appleSubscriptionsModule.ensureAppleTransactionBinding(
    supabase,
    {
      userId: "11111111-1111-4111-8111-111111111111",
      transactionId: "tx-1",
      originalTransactionId: "orig-1",
      productId: "cosmiq_premium_monthly",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    },
  );

  assert(
    binding.bound_user_id === "11111111-1111-4111-8111-111111111111",
    "Expected first binding to persist the owning user",
  );
});

Deno.test("getPriceCents defaults eligible founding receipts to $29.99", () => {
  Deno.env.delete("APPLE_OFFER_CODE_YEARLY_PRICE_CENTS");
  Deno.env.delete("APPLE_OFFER_CODE_IDENTIFIER");
  Deno.env.delete("APPLE_GENESIS_OFFER_CODE_IDENTIFIER");

  const amountCents = appleSubscriptionsModule.getPriceCents("yearly", {
    offerIdentifier: "Referrals",
    offerType: null,
  });

  assert(amountCents === 2999, `Expected 2999 cents, got ${amountCents}`);
});

Deno.test("getPriceCents defaults Genesis founding receipts to $29.99", () => {
  Deno.env.delete("APPLE_GENESIS_OFFER_CODE_YEARLY_PRICE_CENTS");
  Deno.env.delete("APPLE_GENESIS_OFFER_CODE_IDENTIFIER");

  const amountCents = appleSubscriptionsModule.getPriceCents("yearly", {
    offerIdentifier: "GENESIS",
    offerType: null,
  });

  assert(amountCents === 2999, `Expected 2999 cents, got ${amountCents}`);
});

Deno.test("getPriceCents does not discount mismatched yearly offer-code receipts", () => {
  Deno.env.delete("APPLE_YEARLY_PRICE_CENTS");
  Deno.env.delete("APPLE_OFFER_CODE_YEARLY_PRICE_CENTS");
  Deno.env.delete("APPLE_OFFER_CODE_IDENTIFIER");
  Deno.env.delete("APPLE_GENESIS_OFFER_CODE_YEARLY_PRICE_CENTS");
  Deno.env.delete("APPLE_GENESIS_OFFER_CODE_IDENTIFIER");

  const amountCents = appleSubscriptionsModule.getPriceCents("yearly", {
    offerIdentifier: "Cosmiq_OfferCode_yearly",
    offerType: 3,
  });

  assert(amountCents === 4999, `Expected 4999 cents, got ${amountCents}`);
});

Deno.test("getPriceCents keeps standard yearly receipts at $49.99", () => {
  Deno.env.delete("APPLE_YEARLY_PRICE_CENTS");

  const amountCents = appleSubscriptionsModule.getPriceCents("yearly", {
    offerIdentifier: null,
    offerType: null,
  });

  assert(amountCents === 4999, `Expected 4999 cents, got ${amountCents}`);
});

Deno.test("getPriceCents recognizes the dedicated $29.99 founding product", () => {
  Deno.env.delete("APPLE_OFFER_CODE_YEARLY_PRICE_CENTS");

  const amountCents = appleSubscriptionsModule.getPriceCents("yearly", {
    productId: "graceward_plus_founder_yearly",
  });

  assert(amountCents === 2999, `Expected 2999 cents, got ${amountCents}`);
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
    error instanceof Error &&
      error.message === appleSubscriptionsModule.APPLE_BINDING_CONFLICT_ERROR,
    "Expected conflicting rebind to be rejected",
  );
});

Deno.test("ensureAppleTransactionBinding allows an admin-transferred purchase to restore with the original Apple token", async () => {
  const supabase = createBindingSupabase([
    {
      original_transaction_id: "orig-1",
      bound_user_id: "22222222-2222-4222-8222-222222222222",
      app_account_token: "11111111-1111-4111-8111-111111111111",
      latest_transaction_id: "tx-1",
      product_id: "cosmiq_premium_monthly",
      environment: null,
      metadata: {
        apple_binding_admin_transfer: {
          previous_bound_user_id: "11111111-1111-4111-8111-111111111111",
          target_user_id: "22222222-2222-4222-8222-222222222222",
          previous_app_account_token: "11111111-1111-4111-8111-111111111111",
          transfer_admin_user_id: "33333333-3333-4333-8333-333333333333",
          transfer_reason: "Verified duplicate account support transfer",
          transferred_at: "2026-05-14T00:00:00.000Z",
        },
      },
    },
  ]);

  const binding = await appleSubscriptionsModule.ensureAppleTransactionBinding(
    supabase,
    {
      userId: "22222222-2222-4222-8222-222222222222",
      transactionId: "tx-2",
      originalTransactionId: "orig-1",
      productId: "cosmiq_premium_monthly",
      appAccountToken: "11111111-1111-4111-8111-111111111111",
    },
  );

  assert(
    binding.bound_user_id === "22222222-2222-4222-8222-222222222222",
    "Expected transferred binding to remain with the target user",
  );
  assert(
    binding.latest_transaction_id === "tx-2",
    "Expected transferred binding to accept later restores",
  );
});

Deno.test("ensureAppleTransactionBinding normalizes an admin-transferred binding when Apple later returns the target token", async () => {
  const supabase = createBindingSupabase([
    {
      original_transaction_id: "orig-1",
      bound_user_id: "22222222-2222-4222-8222-222222222222",
      app_account_token: "11111111-1111-4111-8111-111111111111",
      latest_transaction_id: "tx-1",
      product_id: "cosmiq_premium_monthly",
      environment: null,
      metadata: {
        apple_binding_admin_transfer: {
          previous_bound_user_id: "11111111-1111-4111-8111-111111111111",
          target_user_id: "22222222-2222-4222-8222-222222222222",
          previous_app_account_token: "11111111-1111-4111-8111-111111111111",
          transfer_admin_user_id: "33333333-3333-4333-8333-333333333333",
          transfer_reason: "Verified duplicate account support transfer",
          transferred_at: "2026-05-14T00:00:00.000Z",
        },
      },
    },
  ]);

  const binding = await appleSubscriptionsModule.ensureAppleTransactionBinding(
    supabase,
    {
      userId: "22222222-2222-4222-8222-222222222222",
      transactionId: "tx-2",
      originalTransactionId: "orig-1",
      productId: "cosmiq_premium_monthly",
      appAccountToken: "22222222-2222-4222-8222-222222222222",
    },
  );

  assert(
    binding.app_account_token === "22222222-2222-4222-8222-222222222222",
    "Expected transferred binding to normalize to the target app-account token",
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
    error instanceof Error &&
      error.message === appleSubscriptionsModule.APPLE_BINDING_MISSING_ERROR,
    "Expected missing app-account token to fail closed",
  );
});

Deno.test("upsertSubscription stamps new payment history with the Apple original transaction id", async () => {
  const { client, state } = createSubscriptionSupabase();

  await appleSubscriptionsModule.upsertSubscription(client, {
    userId: "11111111-1111-4111-8111-111111111111",
    transactionId: "tx-1",
    originalTransactionId: "orig-1",
    productId: "cosmiq_premium_monthly",
    appAccountToken: "11111111-1111-4111-8111-111111111111",
    plan: "monthly",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    purchaseDate: new Date("2026-05-01T00:00:00.000Z"),
    environment: "Production",
    source: "receipt",
  });

  const payment = state.payment_history[0];
  assert(
    payment.apple_original_transaction_id === "orig-1",
    "Expected payment history to store the durable Apple original transaction id",
  );
  assert(
    (payment.metadata as Record<string, unknown>).original_transaction_id ===
      "orig-1",
    "Expected payment metadata to include the original transaction id for migration fallback",
  );
  assert(
    payment.subscription_id === state.subscriptions[0].id,
    "Expected payment history to link to the upserted subscription row",
  );
});

Deno.test("upsertSubscription preserves existing payment metadata while stamping the original transaction id", async () => {
  const { client, state } = createSubscriptionSupabase({
    payment_history: [
      {
        id: "payment-1",
        user_id: "11111111-1111-4111-8111-111111111111",
        stripe_payment_intent_id: "tx-1",
        metadata: {
          support_note: "manual reconciliation",
        },
      },
    ],
  });

  await appleSubscriptionsModule.upsertSubscription(client, {
    userId: "11111111-1111-4111-8111-111111111111",
    transactionId: "tx-1",
    originalTransactionId: "orig-1",
    productId: "cosmiq_premium_monthly",
    appAccountToken: "11111111-1111-4111-8111-111111111111",
    plan: "monthly",
    expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    purchaseDate: new Date("2026-05-01T00:00:00.000Z"),
    environment: "Production",
    source: "receipt",
  });

  const payment = state.payment_history[0];
  assert(
    payment.apple_original_transaction_id === "orig-1",
    "Expected existing payment history to be stamped with the original transaction id",
  );
  assert(
    (payment.metadata as Record<string, unknown>).support_note ===
      "manual reconciliation",
    "Expected existing payment metadata to be preserved",
  );
  assert(
    (payment.metadata as Record<string, unknown>).original_transaction_id ===
      "orig-1",
    "Expected original transaction metadata to be merged into the existing payment",
  );
});

Deno.test("resolvePlanFromProduct rejects unknown Apple product ids", () => {
  assert(
    appleSubscriptionsModule.resolvePlanFromProduct("cosmiq_premium_yearly") ===
      "yearly",
    "Expected configured yearly product id to resolve",
  );
  assert(
    appleSubscriptionsModule.resolvePlanFromProduct(
      "cosmiq_premium_monthly",
    ) === "monthly",
    "Expected configured monthly product id to resolve",
  );

  let error: unknown = null;
  try {
    appleSubscriptionsModule.resolvePlanFromProduct(
      "com.example.unrelated.yearly.tip",
    );
  } catch (caught) {
    error = caught;
  }

  assert(
    error instanceof Error &&
      error.message ===
        appleSubscriptionsModule.APPLE_UNSUPPORTED_PRODUCT_ERROR,
    "Expected unknown Apple products to fail closed instead of defaulting to monthly",
  );
});

Deno.test("Apple product boundary keeps Graceward and Cosmiq purchases separate", () => {
  appleSubscriptionsModule.assertAppleProductBoundary(
    "graceward_plus_yearly",
    "graceward",
  );
  appleSubscriptionsModule.assertAppleProductBoundary(
    "cosmiq_premium_monthly",
    "cosmiq",
  );

  let rejected = false;
  try {
    appleSubscriptionsModule.assertAppleProductBoundary(
      "cosmiq_premium_yearly",
      "graceward",
    );
  } catch (error) {
    rejected = error instanceof Error &&
      error.message === appleSubscriptionsModule.APPLE_PRODUCT_BOUNDARY_ERROR;
  }
  assert(rejected, "Expected cross-product Apple purchase to be rejected");
});
