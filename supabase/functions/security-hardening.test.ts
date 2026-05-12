function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} (expected ${expected}, got ${actual})`);
  }
}

interface QueryState {
  table: string;
  filters: Record<string, unknown>;
  payload: unknown;
}

type TableHandler = (
  state: QueryState,
) => Promise<{ data?: unknown; error?: unknown; count?: number }> | {
  data?: unknown;
  error?: unknown;
  count?: number;
};

function createMockSupabase(
  handlers: Record<string, TableHandler>,
  options?: {
    rpcHandler?: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }> | {
      data: unknown;
      error: unknown;
    };
    uploadResult?: { error: unknown };
    publicUrl?: string;
    queryLog?: QueryState[];
  },
) {
  const queryLog = options?.queryLog ?? [];

  return {
    queryLog,
    rpc: (fn: string, args?: Record<string, unknown>) => {
      if (options?.rpcHandler) {
        return Promise.resolve(options.rpcHandler(fn, args));
      }
      return Promise.resolve({ data: false, error: null });
    },
    storage: {
      from: (_bucket: string) => ({
        upload: async () => options?.uploadResult ?? { error: null },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: options?.publicUrl ?? `https://example.com/${path}`,
          },
        }),
      }),
    },
    from(table: string) {
      const state: QueryState = {
        table,
        filters: {},
        payload: null,
      };
      queryLog.push(state);

      const resolve = async () => {
        const handler = handlers[table];
        if (!handler) {
          return { data: null, error: null };
        }
        return await handler(state);
      };

      const builder: Record<string, unknown> = {};
      builder.select = (..._args: unknown[]) => builder;
      builder.eq = (column: string, value: unknown) => {
        state.filters[column] = value;
        return builder;
      };
      builder.gte = (column: string, value: unknown) => {
        state.filters[`gte:${column}`] = value;
        return builder;
      };
      builder.lte = (column: string, value: unknown) => {
        state.filters[`lte:${column}`] = value;
        return builder;
      };
      builder.lt = (column: string, value: unknown) => {
        state.filters[`lt:${column}`] = value;
        return builder;
      };
      builder.in = (column: string, value: unknown) => {
        state.filters[`in:${column}`] = value;
        return builder;
      };
      builder.or = (value: string) => {
        state.filters.or = value;
        return builder;
      };
      builder.order = (..._args: unknown[]) => builder;
      builder.limit = async (_value: number) => await resolve();
      builder.update = (payload: unknown) => {
        state.payload = payload;
        return builder;
      };
      builder.insert = (payload: unknown) => {
        state.payload = payload;
        return builder;
      };
      builder.upsert = (payload: unknown) => {
        state.payload = payload;
        return builder;
      };
      builder.maybeSingle = async () => await resolve();
      builder.single = async () => await resolve();
      builder.then = (onFulfilled: (value: unknown) => unknown) =>
        resolve().then(onFulfilled);
      return builder;
    },
  };
}

