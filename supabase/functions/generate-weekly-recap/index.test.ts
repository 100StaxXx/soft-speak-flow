function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

Deno.test("generate-weekly-recap passes through auth failures", async () => {
  const response = await module.handleGenerateWeeklyRecap(
    new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
    {
      authenticate: async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      createSupabaseClient: () => {
        throw new Error("createSupabaseClient should not be called");
      },
      fetchImpl: fetch,
    },
  );

  assert(response.status === 401, `Expected 401 auth response, got ${response.status}`);
});

Deno.test("generate-weekly-recap ignores explicit user mismatches and uses the authenticated user", () => {
  const scope = module.resolveWeeklyRecapScope(
    { userId: "user-1", isServiceRole: false },
    "user-2",
  );

  if (!("userId" in scope)) {
    throw new Error("Expected scope resolution to return a user id");
  }
  assert(scope.userId === "user-1", `Expected authenticated user id, got ${scope.userId}`);
});
