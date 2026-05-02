import {
  COSMIQ_TITLE_CARD_PROMPT_VERSION,
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
    throw new Error(`${message}. Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
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
    creativity: { level: "medium", reasons: ["Creative expression is underfed."] },
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
    rebalancePath: "Strengthen Creativity to evolve toward The Soulforged Creator.",
    titleStability: "new",
  },
  fantasyTitle: {
    title: "The Oathbound Pathfinder",
    archetype: "Discipline / Alignment",
    explanation:
      "Discipline is leading with Alignment close behind. Strengthen Creativity to evolve toward The Soulforged Creator.",
  },
  momentumState: "coasting",
  recentMissInterpretation: "normal_variance",
  narrativeBrief: "Discipline has been your clearest recent shape.",
  dailyNarrative: "Discipline-heavy day",
  weeklyNarrative: "Discipline is leading lately, with Alignment close behind.",
  identityBootstrap: "Here's who you've been lately: Discipline has been your clearest trait.",
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

function createMockSupabase(
  beginRows: unknown[],
  options: { completeError?: { message: string } | null } = {},
) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const uploaded: Array<{ bucket: string; path: string; contentType: string | undefined }> = [];
  const inserts: Array<{ table: string; payload: unknown }> = [];
  const upserts: Array<{ table: string; payload: unknown; options: unknown }> = [];

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
        return Promise.resolve({ data: beginRows.shift() ?? [], error: null });
      }
      if (name === "complete_cosmiq_title_card_generation") {
        return Promise.resolve({ data: null, error: options.completeError ?? null });
      }
      return Promise.resolve({ data: null, error: { message: "unexpected rpc" } });
    },
    storage: {
      from(bucket: string) {
        return {
          upload(path: string, _bytes: Uint8Array, options: { contentType?: string }) {
            uploaded.push({ bucket, path, contentType: options.contentType });
            return Promise.resolve({ error: null });
          },
          getPublicUrl(path: string) {
            return {
              data: {
                publicUrl: `https://cdn.example.com/${bucket}/${path}`,
              },
            };
          },
        };
      },
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
  assertEquals(card.imageUrl, "https://cdn.example.com/ready.png", "Expected cached image URL");
  assertEquals(card.imageUrls?.length, 2, "Expected cached slideshow URLs");
  assertEquals(fetchCalled, false, "Expected no image fetch on cache hit");
  assertEquals(supabase.uploaded.length, 0, "Expected no storage upload on cache hit");
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
    const generatedDataUrl = `data:image/png;base64,${btoa("image-bytes")}`;
    let requestPrompt = "";

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      visualPersona: "female",
      fetchImpl: ((_input: string | URL | Request, init?: RequestInit) => {
        const requestBody = typeof init?.body === "string"
          ? JSON.parse(init.body) as { image_size?: unknown; messages?: Array<{ content?: unknown }> }
          : {};
        requestPrompt = typeof requestBody.messages?.[0]?.content === "string"
          ? requestBody.messages[0].content
          : "";
        assertEquals(requestBody.image_size, "1024x1536", "Expected portrait image generation size");
        return Promise.resolve(createJsonResponse({
          choices: [{
            message: {
              images: [{
                image_url: { url: generatedDataUrl },
              }],
            },
          }],
        }));
      }) as typeof fetch,
    });

    const completeCall = supabase.rpcCalls.find((call) => call.name === "complete_cosmiq_title_card_generation");
    const beginCall = supabase.rpcCalls.find((call) => call.name === "begin_cosmiq_title_card_generation");
    assertEquals(card.status, "ready", "Expected generated card to be ready");
    assertEquals(card.cached, false, "Expected fresh card to not be cached");
    assert(card.imageUrl?.startsWith("https://cdn.example.com/cosmiq-title-cards/"), "Expected public storage URL");
    assertEquals(card.imageUrls?.length, 1, "Expected one fast-path image URL");
    assertEquals(card.imageUrls?.[0], card.imageUrl, "Expected imageUrls to preserve the primary image");
    assertEquals(supabase.uploaded.length, 1, "Expected one storage upload");
    assert(supabase.uploaded[0].path.endsWith(".png"), "Expected PNG upload path");
    assertEquals(beginCall?.args.p_visual_persona, "female", "Expected visual persona in generation claim");
    assert(String(beginCall?.args.p_profile_key).includes("female"), "Expected visual persona in shared cache key");
    assertEquals(beginCall?.args.p_stale_after, "75 seconds", "Expected quick stale-generation recovery");
    assertEquals(completeCall?.args.p_status, "ready", "Expected generation completion to be marked ready");
    assertEquals(
      JSON.stringify(completeCall?.args.p_image_urls),
      JSON.stringify([card.imageUrl]),
      "Expected primary image URL to be persisted in image_urls",
    );
    assert(requestPrompt.includes("female fantasy character"), "Expected female visual persona prompt guidance");
    assert(!requestPrompt.includes("Momentum:"), "Shared card prompt should not include momentum-only UI state");
  } finally {
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
    const generatedDataUrl = `data:image/png;base64,${btoa("image-bytes")}`;
    let activeFetches = 0;
    let maxActiveFetches = 0;
    let fetchCount = 0;

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: (async (_input: string | URL | Request, _init?: RequestInit) => {
        activeFetches += 1;
        fetchCount += 1;
        maxActiveFetches = Math.max(maxActiveFetches, activeFetches);
        try {
          await Promise.resolve();
          return createJsonResponse({
            choices: [{
              message: {
                images: [{
                  image_url: { url: generatedDataUrl },
                }],
              },
            }],
          });
        } finally {
          activeFetches -= 1;
        }
      }) as typeof fetch,
    });

    assertEquals(card.status, "ready", "Expected fast-path generation to complete");
    assertEquals(card.imageUrls?.length, 1, "Expected only the primary image to be generated");
    assertEquals(fetchCount, 1, "Expected one upstream image request");
    assertEquals(maxActiveFetches, 1, "Expected image requests to avoid concurrent budget checks");
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

    const completeCall = supabase.rpcCalls.find((call) => call.name === "complete_cosmiq_title_card_generation");
    assertEquals(card.status, "unavailable", "Expected blocked primary generation to be unavailable");
    assertEquals(card.imageUrl, null, "Expected no image URL when blocked");
    assertEquals(supabase.uploaded.length, 0, "Expected no upload when primary generation is blocked");
    assertEquals(fetchCount, 1, "Expected one primary generation attempt");
    assertEquals(completeCall?.args.p_status, "unavailable", "Expected unavailable state to be persisted");
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
    const generatedDataUrl = `data:image/png;base64,${btoa("image-bytes")}`;

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      fetchImpl: ((_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(createJsonResponse({
          choices: [{
            message: {
              images: [{
                image_url: { url: generatedDataUrl },
              }],
            },
          }],
        }))) as typeof fetch,
    });

    assertEquals(card.status, "ready", "Completion logging should not block the ready card response");
    assert(
      warnings.some(([message, metadata]) =>
        message === "[CosmiqTitleCard] Failed completing generation state"
        && typeof metadata === "object"
        && metadata !== null
        && (metadata as { error?: string }).error === "completion write failed"
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
    const generatedDataUrl = `data:image/png;base64,${btoa("replacement-image")}`;

    const card = await resolveCosmiqTitleCard({
      supabase,
      userId: "user-1",
      analysis: baseAnalysis,
      forceRefresh: true,
      fetchImpl: ((_input: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(createJsonResponse({
          choices: [{
            message: {
              images: [{
                image_url: { url: generatedDataUrl },
              }],
            },
          }],
        }))) as typeof fetch,
    });

    const beginCall = supabase.rpcCalls.find((call) => call.name === "begin_cosmiq_title_card_generation");
    assertEquals(beginCall?.args.p_force_refresh, true, "Expected forced refresh to reach generation claim");
    assertEquals(card.status, "ready", "Expected forced refresh card to become ready");
    assert(supabase.uploaded[0].path.includes("__"), "Expected forced refresh to avoid reusing the broken storage path");
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

    const completeCall = supabase.rpcCalls.find((call) => call.name === "complete_cosmiq_title_card_generation");
    assertEquals(card.status, "unavailable", "Expected guardrail fallback status");
    assertEquals(card.imageUrl, null, "Expected no image URL when blocked");
    assertEquals(fetchCalled, false, "Expected blocked generation to skip upstream fetch");
    assertEquals(completeCall?.args.p_status, "unavailable", "Expected unavailable completion state");
  } finally {
    console.warn = originalWarn;
    restoreEnv("OPENAI_API_KEY", originalApiKey);
    restoreEnv("COST_KILL_SWITCH_IMAGE", originalKillSwitch);
  }
});
