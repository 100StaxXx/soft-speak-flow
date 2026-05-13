import {
  COSMIQ_TITLE_CARD_PROMPT_VERSION,
  getCosmiqTitleCardCacheState,
  resolveCosmiqTitleCard,
} from "./cosmiqTitleCard.ts";
import { CostGuardrailBlockedError } from "./costGuardrails.ts";
import type { CompanionStatAnalysis } from "../../../src/shared/companionStatAnalysis.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}. Expected ${JSON.stringify(expected)}, got ${
        JSON.stringify(actual)
      }`,
    );
  }
}

const baseAnalysis: CompanionStatAnalysis = {
  analysisDate: "2026-04-30",
  timezone: "America/Los_Angeles",
  generatedAt: "2026-04-30T18:00:00.000Z",
  mentor: {
    id: "mentor-1",
    name: "Eli",
    tone: "Supportive and specific",
    avatarUrl: null,
    primaryColor: "#ff7a59",
  },
  companion: {
    id: "companion-1",
    currentStage: 4,
    currentXp: 380,
  },
  activitySnapshot: {
    activityStartDate: "2026-04-24",
    activityEndDate: "2026-04-30",
    provenanceStartDate: "2026-04-01",
    provenanceEndDate: "2026-04-30",
    morningCheckIns: 4,
    eveningReflections: 3,
    habitCompletions: 6,
    onTimeTasks: 4,
    trackedAttributeEvents: 9,
    streakMilestones: 1,
    hardTaskWins: 2,
    recoveryActions: 1,
    healthActions: 2,
    creativeActions: 1,
    relationshipActions: 1,
    epicLinkedCompletions: 1,
    bounceBackDays: 1,
  },
  statProfile: {
    scores: {
      vitality: 420,
      wisdom: 510,
      discipline: 560,
      resolve: 480,
      creativity: 360,
      alignment: 530,
    },
    dominantStat: "discipline",
    secondaryStat: "alignment",
  },
  statNeeds: {
    vitality: { level: "medium", reasons: ["Recovery could use support."] },
    wisdom: { level: "low", reasons: [] },
    discipline: { level: "low", reasons: [] },
    resolve: { level: "low", reasons: [] },
    creativity: {
      level: "medium",
      reasons: ["Creative expression is underfed."],
    },
    alignment: { level: "low", reasons: [] },
  },
  cosmiqTitle: {
    title: "The Oathbound Pathfinder",
    rarity: "rare",
    momentum: "steady",
    dominantStat: "discipline",
    secondaryStat: "alignment",
    rebalanceStat: "creativity",
    fusion: true,
    rebalancePath:
      "Strengthen Creativity to evolve toward The Soulforged Creator.",
    titleStability: "new",
  },
  fantasyTitle: {
    title: "The Oathbound Pathfinder",
    archetype: "Discipline / Alignment",
    explanation:
      "A sworn navigator who binds ritual to purpose, guiding the party along the truest road even when the map goes quiet.",
  },
  momentumState: "coasting",
  recentMissInterpretation: "normal_variance",
  narrativeBrief: "Discipline has been your clearest recent shape.",
  dailyNarrative: "Discipline-heavy day",
  weeklyNarrative: "Discipline is leading lately, with Alignment close behind.",
  identityBootstrap:
    "Here's who you've been lately: Discipline has been your clearest trait.",
  strongestRecentDrivers: [],
  statBreakdowns: [
    {
      attribute: "vitality",
      score: 420,
      band: "Building",
      status: "Building",
      primaryReasons: ["Vitality is building."],
      recentDrivers: [],
    },
    {
      attribute: "wisdom",
      score: 510,
      band: "Strong",
      status: "Strong",
      primaryReasons: ["Wisdom is strong."],
      recentDrivers: [],
    },
    {
      attribute: "discipline",
      score: 560,
      band: "Strong",
      status: "Strong",
      primaryReasons: ["Discipline is strong."],
      recentDrivers: [],
    },
    {
      attribute: "resolve",
      score: 480,
      band: "Building",
      status: "Building",
      primaryReasons: ["Resolve is building."],
      recentDrivers: [],
    },
    {
      attribute: "creativity",
      score: 360,
      band: "Building",
      status: "Building",
      primaryReasons: ["Creativity is building."],
      recentDrivers: [],
    },
    {
      attribute: "alignment",
      score: 530,
      band: "Strong",
      status: "Strong",
      primaryReasons: ["Alignment is strong."],
      recentDrivers: [],
    },
  ],
  summary: "Eli sees consistent momentum in your daily rhythm.",
  suggestedAction: "Pair one morning check-in with one on-time task today.",
};

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createOpenAiImageResponse(
  base64Image = btoa("image-bytes"),
): Response {
  return createJsonResponse({
    data: [
      {
        b64_json: base64Image,
      },
    ],
  });
}

function createOpenAiImageUrlResponse(
  imageUrl = "https://images.example.com/card.png",
): Response {
  return createJsonResponse({
    data: [
      {
        url: imageUrl,
      },
    ],
  });
}

function createMockSupabase(
  beginRows: unknown[],
  options: {
    beginError?: { message: string } | null;
    completeError?: { message: string } | null;
    uploadError?: { message: string } | null;
    publicUrl?: string | null;
  } = {},
) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const uploaded: Array<
    { bucket: string; path: string; contentType: string | undefined }
  > = [];
  const inserts: Array<{ table: string; payload: unknown }> = [];
  const upserts: Array<{ table: string; payload: unknown; options: unknown }> =
    [];

  const from = (table: string) => {
    const builder = {
      select() {
        return builder;
      },
      eq() {
        return builder;
      },
      in() {
        return Promise.resolve({ data: [], error: null });
      },
      insert(payload: unknown) {
        inserts.push({ table, payload });
        return Promise.resolve({ error: null });
      },
      upsert(payload: unknown, options: unknown) {
        upserts.push({ table, payload, options });
        return Promise.resolve({ error: null });
      },
    };

    return builder;
  };

  return {
    rpcCalls,
    uploaded,
    inserts,
    upserts,
    from,
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      if (name === "begin_cosmiq_title_card_generation") {
        if (options.beginError) {
          return Promise.resolve({ data: null, error: options.beginError });
        }
        return Promise.resolve({ data: beginRows.shift() ?? [], error: null });
      }
      if (name === "complete_cosmiq_title_card_generation") {
        return Promise.resolve({
          data: null,
          error: options.completeError ?? null,
        });
      }
      return Promise.resolve({
        data: null,
        error: { message: "unexpected rpc" },
      });
    },
    storage: {
      from(bucket: string) {
        return {
          upload(
            path: string,
            _bytes: Uint8Array,
            uploadOptions: { contentType?: string },
          ) {
            uploaded.push({
              bucket,
              path,
              contentType: uploadOptions.contentType,
            });
            return Promise.resolve({ error: options.uploadError ?? null });
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: options.publicUrl === undefined
                  ? `https://cdn.example.com/${bucket}/${path}`
                  : options.publicUrl,
              },
            };
          },
        };
      },
    },
  };
}

