function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
const module = await import("./index.ts");

Deno.test("transcribe-audio passes through internal auth failures", async () => {
  const response = await module.handleTranscribeAudio(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ audioUrl: "https://example.com/audio.mp3" }),
      headers: { "Content-Type": "application/json" },
    }),
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

Deno.test("transcribe-audio allows internal requests to reach server-side validation", async () => {
  const originalOpenAiKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.delete("OPENAI_API_KEY");

  try {
    const response = await module.handleTranscribeAudio(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ audioUrl: "https://example.com/audio.mp3" }),
        headers: { "Content-Type": "application/json" },
      }),
      {
        authenticate: async () => ({ isInternal: true }),
        createSupabaseClient: () => {
          throw new Error("createSupabaseClient should not be called before OpenAI key validation");
        },
        fetchImpl: fetch,
      },
    );

    assert(response.status === 500, `Expected 500 validation response, got ${response.status}`);
    const payload = await response.json();
    assert(
      payload.error === "OpenAI API key not configured",
      `Expected OpenAI key validation error, got ${payload.error}`,
    );
  } finally {
    if (originalOpenAiKey === undefined) {
      Deno.env.delete("OPENAI_API_KEY");
    } else {
      Deno.env.set("OPENAI_API_KEY", originalOpenAiKey);
    }
  }
});