function createNoopCostGuardrailSession(_params?: unknown) {
  return {
    enforceAccess: async () => {},
    wrapFetch: (fetchImpl: typeof fetch) => fetchImpl,
  };
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");

const retryModule = await import("./retry-failed-payouts/index.ts");
const eveningModule = await import("./generate-evening-response/index.ts");
const weeklyRecapModule = await import("./generate-weekly-recap/index.ts");
const creatorStatsModule = await import("./get-creator-stats/index.ts");
const pepTalkModule = await import("./generate-complete-pep-talk/index.ts");
const weeklyInsightsModule = await import(
  "./generate-weekly-insights/index.ts"
);
const dormantImageModule = await import(
  "./generate-dormant-companion-image/index.ts"
);
const neglectedImageModule = await import(
  "./generate-neglected-companion-image/index.ts"
);
const mentorAudioModule = await import("./generate-mentor-audio/index.ts");

const EXPECTED_MENTOR_VOICE_IDS = [
  ["sage", "sage", "mcuuWJIofmzgKEGk3EMA"],
  ["lyra", "lyra", "pq3wL6Xv3fuEM14W6ZCg"],
  ["icon", "icon", "GaCzJ7BKVn8XQp1mZYIn"],
  ["charles", "charles", "jRAAK67SEFE9m7ci5DhD"],
  ["princess", "princess", "uIZsnBL0YK1S5j69bAih"],
  ["operator", "operator", "pNInz6obpgDQGcFmaJgB"],
  ["rival", "rival", "V33LkP9pVLdcjeB2y5Na"],
  ["reign", "reign", "GTQ4ImqrRljZAa9VJX6B"],
] as const;

const EXPECTED_ALIAS_VOICE_IDS = [
  ["atlas", "sage", "mcuuWJIofmzgKEGk3EMA"],
  ["carmen", "icon", "GaCzJ7BKVn8XQp1mZYIn"],
  ["solace", "charles", "jRAAK67SEFE9m7ci5DhD"],
  ["elizabeth", "charles", "jRAAK67SEFE9m7ci5DhD"],
  ["sienna", "princess", "uIZsnBL0YK1S5j69bAih"],
  ["stryker", "operator", "pNInz6obpgDQGcFmaJgB"],
  ["eli", "rival", "V33LkP9pVLdcjeB2y5Na"],
] as const;

Deno.test("retry-failed-payouts rejects unauthenticated callers", async () => {
  const response = await retryModule.handleRetryFailedPayouts(
    new Request("https://example.com"),
    {
      authorize: async () =>
        new Response(
          JSON.stringify({ error: "Missing Authorization header" }),
          { status: 401 },
        ),
      createSupabaseClient: () => createMockSupabase({}),
      fetchImpl: fetch,
    },
  );

  assertEquals(
    response.status,
    401,
    "Expected unauthenticated retry request to be rejected",
  );
});

Deno.test("retry-failed-payouts rejects non-admin callers", async () => {
  const response = await retryModule.handleRetryFailedPayouts(
    new Request("https://example.com"),
    {
      authorize: async () =>
        new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
        }),
      createSupabaseClient: () => createMockSupabase({}),
      fetchImpl: fetch,
    },
  );

  assertEquals(
    response.status,
    403,
    "Expected non-admin retry request to be rejected",
  );
});

Deno.test("retry-failed-payouts allows admin/service callers through handler", async () => {
  const supabase = createMockSupabase({
    referral_config: () => ({
      data: {
        config_value: {
          minimum_threshold: 50,
          auto_approve_threshold: 100,
          max_retry_attempts: 3,
          retry_delay_hours: 24,
        },
      },
      error: null,
    }),
    referral_payouts: () => ({ data: [], error: null }),
  });

  const response = await retryModule.handleRetryFailedPayouts(
    new Request("https://example.com"),
    {
      authorize: async () => ({ userId: "admin-user", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected admin retry request to succeed");
  assertEquals(
    body.processed,
    0,
    "Expected no payouts to be processed in empty fixture",
  );
});

Deno.test("generate-evening-response hides foreign reflections", async () => {
  const supabase = createMockSupabase({
    evening_reflections: () => ({ data: null, error: null }),
  });

  const response = await eveningModule.handleGenerateEveningResponse(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ reflectionId: "reflection-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-a", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
      now: () => 1000,
    },
  );

  assertEquals(
    response.status,
    404,
    "Expected foreign reflection lookup to return 404",
  );
});

Deno.test("generate-evening-response returns cached mentor responses without new AI spend", async () => {
  let fetchCalled = false;
  const supabase = createMockSupabase({
    evening_reflections: () => ({
      data: {
        id: "reflection-1",
        user_id: "user-a",
        mood: "good",
        mentor_response: "Already here",
        profiles: { selected_mentor_id: null },
      },
      error: null,
    }),
  });

  const response = await eveningModule.handleGenerateEveningResponse(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ reflectionId: "reflection-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-a", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: async () => {
        fetchCalled = true;
        return new Response("{}");
      },
      now: () => 1000,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected cached response to succeed");
  assert(body.cached === true, "Expected cached response flag");
  assert(fetchCalled === false, "Expected cached response to skip AI call");
});

Deno.test("generate-weekly-recap ignores spoofed user ids and returns existing recap for the caller", async () => {
  const supabase = createMockSupabase({
    cost_guardrail_config: () => ({ data: [], error: null }),
    cost_guardrail_state: () => ({ data: [], error: null }),
    cost_events: () => ({ data: null, error: null }),
    cost_alert_events: () => ({ data: null, error: null }),
    weekly_recaps: () => ({
      data: {
        id: "recap-1",
        user_id: "auth-user",
        week_start_date: "2026-03-16",
      },
      error: null,
    }),
  });

  const response = await weeklyRecapModule.handleGenerateWeeklyRecap(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ userId: "spoofed-user" }),
    }),
    {
      authenticate: async () => ({ userId: "auth-user", isServiceRole: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: fetch,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    200,
    "Expected weekly recap generation to succeed",
  );
  assert(body.cached === true, "Expected existing recap to short-circuit");
});

Deno.test("get-creator-stats requires creator tokens", async () => {
  const response = await creatorStatsModule.handleGetCreatorStats(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ referral_code: "COSMIQ-TEST" }),
    }),
    {
      createSupabaseClient: () =>
        createMockSupabase({
          influencer_creation_log: () => ({ data: [], error: null }),
        }),
      verifyToken: async () => ({ valid: true }),
    },
  );

  assertEquals(
    response.status,
    401,
    "Expected missing creator token to be rejected",
  );
});

