function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

Deno.test("sync-daily-pep-talk-transcript passes through internal auth failures", async () => {
  const response = await module.handleSyncDailyPepTalkTranscript(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ id: "pep-talk-1" }),
      headers: { "Content-Type": "application/json" },
    }),
    {
      authenticate: async () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      createSupabaseClient: () => {
        throw new Error("createSupabaseClient should not be called");
      },
      invokeTranscribeAudio: async () => {
        throw new Error("invokeTranscribeAudio should not be called");
      },
    },
  );

  assert(response.status === 401, `Expected 401 auth response, got ${response.status}`);
});

Deno.test("sync-daily-pep-talk-transcript allows internal requests to reach validation", async () => {
  const response = await module.handleSyncDailyPepTalkTranscript(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    }),
    {
      authenticate: async () => ({ isInternal: true }),
      createSupabaseClient: () => ({
        from() {
          throw new Error("from() should not be called when request payload is invalid");
        },
      }),
      invokeTranscribeAudio: async () => {
        throw new Error("invokeTranscribeAudio should not be called when request payload is invalid");
      },
    },
  );

  assert(response.status === 400, `Expected 400 validation response, got ${response.status}`);
  const payload = await response.json();
  assert(
    payload.error === "Provide either id or {mentor_slug, for_date}",
    `Expected request validation error, got ${payload.error}`,
  );
});
