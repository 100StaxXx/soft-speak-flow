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