Deno.test("get-creator-stats rejects mismatched creator tokens", async () => {
  const supabase = createMockSupabase({
    influencer_creation_log: () => ({ data: [], error: null }),
    referral_codes: () => ({
      data: {
        id: "code-id",
        code: "COSMIQ-TEST",
        influencer_name: "Creator",
        influencer_email: "creator@example.com",
        influencer_handle: "@creator",
        payout_identifier: "creator@example.com",
        created_at: "2026-03-01T00:00:00.000Z",
        tier: "bronze",
      },
      error: null,
    }),
  });

  const response = await creatorStatsModule.handleGetCreatorStats(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({
        referral_code: "COSMIQ-TEST",
        creator_access_token: "bad-token",
      }),
    }),
    {
      createSupabaseClient: () => supabase,
      verifyToken: async () => ({
        valid: false,
        reason: "Token does not match referral code",
      }),
    },
  );

  assertEquals(
    response.status,
    401,
    "Expected invalid creator token to be rejected",
  );
});

Deno.test("get-creator-stats returns only creator-scoped data with a valid token", async () => {
  const supabase = createMockSupabase({
    influencer_creation_log: () => ({ data: [], error: null }),
    referral_codes: () => ({
      data: {
        id: "code-id",
        code: "COSMIQ-TEST",
        influencer_name: "Creator",
        influencer_email: "creator@example.com",
        influencer_handle: "@creator",
        payout_identifier: "creator@example.com",
        created_at: "2026-03-01T00:00:00.000Z",
        tier: "bronze",
      },
      error: null,
    }),
    profiles: () => ({
      data: [
        {
          id: "profile-1",
          email: "friend@example.com",
          created_at: "2026-03-02T00:00:00.000Z",
          subscription_status: "active",
        },
      ],
      error: null,
    }),
    referral_payouts: () => ({
      data: [
        {
          id: "payout-1",
          amount: 12,
          status: "paid",
          created_at: "2026-03-03T00:00:00.000Z",
          paid_at: "2026-03-04T00:00:00.000Z",
          payout_type: "first_year",
        },
      ],
      error: null,
    }),
  });

  const response = await creatorStatsModule.handleGetCreatorStats(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({
        referral_code: "COSMIQ-TEST",
        creator_access_token: "valid-token",
      }),
    }),
    {
      createSupabaseClient: () => supabase,
      verifyToken: async () => ({ valid: true }),
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected valid creator token to succeed");
  assertEquals(
    body.creator.code,
    "COSMIQ-TEST",
    "Expected creator code to match requested creator",
  );
  assertEquals(
    body.recent_signups.length,
    1,
    "Expected creator-scoped signups",
  );
});

Deno.test("generate-complete-pep-talk ignores spoofed user ids for rate limiting", async () => {
  let rateLimitedUserId: string | null = null;
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");

  const response = await pepTalkModule.handleGenerateCompletePepTalk(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ mentorSlug: "eli", userId: "spoofed-user" }),
    }),
    {
      authenticate: async () => ({ userId: "auth-user", isServiceRole: false }),
      createSupabaseClient: () => createMockSupabase({}),
      fetchImpl: fetch,
      checkRateLimitFn: async (_supabase: unknown, userId: string) => {
        rateLimitedUserId = userId;
        return {
          allowed: false,
          available: true,
          remaining: 0,
          limit: 20,
          resetAt: new Date("2026-03-29T00:00:00.000Z"),
        };
      },
      now: () => 1000,
    },
  );

  assertEquals(
    response.status,
    429,
    "Expected blocked pep talk request when rate limit trips",
  );
  assertEquals(
    rateLimitedUserId,
    "auth-user",
    "Expected rate limiter to use the authenticated user id",
  );
});

