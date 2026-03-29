function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

Deno.test("generate-evening-response passes through auth failures", async () => {
  const response = await module.handleGenerateEveningResponse(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ reflectionId: "reflection-1" }),
      headers: { "Content-Type": "application/json" },
    }),
    {
      authenticate: async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      createSupabaseClient: () => {
        throw new Error("createSupabaseClient should not be called");
      },
      fetchImpl: fetch,
      now: () => 0,
    },
  );

  assert(response.status === 401, `Expected 401 auth response, got ${response.status}`);
});

Deno.test("generate-evening-response hides cross-user reflection access", async () => {
  const response = await module.handleGenerateEveningResponse(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ reflectionId: "reflection-1" }),
      headers: { "Content-Type": "application/json" },
    }),
    {
      authenticate: async () => ({ userId: "user-1", isServiceRole: false }),
      createSupabaseClient: () => ({
        from() {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle: async () => ({
              data: null,
              error: null,
            }),
            single: async () => ({
              data: null,
              error: null,
            }),
            update() {
              return this;
            },
          };
        },
      }),
      fetchImpl: fetch,
      now: () => 0,
    },
  );

  assert(response.status === 404, `Expected 404 for cross-user reflection access, got ${response.status}`);
});
