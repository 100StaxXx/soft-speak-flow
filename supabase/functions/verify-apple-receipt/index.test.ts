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

  assert(response.status === 502, `Expected 502 structured provider error, got ${response.status}`);
  const payload = await response.json();
  assert(
    payload.error === "Subscription verification is temporarily unavailable. Please try again later.",
    `Expected generic provider message, got ${payload.error}`,
  );
  assert(
    payload.code === appleServerApiModule.APPLE_API_AUTH_ERROR_CODE,
    `Expected provider auth error code, got ${payload.code}`,
  );
  assert(payload.upstream_status === 401, `Expected upstream status 401, got ${payload.upstream_status}`);
});

Deno.test("verify-apple-receipt falls back to receipt verification when a receipt is present", async () => {
  const response = await verifyAppleReceiptModule.handleVerifyAppleReceipt(
    new Request("http://localhost", {
      method: "POST",
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transactionId: "tx-1", receipt: "encoded-receipt" }),
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
      }),
      upsertSubscriptionImpl: async () => ({
        id: "subscription-1",
        status: "active",
        plan: "monthly",
        current_period_end: "2026-05-01T00:00:00.000Z",
      }),
    },
  );

  assert(response.status === 200, `Expected receipt fallback success, got ${response.status}`);
  const payload = await response.json();
  assert(
    payload.verificationMethod === "legacy_verify_receipt",
    `Expected legacy receipt verification, got ${payload.verificationMethod}`,
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
      body: JSON.stringify({ transactionId: "tx-1", receipt: "encoded-receipt" }),
    }),
    {
      createSupabaseClient: () => createAuthenticatedClient() as never,
      verifyTransactionImpl: async () => {
        throw new Error("This purchase is missing its app-account binding. Update the app and restore the purchase again.");
      },
      verifyReceiptWithAppleImpl: async () => {
        throw new Error("verifyReceiptWithAppleImpl should not be called for binding failures");
      },
    },
  );

  assert(response.status === 400, `Expected binding failure to bypass fallback, got ${response.status}`);
  const payload = await response.json();
  assert(
    payload.code === "APPLE_BINDING_MISSING",
    `Expected binding missing code, got ${payload.code}`,
  );
});
