function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const verifyAppleReceiptModule = await import("./index.ts");
const appleServerApiModule = await import("../_shared/appleServerAPI.ts");

function createAuthenticatedClient() {
  return {
    auth: {
      getUser: async () => ({
        data: {
          user: { id: "11111111-1111-4111-8111-111111111111" },
        },
      }),
    },
  };
}

Deno.test("verify-apple-receipt returns structured Apple provider errors", async () => {
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: "tx-1" }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
      verifyTransactionImpl: async () => {
        throw new appleServerApiModule.AppleApiError(
          "Subscription verification is temporarily unavailable. Please try again later.",
          {
            code: appleServerApiModule.APPLE_API_AUTH_ERROR_CODE,
            statusCode: 502,
            upstreamStatus: 401,
            upstreamError: "Apple API error: 401 - unauthorized",
          },
        );
      },
    },
  );

  assert(
    response.status === 502,
    `Expected 502 structured provider error, got ${response.status}`,
  );
  const payload = await response.json();
  assert(
    payload.error ===
      "Subscription verification is temporarily unavailable. Please try again later.",
    `Expected generic provider message, got ${payload.error}`,
  );
  assert(
    payload.code === appleServerApiModule.APPLE_API_AUTH_ERROR_CODE,
    `Expected provider auth error code, got ${payload.code}`,
  );
  assert(
    payload.upstream_status === 401,
    `Expected upstream status 401, got ${payload.upstream_status}`,
  );
});

Deno.test("verify-apple-receipt falls back to receipt verification when a receipt is present", async () => {
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactionId: "tx-1",
        receipt: "encoded-receipt",
      }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
      verifyTransactionImpl: async () => {
        throw new appleServerApiModule.AppleApiError(
          "Subscription verification is temporarily unavailable. Please try again later.",
          {
            code: appleServerApiModule.APPLE_API_AUTH_ERROR_CODE,
            statusCode: 502,
            upstreamStatus: 401,
          },
        );
      },
      verifyReceiptWithAppleImpl: async () => ({
        result: { status: 0 },
        environment: "Sandbox",
      }),
      extractLatestTransactionImpl: () => ({
        productId: "cosmiq_premium_monthly",
        transactionId: "tx-legacy-1",
        originalTransactionId: "orig-legacy-1",
        expiresAt: new Date("2026-05-01T00:00:00.000Z"),
        purchaseDate: new Date("2026-04-01T00:00:00.000Z"),
        cancellationDate: null,
        offerIdentifier: null,
        offerType: null,
      }),
      upsertSubscriptionImpl: async () => ({
        id: "subscription-1",
        status: "active",
        plan: "monthly",
        current_period_end: "2026-05-01T00:00:00.000Z",
      }),
    },
  );

  assert(
    response.status === 200,
    `Expected receipt fallback success, got ${response.status}`,
  );
  const payload = await response.json();
  assert(
    payload.verificationMethod === "legacy_verify_receipt",
    `Expected legacy receipt verification, got ${payload.verificationMethod}`,
  );
});

Deno.test("verify-apple-receipt still requires auth for normal requests", async () => {
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: "tx-1" }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
    },
  );

  assert(
    response.status === 401,
    `Expected unauthenticated request to be rejected, got ${response.status}`,
  );
  const payload = await response.json();
  assert(
    payload.error === "Unauthorized",
    `Expected unauthorized error, got ${payload.error}`,
  );
});

Deno.test("verify-apple-receipt routes Apple notifications before user auth", async () => {
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ signedPayload: "not-a-valid-jws" }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
    },
  );

  assert(
    response.status === 401,
    `Expected invalid Apple notification signature, got ${response.status}`,
  );
  const payload = await response.text();
  assert(
    payload === "Invalid signature",
    `Expected Apple signature failure, got ${payload}`,
  );
});