Deno.test("generate-weekly-insights ignores spoofed user ids for rate limiting", async () => {
  let rateLimitedUserId: string | null = null;

  const response = await weeklyInsightsModule.handleGenerateWeeklyInsights(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({
        userId: "spoofed-user",
        weeklyData: {
          habitCount: 1,
          checkInCount: 1,
          moodCount: 1,
          activities: [],
        },
      }),
    }),
    {
      authenticate: async () => ({ userId: "auth-user", isServiceRole: false }),
      createSupabaseClient: () => createMockSupabase({}),
      fetchImpl: fetch,
      checkRateLimitFn: async (_supabase: unknown, userId: string) => {
        rateLimitedUserId = userId;
        return {
          allowed: false,
          available: true,
          remaining: 0,
          limit: 10,
          resetAt: new Date("2026-03-29T00:00:00.000Z"),
        };
      },
      now: () => 1000,
    },
  );

  assertEquals(
    response.status,
    429,
    "Expected blocked weekly insights request when rate limit trips",
  );
  assertEquals(
    rateLimitedUserId,
    "auth-user",
    "Expected weekly insights limiter to use authenticated user id",
  );
});

Deno.test("generate-dormant-companion-image rejects anonymous access", async () => {
  const response = await dormantImageModule.handleGenerateDormantCompanionImage(
    new Request("https://example.com"),
    {
      authenticate: async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      createSupabaseClient: () => createMockSupabase({}),
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      fetchImpl: fetch,
    },
  );

  assertEquals(
    response.status,
    401,
    "Expected dormant companion image endpoint to require auth",
  );
});

Deno.test("generate-neglected-companion-image hides foreign companions", async () => {
  const supabase = createMockSupabase({
    user_companion: () => ({ data: null, error: null }),
  });

  const response = await neglectedImageModule
    .handleGenerateNeglectedCompanionImage(
      new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({ companionId: "companion-1" }),
      }),
      {
        authenticate: async () => ({ isInternal: true }),
        createSupabaseClient: () => supabase,
        createCostGuardrailSessionFn: createNoopCostGuardrailSession,
        fetchImpl: fetch,
      },
    );

  assertEquals(
    response.status,
    404,
    "Expected foreign companion lookup to return 404",
  );
});

Deno.test("generate-dormant-companion-image allows internal cached access", async () => {
  const supabase = createMockSupabase({
    user_companion: () => ({
      data: {
        id: "companion-1",
        user_id: "owner-user",
        current_image_url: "https://example.com/current.png",
        dormant_image_url: "https://example.com/cached.png",
        spirit_animal: "fox",
        companion_name: "Nova",
      },
      error: null,
    }),
  });

  const response = await dormantImageModule.handleGenerateDormantCompanionImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ isInternal: true }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      fetchImpl: fetch,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    200,
    "Expected internal access to succeed for cached companion image",
  );
  assert(body.cached === true, "Expected cached dormant image response");
});

Deno.test("generate-mentor-audio rejects unauthenticated callers", async () => {
  const response = await mentorAudioModule.handleGenerateMentorAudio(
    new Request("https://example.com"),
    {
      authorize: async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      createSupabaseClient: () => createMockSupabase({}),
      fetchImpl: fetch,
      checkRateLimitFn: async () => ({
        allowed: true,
        available: true,
        remaining: 1,
        limit: 1,
        resetAt: new Date(),
      }),
      now: () => 1000,
    },
  );

  assertEquals(
    response.status,
    401,
    "Expected mentor audio endpoint to reject unauthenticated callers",
  );
});

Deno.test("generate-mentor-audio succeeds for authenticated users and records usage", async () => {
  const queryLog: QueryState[] = [];
  let elevenLabsRequestBody: Record<string, unknown> = {};
  Deno.env.set("ELEVENLABS_API_KEY", "test-elevenlabs-key");
  const supabase = createMockSupabase({
    ai_output_validation_log: () => ({ data: null, error: null }),
  }, {
    queryLog,
    publicUrl: "https://example.com/audio.mp3",
  });

  const response = await mentorAudioModule.handleGenerateMentorAudio(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ mentorSlug: "eli", script: "Keep going." }),
    }),
    {
      authorize: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: async (_input, init) => {
        elevenLabsRequestBody = JSON.parse(
          String(init?.body ?? "{}"),
        ) as Record<string, unknown>;
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
      checkRateLimitFn: async () => ({
        allowed: true,
        available: true,
        remaining: 14,
        limit: 15,
        resetAt: new Date("2026-03-29T00:00:00.000Z"),
      }),
      now: () => 1000,
    },
  );

  const body = await response.json();
  const logEntry = queryLog.find((entry) =>
    entry.table === "ai_output_validation_log"
  );
  assertEquals(
    response.status,
    200,
    "Expected authenticated mentor audio request to succeed",
  );
  assertEquals(
    body.audioUrl,
    "https://example.com/audio.mp3",
    "Expected audio URL from storage",
  );
  assert(
    Boolean(logEntry?.payload),
    "Expected mentor audio usage to be logged",
  );
  assertEquals(
    elevenLabsRequestBody.model_id,
    "eleven_v3",
    "Expected mentor audio to use ElevenLabs v3",
  );
});