function createMockCacheSupabase(row: unknown) {
  return {
    from(table: string) {
      assertEquals(
        table,
        "companion_cosmiq_title_cards",
        "Expected title-card cache table lookup",
      );
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: row, error: null });
        },
      };
      return builder;
    },
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (typeof value === "string") {
    Deno.env.set(name, value);
  } else {
    Deno.env.delete(name);
  }
}

Deno.test("resolveCosmiqTitleCard returns cached ready images without regenerating", async () => {
  const supabase = createMockSupabase([
    [{
      action: "ready",
      status: "ready",
      image_url: "https://cdn.example.com/ready.png",
      image_urls: [
        "https://cdn.example.com/ready.png",
        "https://cdn.example.com/ready-variant-2.png",
      ],
      prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
    }],
  ]);
  let fetchCalled = false;

  const card = await resolveCosmiqTitleCard({
    supabase,
    userId: "user-1",
    analysis: baseAnalysis,
    fetchImpl: (() => {
      fetchCalled = true;
      return Promise.resolve(createJsonResponse({}));
    }) as typeof fetch,
  });

  assertEquals(card.status, "ready", "Expected cached card to be ready");
  assertEquals(card.cached, true, "Expected cached flag");
  assertEquals(
    card.imageUrl,
    "https://cdn.example.com/ready.png",
    "Expected cached image URL",
  );
  assertEquals(card.imageUrls?.length, 2, "Expected cached slideshow URLs");
  assertEquals(fetchCalled, false, "Expected no image fetch on cache hit");
  assertEquals(
    supabase.uploaded.length,
    0,
    "Expected no storage upload on cache hit",
  );
});

