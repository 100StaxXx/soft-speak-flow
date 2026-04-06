function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const appleServerApiModule = await import("./appleServerAPI.ts");

Deno.test("normalizeAppAccountToken accepts valid UUIDs and rejects malformed values", () => {
  assert(
    appleServerApiModule.normalizeAppAccountToken("11111111-1111-4111-8111-111111111111")
      === "11111111-1111-4111-8111-111111111111",
    "Expected valid UUID token to normalize",
  );
  assert(
    appleServerApiModule.normalizeAppAccountToken("not-a-uuid") === null,
    "Expected malformed token to be rejected",
  );
});

Deno.test("getTransactionInfo requires APPLE_ISSUER_ID instead of APPLE_TEAM_ID", async () => {
  const originalIssuerId = Deno.env.get("APPLE_ISSUER_ID");
  const originalKeyId = Deno.env.get("APPLE_KEY_ID");
  const originalPrivateKey = Deno.env.get("APPLE_PRIVATE_KEY");
  const originalBundleId = Deno.env.get("APPLE_IOS_BUNDLE_ID");

  Deno.env.delete("APPLE_ISSUER_ID");
  Deno.env.set("APPLE_KEY_ID", "key-id");
  Deno.env.set("APPLE_PRIVATE_KEY", "test-private-key-placeholder");
  Deno.env.set("APPLE_IOS_BUNDLE_ID", "com.cosmiq.app");

  let error: unknown = null;
  try {
    await appleServerApiModule.getTransactionInfo("tx-1");
  } catch (caught) {
    error = caught;
  } finally {
    if (originalIssuerId === undefined) {
      Deno.env.delete("APPLE_ISSUER_ID");
    } else {
      Deno.env.set("APPLE_ISSUER_ID", originalIssuerId);
    }

    if (originalKeyId === undefined) {
      Deno.env.delete("APPLE_KEY_ID");
    } else {
      Deno.env.set("APPLE_KEY_ID", originalKeyId);
    }

    if (originalPrivateKey === undefined) {
      Deno.env.delete("APPLE_PRIVATE_KEY");
    } else {
      Deno.env.set("APPLE_PRIVATE_KEY", originalPrivateKey);
    }

    if (originalBundleId === undefined) {
      Deno.env.delete("APPLE_IOS_BUNDLE_ID");
    } else {
      Deno.env.set("APPLE_IOS_BUNDLE_ID", originalBundleId);
    }
  }

  assert(error instanceof Error, "Expected missing issuer ID to throw an error");
  assert(
    error instanceof Error && error.message === "Subscription verification is temporarily unavailable. Please try again later.",
    `Expected generic missing-config message, got ${error instanceof Error ? error.message : String(error)}`,
  );
  assert(
    error instanceof appleServerApiModule.AppleApiError &&
      error.code === appleServerApiModule.APPLE_API_CONFIG_ERROR_CODE,
    "Expected Apple API config error code when issuer ID is missing",
  );
});