Deno.test("generate-mentor-audio resolves every supported mentor voice", async () => {
  Deno.env.set("ELEVENLABS_API_KEY", "test-elevenlabs-key");

  for (
    const [mentorSlug, resolvedMentorSlug, voiceId] of EXPECTED_MENTOR_VOICE_IDS
  ) {
    const fetchedUrls: string[] = [];
    let elevenLabsRequestBody: Record<string, unknown> = {};
    const supabase = createMockSupabase({}, {
      publicUrl: `https://example.com/${mentorSlug}-audio.mp3`,
    });

    const response = await mentorAudioModule.handleGenerateMentorAudio(
      new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({ mentorSlug, script: "Keep going." }),
      }),
      {
        authorize: async () => ({ isInternal: true }),
        createSupabaseClient: () => supabase,
        fetchImpl: async (input, init) => {
          fetchedUrls.push(String(input));
          elevenLabsRequestBody = JSON.parse(
            String(init?.body ?? "{}"),
          ) as Record<string, unknown>;
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        },
        now: () => 1000,
      },
    );

    const body = await response.json();
    assertEquals(
      response.status,
      200,
      `Expected ${mentorSlug} mentor audio request to succeed`,
    );
    assertEquals(
      body.provider,
      "elevenlabs",
      `Expected ${mentorSlug} to use ElevenLabs`,
    );
    assertEquals(
      body.storagePath,
      `${resolvedMentorSlug}_1000.mp3`,
      `Expected ${mentorSlug} storage path to use the resolved slug`,
    );
    assert(
      fetchedUrls.some((url) => url.includes(voiceId)),
      `Expected ${mentorSlug} to use ElevenLabs voice ${voiceId}`,
    );
    const voiceSettings = elevenLabsRequestBody.voice_settings as Record<
      string,
      unknown
    >;
    assertEquals(
      voiceSettings.speed,
      mentorSlug === "princess" ? 1.2 : 1,
      `Expected ${mentorSlug} to send configured speech speed`,
    );
  }
});

Deno.test("generate-mentor-audio resolves legacy aliases to canonical voices", async () => {
  Deno.env.set("ELEVENLABS_API_KEY", "test-elevenlabs-key");

  for (const [alias, resolvedMentorSlug, voiceId] of EXPECTED_ALIAS_VOICE_IDS) {
    const fetchedUrls: string[] = [];
    const response = await mentorAudioModule.handleGenerateMentorAudio(
      new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({ mentorSlug: alias, script: "Keep going." }),
      }),
      {
        authorize: async () => ({ isInternal: true }),
        createSupabaseClient: () => createMockSupabase({}),
        fetchImpl: async (input) => {
          fetchedUrls.push(String(input));
          return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
        },
        now: () => 1000,
      },
    );

    const body = await response.json();
    assertEquals(
      response.status,
      200,
      `Expected ${alias} alias audio request to succeed`,
    );
    assertEquals(
      body.provider,
      "elevenlabs",
      `Expected ${alias} to use ElevenLabs`,
    );
    assertEquals(
      body.storagePath,
      `${resolvedMentorSlug}_1000.mp3`,
      `Expected ${alias} storage path to use ${resolvedMentorSlug}`,
    );
    assert(
      fetchedUrls.some((url) => url.includes(voiceId)),
      `Expected ${alias} to use canonical ${resolvedMentorSlug} voice ${voiceId}`,
    );
  }
});