Deno.test("getCosmiqTitleCardCacheState reopens stale unavailable rows for regeneration", async () => {
  const card = await getCosmiqTitleCardCacheState({
    supabase: createMockCacheSupabase({
      image_url: null,
      image_urls: [],
      status: "unavailable",
      prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      failure_code: "missing_openai_key",
      failure_message: "Image generation is not configured yet.",
      retryable: false,
      last_attempt_at: "2026-05-03T16:00:00.000Z",
    }),
    analysis: baseAnalysis,
  });

  assertEquals(
    card.status,
    "generating",
    "Expected stale unavailable row to retry",
  );
  assertEquals(
    card.retryable,
    true,
    "Expected stale unavailable row to be retryable",
  );
  assertEquals(
    card.failureCode,
    "missing_openai_key",
    "Expected diagnostic to be preserved",
  );
});

Deno.test("getCosmiqTitleCardCacheState keeps guardrail-blocked rows unavailable", async () => {
  const card = await getCosmiqTitleCardCacheState({
    supabase: createMockCacheSupabase({
      image_url: null,
      image_urls: [],
      status: "unavailable",
      prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      failure_code: "guardrail_blocked",
      failure_message: "Art generation is paused by the budget guardrail.",
      retryable: false,
      last_attempt_at: "2026-05-03T16:00:00.000Z",
    }),
    analysis: baseAnalysis,
  });

  assertEquals(
    card.status,
    "unavailable",
    "Expected guardrail row to stay unavailable",
  );
  assertEquals(
    card.retryable,
    false,
    "Expected guardrail row to remain non-retryable",
  );
  assertEquals(
    card.failureCode,
    "guardrail_blocked",
    "Expected guardrail diagnostic to be preserved",
  );
});

Deno.test("resolveCosmiqTitleCard returns sanitized diagnostics when the generation RPC fails", async () => {
  const supabase = createMockSupabase([], {
    beginError: {
      message: "function begin_cosmiq_title_card_generation does not exist",
    },
  });

  const card = await resolveCosmiqTitleCard({
    supabase,
    userId: "user-1",
    analysis: baseAnalysis,
  });

  assertEquals(
    card.status,
    "unavailable",
    "Expected RPC setup failure to be unavailable",
  );
  assertEquals(
    card.failureCode,
    "generation_rpc_failed",
    "Expected sanitized RPC failure code",
  );
  assertEquals(
    card.failureMessage,
    "Title art setup is out of sync. Update required.",
    "Expected sanitized RPC message",
  );
  assertEquals(
    card.retryable,
    false,
    "Expected RPC setup failure to be non-retryable",
  );
  assertEquals(
    supabase.uploaded.length,
    0,
    "Expected no upload after RPC setup failure",
  );
});