Deno.test("verify-apple-receipt allows sandbox transactions without app-account token", async () => {
  const upsertPayloads: Array<{
    allowCreateWithoutAppAccountToken?: boolean;
    appAccountToken?: string | null;
    offerIdentifier?: string | null;
    offerType?: number | null;
  }> = [];

  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: "sandbox-tokenless-tx" }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
      verifyTransactionImpl: async () => ({
        transactionInfo: {
          transactionId: "sandbox-tokenless-tx",
          originalTransactionId: "sandbox-tokenless-orig",
          productId: "cosmiq_premium_monthly",
          purchaseDate: Date.parse("2026-05-01T00:00:00.000Z"),
          expiresDate: Date.parse("2026-06-01T00:00:00.000Z"),
          type: "Auto-Renewable Subscription",
          environment: "Sandbox",
          offerIdentifier: "Referrals",
          offerType: 3,
        },
        environment: "Sandbox",
        isValid: true,
      }),
      upsertSubscriptionImpl: async (_client, payload) => {
        upsertPayloads.push(payload);
        return {
          id: "subscription-1",
          status: "active",
          plan: "monthly",
          current_period_end: "2026-06-01T00:00:00.000Z",
        };
      },
    },
  );

  assert(
    response.status === 200,
    `Expected sandbox tokenless success, got ${response.status}`,
  );
  const upsertPayload = upsertPayloads[0];
  assert(
    upsertPayload?.appAccountToken === null,
    "Expected tokenless sandbox payload",
  );
  assert(
    upsertPayload?.allowCreateWithoutAppAccountToken === true,
    "Expected sandbox payload to allow binding creation without appAccountToken",
  );
  assert(
    upsertPayload?.offerIdentifier === "Referrals",
    "Expected Apple offer identifier to be passed to subscription upsert",
  );
  assert(
    upsertPayload?.offerType === 3,
    "Expected Apple offer type to be passed to subscription upsert",
  );
});

Deno.test("verify-apple-receipt preserves binding errors even when a receipt is present", async () => {
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactionId: "tx-1",
        receipt: "encoded-receipt",
      }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
      verifyTransactionImpl: async () => {
        throw new Error(
          "This purchase is missing its app-account binding. Update the app and restore the purchase again.",
        );
      },
      verifyReceiptWithAppleImpl: async () => {
        throw new Error(
          "verifyReceiptWithAppleImpl should not be called for binding failures",
        );
      },
    },
  );

  assert(
    response.status === 400,
    `Expected binding failure to bypass fallback, got ${response.status}`,
  );
  const payload = await response.json();
  assert(
    payload.code === "APPLE_BINDING_MISSING",
    `Expected binding missing code, got ${payload.code}`,
  );
});

Deno.test("verify-apple-receipt rejects StoreKit transactions without subscription expiry", async () => {
  let upsertCalled = false;
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: "tx-no-expiry" }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
      verifyTransactionImpl: async () => ({
        transactionInfo: {
          transactionId: "tx-no-expiry",
          originalTransactionId: "orig-no-expiry",
          productId: "cosmiq_premium_monthly",
          purchaseDate: Date.parse("2026-05-01T00:00:00.000Z"),
          type: "Auto-Renewable Subscription",
          environment: "Sandbox",
        },
        environment: "Sandbox",
        isValid: true,
      }),
      upsertSubscriptionImpl: async () => {
        upsertCalled = true;
        throw new Error(
          "upsertSubscriptionImpl should not be called without expiresDate",
        );
      },
    },
  );

  assert(
    response.status === 400,
    `Expected missing expiry to be rejected, got ${response.status}`,
  );
  assert(
    !upsertCalled,
    "Expected subscription upsert not to run for transactions without expiry",
  );
  const payload = await response.json();
  assert(
    payload.error ===
      "This Apple transaction is missing its subscription expiration date.",
    `Expected missing expiry error, got ${payload.error}`,
  );
});

Deno.test("verify-apple-receipt rejects non-subscription StoreKit transactions", async () => {
  let upsertCalled = false;
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: "tx-consumable" }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
      verifyTransactionImpl: async () => ({
        transactionInfo: {
          transactionId: "tx-consumable",
          originalTransactionId: "orig-consumable",
          productId: "cosmiq_tip_pack",
          purchaseDate: Date.parse("2026-05-01T00:00:00.000Z"),
          expiresDate: Date.parse("2026-06-01T00:00:00.000Z"),
          type: "Consumable",
          environment: "Sandbox",
        },
        environment: "Sandbox",
        isValid: true,
      }),
      upsertSubscriptionImpl: async () => {
        upsertCalled = true;
        throw new Error(
          "upsertSubscriptionImpl should not be called for non-subscriptions",
        );
      },
    },
  );

  assert(
    response.status === 400,
    `Expected non-subscription transaction to be rejected, got ${response.status}`,
  );
  assert(
    !upsertCalled,
    "Expected subscription upsert not to run for non-subscription transactions",
  );
});
