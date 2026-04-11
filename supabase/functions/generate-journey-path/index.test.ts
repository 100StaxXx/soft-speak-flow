function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected} but received ${actual}`);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");

const journeyPathModulePromise = import("./index.ts");

Deno.test("generate-journey-path stores user-scoped cache rows and storage keys", async () => {
  const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

  assert(
    source.includes('onConflict: "epic_id,user_id,milestone_index"'),
    "Expected journey path cache writes to be scoped by user",
  );
  assert(
    source.includes('const fileName = `${userId}/${epicId}/${milestoneIndex}_${Date.now()}.png`;'),
    "Expected journey path uploads to be prefixed by user id",
  );
  assert(
    source.includes('image_size: JOURNEY_PATH_LANDSCAPE_IMAGE_SIZE'),
    "Expected journey path generation to request the landscape image size",
  );
  assert(
    source.includes('render_version: JOURNEY_PATH_RENDER_VERSION'),
    "Expected journey path prompt context to store a render version",
  );
  assert(
    !source.includes("requestPayload.userId"),
    "Expected the function to stop trusting caller-supplied userId values",
  );
  assert(
    source.includes('profileKey: "ai.standard"'),
    "Expected journey path generation to use the standard AI abuse-protection profile",
  );
  assert(
    source.includes("EPIC_FETCH_RETRY_DELAYS_MS = [400, 1200, 2500]"),
    "Expected journey path generation to retry epic lookups before failing",
  );
  assert(
    source.includes('error: EPIC_SYNC_PENDING_ERROR'),
    "Expected journey path generation to surface a sync-friendly epic lookup message",
  );
});

const createProtectedContext = () => ({
  auth: {
    userId: "user-1",
    isServiceRole: false,
  },
  ipAddress: "127.0.0.1",
  protection: null,
  requestId: "req-journey-test",
  supabase: {} as unknown,
});

Deno.test("generate-journey-path rejects an empty body with INVALID_INPUT", async () => {
  const { handleGenerateJourneyPath } = await journeyPathModulePromise;

  const response = await handleGenerateJourneyPath(
    new Request("https://example.com/functions/v1/generate-journey-path", {
      method: "POST",
    }),
    {
      getOpenAIApiKey: () => undefined,
      requireProtectedRequestImpl: async () => createProtectedContext() as never,
    },
  );

  const payload = await response.json() as Record<string, unknown>;
  assertEquals(response.status, 400, "Expected empty body to be rejected");
  assertEquals(payload.code, "INVALID_INPUT", "Expected empty body to return INVALID_INPUT");
});

Deno.test("generate-journey-path rejects a request missing epicId", async () => {
  const { handleGenerateJourneyPath } = await journeyPathModulePromise;

  const response = await handleGenerateJourneyPath(
    new Request("https://example.com/functions/v1/generate-journey-path", {
      method: "POST",
      body: JSON.stringify({ milestoneIndex: 0 }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
    {
      getOpenAIApiKey: () => undefined,
      requireProtectedRequestImpl: async () => createProtectedContext() as never,
    },
  );

  const payload = await response.json() as Record<string, unknown>;
  assertEquals(response.status, 400, "Expected missing epicId to be rejected");
  assertEquals(payload.code, "INVALID_INPUT", "Expected missing epicId to return INVALID_INPUT");
});

Deno.test("generate-journey-path rejects a request missing milestoneIndex", async () => {
  const { handleGenerateJourneyPath } = await journeyPathModulePromise;

  const response = await handleGenerateJourneyPath(
    new Request("https://example.com/functions/v1/generate-journey-path", {
      method: "POST",
      body: JSON.stringify({ epicId: "epic-1" }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
    {
      getOpenAIApiKey: () => undefined,
      requireProtectedRequestImpl: async () => createProtectedContext() as never,
    },
  );

  const payload = await response.json() as Record<string, unknown>;
  assertEquals(response.status, 400, "Expected missing milestoneIndex to be rejected");
  assertEquals(payload.code, "INVALID_INPUT", "Expected missing milestoneIndex to return INVALID_INPUT");
});

Deno.test("generate-journey-path rejects a negative milestone index", async () => {
  const { handleGenerateJourneyPath } = await journeyPathModulePromise;

  const response = await handleGenerateJourneyPath(
    new Request("https://example.com/functions/v1/generate-journey-path", {
      method: "POST",
      body: JSON.stringify({ epicId: "epic-1", milestoneIndex: -1 }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
    {
      getOpenAIApiKey: () => undefined,
      requireProtectedRequestImpl: async () => createProtectedContext() as never,
    },
  );

  const payload = await response.json() as Record<string, unknown>;
  assertEquals(response.status, 400, "Expected negative milestoneIndex to be rejected");
  assertEquals(payload.code, "INVALID_INPUT", "Expected negative milestoneIndex to return INVALID_INPUT");
});

Deno.test("generate-journey-path accepts a valid request body before downstream service checks", async () => {
  const { handleGenerateJourneyPath } = await journeyPathModulePromise;

  const response = await handleGenerateJourneyPath(
    new Request("https://example.com/functions/v1/generate-journey-path", {
      method: "POST",
      body: JSON.stringify({ epicId: "epic-1", milestoneIndex: 0 }),
      headers: {
        "Content-Type": "application/json",
      },
    }),
    {
      getOpenAIApiKey: () => undefined,
      requireProtectedRequestImpl: async () => createProtectedContext() as never,
    },
  );

  const payload = await response.json() as Record<string, unknown>;
  assertEquals(response.status, 500, "Expected valid body to continue past validation");
  assertEquals(payload.code, "SERVICE_MISCONFIGURED", "Expected valid body to reach downstream config checks");
});