Deno.test("resolveCosmiqTitleCard records non-retryable diagnostics when the OpenAI key is missing", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.delete("OPENAI_API_KEY");

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
    });

    const completeCall = supabase.rpcCalls.find((call) =>
      call.name === "complete_cosmiq_title_card_generation"
    );
    assertEquals(
      card.status,
      "unavailable",
      "Expected missing API key to be unavailable",
    );
    assertEquals(
      card.failureCode,
      "missing_openai_key",
      "Expected missing-key diagnostic code",
    );
    assertEquals(
      card.failureMessage,
      "Image generation is not configured yet.",
      "Expected sanitized missing-key message",
    );
    assertEquals(
      card.retryable,
      false,
      "Expected missing-key diagnostic to be non-retryable",
    );
    assertEquals(
      completeCall?.args.p_failure_code,
      "missing_openai_key",
      "Expected missing-key code to be persisted",
    );
    assertEquals(
      completeCall?.args.p_retryable,
      false,
      "Expected missing-key retry flag to be persisted",
    );
    assertEquals(
      supabase.uploaded.length,
      0,
      "Expected no upload without an API key",
    );
  } finally {
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard generates, uploads, and completes a first image", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);
    let requestPrompt = "";
    let requestUrl = "";
    let requestModel = "";

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      visualPersona: "female",
      fetchImpl: ((input: string | URL | Request, init?: RequestInit) => {
        requestUrl = String(input);
        const requestBody = typeof init?.body === "string"
          ? JSON.parse(init.body) as {
            model?: unknown;
            prompt?: unknown;
            size?: unknown;
            quality?: unknown;
            n?: unknown;
            messages?: unknown;
            modalities?: unknown;
            image_size?: unknown;
          }
          : {};
        requestModel = typeof requestBody.model === "string"
          ? requestBody.model
          : "";
        requestPrompt = typeof requestBody.prompt === "string"
          ? requestBody.prompt
          : "";
        assertEquals(
          requestUrl,
          "https://api.openai.com/v1/images/generations",
          "Expected direct OpenAI Image API endpoint",
        );
        assertEquals(
          requestBody.model,
          "gpt-image-1-mini",
          "Expected GPT Image 1 mini model",
        );
        assertEquals(
          requestBody.size,
          "1024x1536",
          "Expected portrait image generation size",
        );
        assertEquals(
          requestBody.quality,
          "medium",
          "Expected medium quality title art",
        );
        assertEquals(
          requestBody.n,
          1,
          "Expected one generated title card image",
        );
        assertEquals(
          requestBody.messages,
          undefined,
          "Expected no chat-completions messages payload",
        );
        assertEquals(
          requestBody.modalities,
          undefined,
          "Expected no chat-completions modalities payload",
        );
        assertEquals(
          requestBody.image_size,
          undefined,
          "Expected Image API size instead of chat image_size",
        );
        return Promise.resolve(createOpenAiImageResponse());
      }) as typeof fetch,
    });

    const completeCall = supabase.rpcCalls.find((call) =>
      call.name === "complete_cosmiq_title_card_generation"
    );
    const beginCall = supabase.rpcCalls.find((call) =>
      call.name === "begin_cosmiq_title_card_generation"
    );
    assertEquals(card.status, "ready", "Expected generated card to be ready");
    assertEquals(card.cached, false, "Expected fresh card to not be cached");
    assert(
      card.imageUrl?.startsWith("https://cdn.example.com/cosmiq-title-cards/"),
      "Expected public storage URL",
    );
    assertEquals(card.imageUrls?.length, 1, "Expected one fast-path image URL");
    assertEquals(
      card.imageUrls?.[0],
      card.imageUrl,
      "Expected imageUrls to preserve the primary image",
    );
    assertEquals(supabase.uploaded.length, 1, "Expected one storage upload");
    assert(
      supabase.uploaded[0].path.endsWith(".png"),
      "Expected PNG upload path",
    );
    assertEquals(
      beginCall?.args.p_visual_persona,
      "female",
      "Expected visual persona in generation claim",
    );
    assert(
      String(beginCall?.args.p_profile_key).includes("female"),
      "Expected visual persona in shared cache key",
    );
    assertEquals(
      beginCall?.args.p_stale_after,
      "75 seconds",
      "Expected quick stale-generation recovery",
    );
    assertEquals(
      completeCall?.args.p_status,
      "ready",
      "Expected generation completion to be marked ready",
    );
    assertEquals(
      JSON.stringify(completeCall?.args.p_image_urls),
      JSON.stringify([card.imageUrl]),
      "Expected primary image URL to be persisted in image_urls",
    );
    assertEquals(
      requestModel,
      "gpt-image-1-mini",
      "Expected no Gemini model fallback",
    );
    assert(
      requestPrompt.includes("female fantasy character"),
      "Expected female visual persona prompt guidance",
    );
    assert(
      !requestPrompt.includes("Momentum:"),
      "Shared card prompt should not include momentum-only UI state",
    );
  } finally {
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard records retryable diagnostics for upstream image failures", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  const originalWarn = console.warn;
  Deno.env.set("OPENAI_API_KEY", "test-key");
  console.warn = () => undefined;

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: (() =>
        Promise.resolve(
          createJsonResponse({ error: "raw upstream detail" }, 503),
        )) as typeof fetch,
    });

    const completeCall = supabase.rpcCalls.find((call) =>
      call.name === "complete_cosmiq_title_card_generation"
    );
    assertEquals(
      card.status,
      "unavailable",
      "Expected upstream failure to be unavailable",
    );
    assertEquals(
      card.failureCode,
      "upstream_error",
      "Expected upstream diagnostic code",
    );
    assertEquals(
      card.failureMessage,
      "Image API failed. Retrying.",
      "Expected sanitized upstream message",
    );
    assertEquals(
      card.retryable,
      true,
      "Expected upstream failure to be retryable",
    );
    assertEquals(
      completeCall?.args.p_failure_code,
      "upstream_error",
      "Expected upstream code to be persisted",
    );
    assertEquals(
      completeCall?.args.p_error_message,
      "Image API failed. Retrying.",
      "Expected only sanitized message to be persisted",
    );
    assertEquals(
      completeCall?.args.p_retryable,
      true,
      "Expected retryable flag to be persisted",
    );
    assertEquals(
      supabase.uploaded.length,
      0,
      "Expected no upload after upstream failure",
    );
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard falls back when GPT Image 1 mini is forbidden", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  const originalWarn = console.warn;
  Deno.env.set("OPENAI_API_KEY", "test-key");
  console.warn = () => undefined;

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);
    const requestedModels: string[] = [];

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: ((input: string | URL | Request, init?: RequestInit) => {
        assertEquals(
          String(input),
          "https://api.openai.com/v1/images/generations",
          "Expected Image API endpoint for each model attempt",
        );
        const requestBody = typeof init?.body === "string"
          ? JSON.parse(init.body) as { model?: unknown; messages?: unknown }
          : {};
        requestedModels.push(String(requestBody.model ?? ""));
        assertEquals(
          requestBody.messages,
          undefined,
          "Expected fallback to stay on Image API, not chat completions",
        );

        if (requestBody.model === "gpt-image-1-mini") {
          return Promise.resolve(
            createJsonResponse({
              error: {
                message: "Project does not have access to gpt-image-1-mini",
              },
            }, 403),
          );
        }

        return Promise.resolve(createOpenAiImageResponse());
      }) as typeof fetch,
    });

    assertEquals(card.status, "ready", "Expected fallback image to be ready");
    assertEquals(
      requestedModels[0],
      "gpt-image-1-mini",
      "Expected GPT Image 1 mini to remain the first attempted model",
    );
    assertEquals(
      requestedModels[1],
      "gpt-image-1",
      "Expected gpt-image-1 fallback after GPT Image 1 mini access failure",
    );
    assertEquals(
      supabase.uploaded.length,
      1,
      "Expected fallback image to be uploaded",
    );
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard downloads URL image payloads when OpenAI returns URLs", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);
    const imageUrl = "https://images.example.com/generated-title-card.png";
    const fetchedUrls: string[] = [];

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: ((input: string | URL | Request) => {
        fetchedUrls.push(String(input));
        if (String(input) === "https://api.openai.com/v1/images/generations") {
          return Promise.resolve(createOpenAiImageUrlResponse(imageUrl));
        }

        return Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          }),
        );
      }) as typeof fetch,
    });

    assertEquals(
      card.status,
      "ready",
      "Expected URL image payload to become ready",
    );
    assertEquals(
      supabase.uploaded.length,
      1,
      "Expected downloaded image to be uploaded",
    );
    assertEquals(
      supabase.uploaded[0].contentType,
      "image/png",
      "Expected downloaded content type to be preserved",
    );
    assert(
      fetchedUrls.includes(imageUrl),
      "Expected generated OpenAI image URL to be downloaded",
    );
  } finally {
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard records retryable diagnostics for storage upload failures", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  const originalWarn = console.warn;
  Deno.env.set("OPENAI_API_KEY", "test-key");
  console.warn = () => undefined;

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ], {
      uploadError: { message: "raw storage detail" },
    });
    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: (() =>
        Promise.resolve(createOpenAiImageResponse())) as typeof fetch,
    });

    const completeCall = supabase.rpcCalls.find((call) =>
      call.name === "complete_cosmiq_title_card_generation"
    );
    assertEquals(
      card.status,
      "unavailable",
      "Expected storage upload failure to be unavailable",
    );
    assertEquals(
      card.failureCode,
      "storage_upload_failed",
      "Expected storage diagnostic code",
    );
    assertEquals(
      card.failureMessage,
      "Title art storage upload failed. Retrying.",
      "Expected sanitized storage message",
    );
    assertEquals(
      card.retryable,
      true,
      "Expected storage failure to be retryable",
    );
    assertEquals(
      completeCall?.args.p_failure_code,
      "storage_upload_failed",
      "Expected storage code to be persisted",
    );
    assertEquals(
      completeCall?.args.p_error_message,
      "Title art storage upload failed. Retrying.",
      "Expected sanitized storage message to be persisted",
    );
    assertEquals(
      completeCall?.args.p_retryable,
      true,
      "Expected retryable flag to be persisted",
    );
    assertEquals(
      supabase.uploaded.length,
      1,
      "Expected upload attempt before storage failure",
    );
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard records retryable diagnostics for missing public storage URLs", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  const originalWarn = console.warn;
  Deno.env.set("OPENAI_API_KEY", "test-key");
  console.warn = () => undefined;

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ], {
      publicUrl: null,
    });
    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: (() =>
        Promise.resolve(createOpenAiImageResponse())) as typeof fetch,
    });

    const completeCall = supabase.rpcCalls.find((call) =>
      call.name === "complete_cosmiq_title_card_generation"
    );
    assertEquals(
      card.status,
      "unavailable",
      "Expected public URL failure to be unavailable",
    );
    assertEquals(
      card.failureCode,
      "public_url_failed",
      "Expected public URL diagnostic code",
    );
    assertEquals(
      card.failureMessage,
      "Title art storage URL failed. Retrying.",
      "Expected sanitized public URL message",
    );
    assertEquals(
      card.retryable,
      true,
      "Expected public URL failure to be retryable",
    );
    assertEquals(
      completeCall?.args.p_failure_code,
      "public_url_failed",
      "Expected public URL code to be persisted",
    );
    assertEquals(
      completeCall?.args.p_retryable,
      true,
      "Expected retryable flag to be persisted",
    );
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard generates one blocking image request for the fast path", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);
    let activeFetches = 0;
    let maxActiveFetches = 0;
    let fetchCount = 0;

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl:
        (async (_input: string | URL | Request, _init?: RequestInit) => {
          activeFetches += 1;
          fetchCount += 1;
          maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
          try {
            await Promise.resolve();
            return createOpenAiImageResponse();
          } finally {
            activeFetches -= 1;
          }
        }) as typeof fetch,
    });

    assertEquals(
      card.status,
      "ready",
      "Expected fast-path generation to complete",
    );
    assertEquals(
      card.imageUrls?.length,
      1,
      "Expected only the primary image to be generated",
    );
    assertEquals(fetchCount, 1, "Expected one upstream image request");
    assertEquals(
      maxActiveFetches,
      1,
      "Expected image requests to avoid concurrent budget checks",
    );
  } finally {
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard falls back when primary image generation is blocked", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  const originalWarn = console.warn;
  Deno.env.set("OPENAI_API_KEY", "test-key");
  console.warn = () => undefined;

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);
    let fetchCount = 0;

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: ((_input: string | URL | Request, _init?: RequestInit) => {
        fetchCount += 1;
        throw new CostGuardrailBlockedError("budget exhausted", {
          scopeType: "endpoint",
          scopeKey: "generate-cosmiq-title-card",
        });
      }) as typeof fetch,
    });

    const completeCall = supabase.rpcCalls.find((call) =>
      call.name === "complete_cosmiq_title_card_generation"
    );
    assertEquals(
      card.status,
      "unavailable",
      "Expected blocked primary generation to be unavailable",
    );
    assertEquals(card.imageUrl, null, "Expected no image URL when blocked");
    assertEquals(
      card.failureCode,
      "guardrail_blocked",
      "Expected guardrail diagnostic code",
    );
    assertEquals(
      card.failureMessage,
      "Art generation is paused by the budget guardrail.",
      "Expected sanitized guardrail message",
    );
    assertEquals(
      card.retryable,
      false,
      "Expected guardrail block to be non-retryable",
    );
    assertEquals(
      supabase.uploaded.length,
      0,
      "Expected no upload when primary generation is blocked",
    );
    assertEquals(fetchCount, 1, "Expected one primary generation attempt");
    assertEquals(
      completeCall?.args.p_status,
      "unavailable",
      "Expected unavailable state to be persisted",
    );
    assertEquals(
      completeCall?.args.p_failure_code,
      "guardrail_blocked",
      "Expected guardrail code to be persisted",
    );
    assertEquals(
      completeCall?.args.p_retryable,
      false,
      "Expected guardrail retry flag to be persisted",
    );
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard logs completion RPC result errors", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  Deno.env.set("OPENAI_API_KEY", "test-key");
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const supabase = createMockSupabase(
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
      { completeError: { message: "completion write failed" } },
    );
    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: ((_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(createOpenAiImageResponse())) as typeof fetch,
    });

    assertEquals(
      card.status,
      "ready",
      "Completion logging should not block the ready card response",
    );
    assert(
      warnings.some(([message, metadata]) =>
        message === "[CosmiqTitleCard] Failed completing generation state" &&
        typeof metadata === "object" &&
        metadata !== null &&
        (metadata as { error?: string }).error === "completion write failed"
      ),
      "Expected RPC result errors to be logged",
    );
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard sends forced refresh claims and writes a replacement image path", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.set("OPENAI_API_KEY", "test-key");

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);
    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      forceRefresh: true,
      fetchImpl: ((_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(
          createOpenAiImageResponse(btoa("replacement-image")),
        )) as typeof fetch,
    });

    const beginCall = supabase.rpcCalls.find((call) =>
      call.name === "begin_cosmiq_title_card_generation"
    );
    assertEquals(
      beginCall?.args.p_force_refresh,
      true,
      "Expected forced refresh to reach generation claim",
    );
    assertEquals(
      card.status,
      "ready",
      "Expected forced refresh card to become ready",
    );
    assert(
      supabase.uploaded[0].path.includes("__"),
      "Expected forced refresh to avoid reusing the broken storage path",
    );
  } finally {
    restoreEnv("OPENAI_API_KEY", originalApiKey);
  }
});