Deno.test("generate-mentor-audio falls back to OpenAI TTS when ElevenLabs fails", async () => {
  const fetchedUrls: string[] = [];
  Deno.env.set("ELEVENLABS_API_KEY", "test-elevenlabs-key");
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");

  const supabase = createMockSupabase({}, {
    publicUrl: "https://example.com/fallback-audio.mp3",
  });

  const response = await mentorAudioModule.handleGenerateMentorAudio(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ mentorSlug: "lyra", script: "Keep going." }),
    }),
    {
      authorize: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: async (input) => {
        const url = String(input);
        fetchedUrls.push(url);
        if (url.includes("elevenlabs.io")) {
          return new Response(JSON.stringify({ error: "provider down" }), {
            status: 500,
          });
        }
        return new Response(new Uint8Array([4, 5, 6]), { status: 200 });
      },
      checkRateLimitFn: async () => ({
        allowed: true,
        available: true,
        remaining: 14,
        limit: 15,
        resetAt: new Date("2026-03-29T00:00:00.000Z"),
      }),
      now: () => 1000,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    200,
    "Expected fallback audio request to succeed",
  );
  assertEquals(
    body.audioUrl,
    "https://example.com/fallback-audio.mp3",
    "Expected fallback audio URL from storage",
  );
  assertEquals(
    body.provider,
    "openai",
    "Expected OpenAI fallback provider to be reported",
  );
  assert(
    fetchedUrls.some((url) => url.includes("elevenlabs.io")),
    "Expected ElevenLabs to be tried first",
  );
  assert(
    fetchedUrls.some((url) => url.includes("api.openai.com/v1/audio/speech")),
    "Expected OpenAI TTS fallback to be tried",
  );
});

Deno.test("generate-mentor-audio falls back to OpenAI TTS when ElevenLabs is rate limited", async () => {
  const fetchedUrls: string[] = [];
  Deno.env.set("ELEVENLABS_API_KEY", "test-elevenlabs-key");
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");

  const supabase = createMockSupabase({}, {
    publicUrl: "https://example.com/rate-limit-fallback-audio.mp3",
  });

  const response = await mentorAudioModule.handleGenerateMentorAudio(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ mentorSlug: "icon", script: "Keep going." }),
    }),
    {
      authorize: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      fetchImpl: async (input) => {
        const url = String(input);
        fetchedUrls.push(url);
        if (url.includes("elevenlabs.io")) {
          return new Response(JSON.stringify({ error: "rate limited" }), {
            status: 429,
          });
        }
        return new Response(new Uint8Array([7, 8, 9]), { status: 200 });
      },
      checkRateLimitFn: async () => ({
        allowed: true,
        available: true,
        remaining: 14,
        limit: 15,
        resetAt: new Date("2026-03-29T00:00:00.000Z"),
      }),
      now: () => 1000,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    200,
    "Expected rate-limit fallback audio request to succeed",
  );
  assertEquals(
    body.provider,
    "openai",
    "Expected OpenAI fallback provider to be reported",
  );
  assert(
    fetchedUrls.some((url) => url.includes("api.openai.com/v1/audio/speech")),
    "Expected OpenAI TTS fallback to be tried after ElevenLabs rate limiting",
  );
});

Deno.test("generate-mentor-audio does not fall back for ElevenLabs configuration errors", async () => {
  const fetchedUrls: string[] = [];
  Deno.env.set("ELEVENLABS_API_KEY", "test-elevenlabs-key");
  Deno.env.set("OPENAI_API_KEY", "test-openai-key");

  const response = await mentorAudioModule.handleGenerateMentorAudio(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ mentorSlug: "lyra", script: "Keep going." }),
    }),
    {
      authorize: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => createMockSupabase({}),
      fetchImpl: async (input) => {
        const url = String(input);
        fetchedUrls.push(url);
        return new Response(JSON.stringify({ error: "bad voice or auth" }), {
          status: 401,
        });
      },
      checkRateLimitFn: async () => ({
        allowed: true,
        available: true,
        remaining: 14,
        limit: 15,
        resetAt: new Date("2026-03-29T00:00:00.000Z"),
      }),
      now: () => 1000,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    500,
    "Expected non-transient ElevenLabs failures to fail loudly",
  );
  assert(
    typeof body.error === "string" &&
      body.error.includes("ElevenLabs API error: 401"),
    "Expected the ElevenLabs configuration error to be surfaced",
  );
  assert(
    fetchedUrls.some((url) => url.includes("elevenlabs.io")),
    "Expected ElevenLabs to be tried",
  );
  assert(
    !fetchedUrls.some((url) => url.includes("api.openai.com/v1/audio/speech")),
    "Expected OpenAI fallback not to run for configuration/auth failures",
  );
});