Deno.test("resolveCosmiqTitleCard respects an in-flight shared generation claim", async () => {
  const supabase = createMockSupabase([
    [{
      action: "generating",
      status: "generating",
      image_url: null,
      prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
    }],
  ]);
  let fetchCalled = false;

  const card = await resolveCosmiqTitleCard({
    supabase,
    userId: "user-1",
    analysis: baseAnalysis,
    fetchImpl: (() => {
      fetchCalled = true;
      return Promise.resolve(createJsonResponse({}));
    }) as typeof fetch,
  });

  assertEquals(card.status, "generating", "Expected in-flight card status");
  assertEquals(card.imageUrl, null, "Expected no image URL during generation");
  assertEquals(fetchCalled, false, "Expected no duplicate image generation");
});

Deno.test("resolveCosmiqTitleCard falls back to unavailable when guardrails block generation", async () => {
  const originalApiKey = Deno.env.get("OPENAI_API_KEY");
  const originalKillSwitch = Deno.env.get("COST_KILL_SWITCH_IMAGE");
  const originalWarn = console.warn;
  Deno.env.set("OPENAI_API_KEY", "test-key");
  Deno.env.set("COST_KILL_SWITCH_IMAGE", "true");
  console.warn = () => undefined;

  try {
    const supabase = createMockSupabase([
      [{
        action: "started",
        status: "generating",
        image_url: null,
        prompt_version: COSMIQ_TITLE_CARD_PROMPT_VERSION,
      }],
    ]);
    let fetchCalled = false;

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: (() => {
        fetchCalled = true;
        return Promise.resolve(createJsonResponse({}));
      }) as typeof fetch,
    });

    const completeCall = supabase.rpcCalls.find((call) =>
      call.name === "complete_cosmiq_title_card_generation"
    );
    assertEquals(
      card.status,
      "unavailable",
      "Expected guardrail fallback status",
    );
    assertEquals(card.imageUrl, null, "Expected no image URL when blocked");
    assertEquals(
      card.failureCode,
      "guardrail_blocked",
      "Expected guardrail diagnostic code",
    );
    assertEquals(
      card.failureMessage,
      "Art generation is paused by the budget guardrail.",
      "Expected sanitized guardrail message",
    );
    assertEquals(
      card.retryable,
      false,
      "Expected guardrail block to be non-retryable",
    );
    assertEquals(
      fetchCalled,
      false,
      "Expected blocked generation to skip upstream fetch",
    );
    assertEquals(
      completeCall?.args.p_status,
      "unavailable",
      "Expected unavailable completion state",
    );
    assertEquals(
      completeCall?.args.p_failure_code,
      "guardrail_blocked",
      "Expected guardrail code to be persisted",
    );
    assertEquals(
      completeCall?.args.p_retryable,
      false,
      "Expected guardrail retry flag to be persisted",
    );
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
    restoreEnv("COST_KILL_SWITCH_IMAGE", originalKillSwitch);
  }
});
