function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nReceived: ${
        JSON.stringify(actual)
      }`,
    );
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
Deno.env.set("INTERNAL_FUNCTION_SECRET", "internal-secret");
Deno.env.set("OPENAI_API_KEY", "openai-key");

const module = await import("./index.ts");
const costGuardrailsModule = await import("../_shared/costGuardrails.ts");
type GenerateCompanionEvolutionDeps = NonNullable<
  Parameters<typeof module.handleGenerateCompanionEvolution>[1]
>;

const USER_ID = "user-1";

const withEnvValue = async <T>(
  name: string,
  value: string,
  run: () => Promise<T>,
): Promise<T> => {
  const previousValue = Deno.env.get(name);
  Deno.env.set(name, value);

  try {
    return await run();
  } finally {
    if (typeof previousValue === "string") {
      Deno.env.set(name, previousValue);
    } else {
      Deno.env.delete(name);
    }
  }
};

type CompanionRecord = {
  id: string;
  user_id: string;
  current_stage: number;
  current_xp: number;
  preset_id: string | null;
  current_image_url: string | null;
  initial_image_url: string | null;
  current_image_focal_x?: number | null;
  current_image_focal_y?: number | null;
  favorite_color: string;
  spirit_animal: string;
  core_element: string;
  story_tone?: string | null;
  visual_identity_profile?: unknown;
  image_lineage_metadata?: unknown;
  created_at?: string;
};

type EvolutionThreshold = {
  stage: number;
  xp_required: number;
};

const createInternalRequest = () =>
  new Request(
    "https://example.supabase.co/functions/v1/generate-companion-evolution",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": "internal-secret",
      },
      body: JSON.stringify({ userId: USER_ID }),
    },
  );

const createCompanion = (
  overrides: Partial<CompanionRecord> = {},
): CompanionRecord => ({
  id: "companion-1",
  user_id: USER_ID,
  current_stage: 0,
  current_xp: 14,
  preset_id: null,
  current_image_url: "https://example.com/stage-0.png",
  initial_image_url: "https://example.com/stage-0.png",
  current_image_focal_x: 0.5,
  current_image_focal_y: 0.5,
  favorite_color: "#00AAFF",
  spirit_animal: "Wolf",
  core_element: "water",
  story_tone: "epic_adventure",
  visual_identity_profile: null,
  image_lineage_metadata: null,
  created_at: "2026-04-01T00:00:00.000Z",
  ...overrides,
});

const createPassingScores = (difference = 7) => ({
  continuity: 8,
  difference,
  anatomy: 8,
  centering: 8,
  overall: 8,
  subjectCenterX: 0.44,
  subjectCenterY: 0.56,
  notes: "looks good",
});

type CompanionImageJudgeScoreFixture = ReturnType<typeof createPassingScores>;

const createFailingScores = () => ({
  continuity: 4,
  difference: 1,
  anatomy: 4,
  centering: 4,
  overall: 4,
  subjectCenterX: 0.2,
  subjectCenterY: 0.2,
  notes: "too similar to previous portrait",
});

const createSupabaseHarness = ({
  companion,
  thresholds,
  previousGenerationMetadata = null,
}: {
  companion: CompanionRecord;
  thresholds: EvolutionThreshold[];
  previousGenerationMetadata?: unknown;
}) => {
  const updatedCompanions: Array<Record<string, unknown>> = [];

  const supabase = {
    from: (table: string) => {
      if (table === "user_companion") {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: companion, error: null }),
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: async () => {
              updatedCompanions.push(payload);
              return { error: null };
            },
          }),
        };
      }

      if (table === "companion_evolutions") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: previousGenerationMetadata
              ? { generation_metadata: previousGenerationMetadata }
              : null,
            error: null,
          }),
        };
        return query;
      }

      if (table === "evolution_thresholds") {
        return {
          select: () => ({
            order: async () => ({ data: thresholds, error: null }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return {
    supabase,
    updatedCompanions,
  };
};

const createDeps = ({
  companion,
  thresholds,
  judgeScores = [createPassingScores()] as Array<
    CompanionImageJudgeScoreFixture | null
  >,
  previousGenerationMetadata = null,
  visualAnchors = [{
    schemaVersion: 1,
    level: companion.current_stage,
    sourceImageUrl: companion.current_image_url,
    capturedAt: "2026-05-01T00:00:00.000Z",
    summary: "same wolf companion with water aura",
    silhouette: ["lean wolf silhouette", "alert ears", "bushy tail"],
    anatomy: ["quadruped wolf anatomy"],
    face: ["bright blue eyes", "short muzzle"],
    markings: ["crescent forehead mark"],
    palette: ["blue and silver palette"],
    elementalEffects: ["water aura around paws"],
    poseFraming: ["centered three-quarter pose"],
    artStyle: ["stylized fantasy creature cutout"],
    signatureFeatures: ["cresting water ruff"],
    mustPreserve: ["wolf family", "crescent forehead mark", "blue eyes"],
    safeToEvolve: ["pose", "scale", "ruff intensity"],
  }],
}: {
  companion: CompanionRecord;
  thresholds: EvolutionThreshold[];
  judgeScores?: Array<CompanionImageJudgeScoreFixture | null>;
  previousGenerationMetadata?: unknown;
  visualAnchors?: Array<Record<string, unknown> | null>;
}) => {
  const { supabase, updatedCompanions } = createSupabaseHarness({
    companion,
    thresholds,
    previousGenerationMetadata,
  });
  const generateCalls: Array<Record<string, unknown>> = [];
  const judgeCalls: Array<Record<string, unknown>> = [];
  const extractAnchorCalls: Array<Record<string, unknown>> = [];
  const upsertCalls: Array<Record<string, unknown>> = [];
  const uploadCalls: Array<Record<string, unknown>> = [];
  const infoLogs: Array<unknown[]> = [];
  let judgeIndex = 0;
  let visualAnchorIndex = 0;
  let uploadIndex = 0;

  const deps = {
    createClient: () => supabase as never,
    checkRateLimit: async () => ({ allowed: true }) as never,
    createRateLimitResponse: () =>
      new Response("rate limited", { status: 429 }),
    resolveCompanionImageSizeForUser: () => "1536x1024",
    createCostGuardrailSession: () =>
      ({
        wrapFetch: (fetchFn: typeof fetch) => fetchFn,
        enforceAccess: async () => undefined,
      }) as never,
    generateCompanionImage: async (args: Record<string, unknown>) => {
      generateCalls.push(args as unknown as Record<string, unknown>);
      return {
        imageDataUrl: `data:image/png;base64,${
          btoa(`generated-${generateCalls.length}`)
        }`,
        revisedPrompt: null,
        size: String(args.size),
      };
    },
    judgeCompanionImage: async (args: Record<string, unknown>) => {
      judgeCalls.push(args as unknown as Record<string, unknown>);
      const scoreIndex = Math.min(judgeIndex, judgeScores.length - 1);
      const next = scoreIndex >= 0 ? judgeScores[scoreIndex] : undefined;
      judgeIndex += 1;
      return next === undefined ? createPassingScores() : next;
    },
    extractCompanionVisualAnchors: async (args: Record<string, unknown>) => {
      extractAnchorCalls.push(args as unknown as Record<string, unknown>);
      const next =
        visualAnchors[Math.min(visualAnchorIndex, visualAnchors.length - 1)] ??
          null;
      visualAnchorIndex += 1;
      return next as never;
    },
    registerUserStorageAsset: async () => undefined,
    uploadGeneratedImage: async (args: Record<string, unknown>) => {
      uploadCalls.push(args as unknown as Record<string, unknown>);
      uploadIndex += 1;
      return {
        fileName: `${USER_ID}/evolutions/generated-${uploadIndex}.png`,
        publicUrl: `https://example.com/generated-stage-${uploadIndex}.png`,
      };
    },
    upsertEvolutionRecord: async (args: Record<string, unknown>) => {
      upsertCalls.push(args as unknown as Record<string, unknown>);
      return { id: `evo-${upsertCalls.length}` } as never;
    },
    info: (...args: unknown[]) => {
      infoLogs.push(args);
    },
    error: (..._args: unknown[]) => undefined,
  } as unknown as GenerateCompanionEvolutionDeps;

  return {
    deps,
    updatedCompanions,
    generateCalls,
    judgeCalls,
    extractAnchorCalls,
    upsertCalls,
    uploadCalls,
    infoLogs,
  };
};

Deno.test("reveal path uses hidden stage-1 anchor without invoking image generation", async () => {
  const companion = createCompanion({
    image_lineage_metadata: {
      hiddenBoundaryAnchors: {
        "1": {
          imageUrl: "https://example.com/hidden-stage-1.png",
          focalX: 0.33,
          focalY: 0.66,
          sourceType: "bootstrap_generation",
          visibility: "hidden_until_reached",
        },
      },
    },
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 1, xp_required: 10 },
      { stage: 2, xp_required: 30 },
    ],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(response.status, 200, "Expected reveal response to succeed");
  assertEquals(
    payload.portrait_regenerated,
    false,
    "Expected reveal path to avoid portrait regeneration",
  );
  assertEquals(
    payload.image_url,
    "https://example.com/hidden-stage-1.png",
    "Expected reveal path to reuse hidden stage-1 image",
  );
  assertEquals(
    harness.generateCalls.length,
    0,
    "Expected reveal path to avoid bootstrap generation",
  );
  assertEquals(
    harness.judgeCalls.length,
    0,
    "Expected reveal path to avoid judge calls",
  );

  const upsertCall = harness.upsertCalls[0];
  assert(upsertCall, "Expected reveal path to upsert an evolution record");
  assertEquals(
    (upsertCall.generationMetadata as Record<string, unknown>).sourceType,
    "reveal",
    "Expected reveal path to persist reveal provenance",
  );
});

Deno.test("legacy stage-1 backfill generates a fresh starter and marks provenance explicitly", async () => {
  const companion = createCompanion({
    image_lineage_metadata: null,
    current_image_url: "https://example.com/legacy-ai-egg.png",
    initial_image_url: "https://example.com/legacy-ai-egg.png",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 1, xp_required: 10 },
      { stage: 2, xp_required: 30 },
    ],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected legacy backfill response to succeed",
  );
  assertEquals(
    payload.portrait_regenerated,
    true,
    "Expected legacy backfill to render a new stage-1 portrait",
  );
  assertEquals(
    harness.generateCalls.length,
    1,
    "Expected legacy backfill to generate a starter form once",
  );
  assertEquals(
    harness.generateCalls[0]?.background,
    "transparent",
    "Expected stage-1 generation to request a transparent background",
  );
  assertEquals(
    harness.generateCalls[0]?.outputFormat,
    "png",
    "Expected stage-1 generation to request PNG output",
  );
  assert(
    typeof harness.generateCalls[0]?.prompt === "string" &&
      harness.generateCalls[0].prompt.includes("transparent background"),
    "Expected stage-1 generation prompt to request transparent background output",
  );

  const upsertCall = harness.upsertCalls[0];
  assert(upsertCall, "Expected legacy backfill to upsert an evolution record");
  const generationMetadata = upsertCall.generationMetadata as Record<
    string,
    unknown
  >;
  assertEquals(
    generationMetadata.sourceType,
    "legacy_backfill",
    "Expected explicit legacy backfill provenance",
  );

  const updatedCompanion = harness.updatedCompanions[0];
  assert(updatedCompanion, "Expected companion row to be updated");
  const lineageMetadata = updatedCompanion.image_lineage_metadata as Record<
    string,
    unknown
  >;
  const hiddenAnchors = lineageMetadata.hiddenBoundaryAnchors as Record<
    string,
    Record<string, unknown>
  >;
  assertEquals(
    hiddenAnchors["1"]?.visibility,
    "visible",
    "Expected backfilled stage-1 anchor to be visible after hatch",
  );
  assert(
    harness.infoLogs.some(([message]) =>
      typeof message === "string" &&
      message.includes("Missing hidden stage-1 anchor for AI companion")
    ),
    "Expected legacy backfill to emit an explicit info log",
  );
});

Deno.test("intermediate earned levels skip directly to the next visual boundary", async () => {
  const companion = createCompanion({
    current_stage: 1,
    current_xp: 100,
    current_image_url: "https://example.com/stage-1.png",
    initial_image_url: "https://example.com/stage-0.png",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 2, xp_required: 30 },
      { stage: 3, xp_required: 60 },
      { stage: 4, xp_required: 80 },
      { stage: 5, xp_required: 100 },
      { stage: 6, xp_required: 240 },
    ],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected visual-boundary evolution response to succeed",
  );
  assertEquals(
    payload.previous_stage,
    1,
    "Expected previous stage to remain the claimed visual boundary",
  );
  assertEquals(
    payload.new_stage,
    5,
    "Expected manual evolution to target Level 5, not Level 2",
  );
  assertEquals(
    payload.portrait_regenerated,
    true,
    "Expected Level 5 boundary to render a new portrait",
  );
  assertEquals(
    harness.generateCalls.length,
    1,
    "Expected boundary evolution to generate from lineage metadata",
  );
  assertEquals(
    harness.extractAnchorCalls.length,
    1,
    "Expected boundary evolution to extract previous visual anchors",
  );
  assertEquals(
    harness.judgeCalls.length,
    1,
    "Expected boundary evolution to judge the boundary render",
  );
  assertEquals(
    harness.extractAnchorCalls[0]?.imageUrl,
    "https://example.com/stage-1.png",
    "Expected anchor extraction to inspect the previous portrait",
  );
  assert(
    !("referenceImages" in harness.generateCalls[0]),
    "Expected metadata-first generation to avoid sending the previous image as an edit input",
  );
  assertEquals(
    harness.judgeCalls[0]?.referenceImageUrl,
    "https://example.com/stage-1.png",
    "Expected judge to compare against the previous portrait",
  );

  const upsertCall = harness.upsertCalls[0];
  assert(
    upsertCall,
    "Expected boundary evolution to upsert an evolution record",
  );
  assertEquals(
    upsertCall.stage,
    5,
    "Expected evolution record to claim the next visual boundary",
  );
  const generationMetadata = upsertCall.generationMetadata as Record<
    string,
    unknown
  >;
  assertEquals(
    generationMetadata.sourceType,
    "lineage_generation",
    "Expected metadata-first generation provenance",
  );

  const updatedLineage = harness.updatedCompanions[0]
    ?.image_lineage_metadata as Record<string, unknown>;
  const visualAnchorsByLevel = updatedLineage.visualAnchorsByLevel as Record<
    string,
    Record<string, unknown>
  >;
  assertEquals(
    visualAnchorsByLevel["1"]?.summary,
    "same wolf companion with water aura",
    "Expected extracted anchors to persist by previous level",
  );
  assertEquals(
    harness.updatedCompanions[0]?.current_stage,
    5,
    "Expected companion row to claim Level 5",
  );
});

Deno.test("boundary evolutions retry after low judge scores and generate from visual anchors", async () => {
  const companion = createCompanion({
    current_stage: 4,
    current_xp: 120,
    current_image_url: "https://example.com/stage-4.png",
    initial_image_url: "https://example.com/stage-0.png",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 5, xp_required: 100 },
      { stage: 6, xp_required: 240 },
    ],
    judgeScores: [createFailingScores(), createPassingScores(7)],
  });

  const response = await withEnvValue(
    "COMPANION_EVOLUTION_RENDER_ATTEMPTS",
    "2",
    () =>
      module.handleGenerateCompanionEvolution(
        createInternalRequest(),
        harness.deps,
      ),
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    200,
    "Expected boundary evolution response to succeed",
  );
  assertEquals(
    payload.portrait_regenerated,
    true,
    "Expected boundary evolution to regenerate the portrait",
  );
  assertEquals(
    harness.generateCalls.length,
    2,
    "Expected boundary evolution to retry metadata-first generation after a low judge score",
  );
  assertEquals(
    harness.extractAnchorCalls.length,
    1,
    "Expected boundary evolution to extract anchors once",
  );
  assertEquals(
    harness.judgeCalls.length,
    2,
    "Expected boundary evolution to judge each render attempt",
  );

  const firstGenerateCall = harness.generateCalls[0];
  const secondGenerateCall = harness.generateCalls[1];
  assertEquals(
    firstGenerateCall.background,
    "transparent",
    "Expected boundary generation to request a transparent background",
  );
  assertEquals(
    firstGenerateCall.outputFormat,
    "png",
    "Expected boundary generation to request PNG output",
  );
  assert(
    typeof firstGenerateCall.prompt === "string" &&
      firstGenerateCall.prompt.includes("Previous form summary:") &&
      firstGenerateCall.prompt.includes("same wolf companion with water aura"),
    "Expected metadata-first prompt to include extracted visual anchors",
  );
  assert(
    typeof secondGenerateCall.prompt === "string" &&
      secondGenerateCall.prompt.includes("Retry critique:"),
    "Expected second boundary generation prompt to include judge critique feedback",
  );

  const upsertCall = harness.upsertCalls[0];
  assert(
    upsertCall,
    "Expected boundary evolution to upsert an evolution record",
  );
  const generationMetadata = upsertCall.generationMetadata as Record<
    string,
    unknown
  >;
  assertEquals(
    generationMetadata.sourceType,
    "lineage_generation",
    "Expected boundary evolution to persist metadata-first provenance",
  );
  assertEquals(
    generationMetadata.retryCount,
    1,
    "Expected boundary evolution retry count to reflect one retry",
  );
});

Deno.test("boundary evolutions do not persist candidates that fail available judge scores", async () => {
  const companion = createCompanion({
    current_stage: 4,
    current_xp: 120,
    current_image_url: "https://example.com/stage-4.png",
    initial_image_url: "https://example.com/stage-0.png",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 5, xp_required: 100 },
      { stage: 6, xp_required: 240 },
    ],
    judgeScores: [createFailingScores(), createFailingScores()],
  });

  const response = await withEnvValue(
    "COMPANION_EVOLUTION_RENDER_ATTEMPTS",
    "2",
    () =>
      module.handleGenerateCompanionEvolution(
        createInternalRequest(),
        harness.deps,
      ),
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    422,
    "Expected failed judge gate to stop the evolution",
  );
  assertEquals(
    payload.code,
    "evolution_quality_gate_failed",
    "Expected failed judge gate to return a terminal error code",
  );
  assert(
    typeof payload.error === "string" &&
      payload.error.includes("failed quality gate"),
    "Expected failed judge gate error message",
  );
  assertEquals(
    harness.generateCalls.length,
    2,
    "Expected both render attempts before stopping",
  );
  assertEquals(
    harness.uploadCalls.length,
    0,
    "Expected no upload for a rejected candidate",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no evolution record for a rejected candidate",
  );
  assertEquals(
    harness.updatedCompanions.length,
    0,
    "Expected no companion update for a rejected candidate",
  );
});

Deno.test("boundary evolutions do not persist when anchors and judge are unavailable", async () => {
  const companion = createCompanion({
    current_stage: 4,
    current_xp: 120,
    current_image_url: "https://example.com/stage-4.png",
    initial_image_url: "https://example.com/stage-0.png",
    image_lineage_metadata: null,
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 5, xp_required: 100 },
      { stage: 6, xp_required: 240 },
    ],
    judgeScores: [null],
    visualAnchors: [null],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    422,
    "Expected unverifiable continuity to stop the evolution",
  );
  assertEquals(
    payload.code,
    "evolution_continuity_unverified",
    "Expected unverifiable continuity to return a terminal error code",
  );
  assertEquals(
    harness.uploadCalls.length,
    0,
    "Expected no upload when neither anchors nor judge are available",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no evolution record when neither anchors nor judge are available",
  );
  assertEquals(
    harness.updatedCompanions.length,
    0,
    "Expected no companion update when neither anchors nor judge are available",
  );
});

Deno.test("boundary evolutions reject empty anchors when judge is unavailable", async () => {
  const companion = createCompanion({
    current_stage: 4,
    current_xp: 120,
    current_image_url: "https://example.com/stage-4.png",
    initial_image_url: "https://example.com/stage-0.png",
    image_lineage_metadata: null,
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 5, xp_required: 100 },
      { stage: 6, xp_required: 240 },
    ],
    judgeScores: [null],
    visualAnchors: [{
      schemaVersion: 1,
      level: 4,
      sourceImageUrl: "https://example.com/stage-4.png",
      capturedAt: "2026-05-01T00:00:00.000Z",
      summary: " ",
      silhouette: [" "],
      anatomy: [],
      face: [],
      markings: [],
      palette: [],
      elementalEffects: [],
      poseFraming: ["centered"],
      artStyle: ["transparent fantasy cutout"],
      signatureFeatures: [],
      mustPreserve: [],
      safeToEvolve: ["pose"],
    }],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    422,
    "Expected empty anchors to leave continuity unverifiable",
  );
  assertEquals(
    payload.code,
    "evolution_continuity_unverified",
    "Expected empty anchors to return the terminal continuity code",
  );
  assertEquals(
    harness.uploadCalls.length,
    0,
    "Expected no upload when only empty anchors are available",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no evolution record when only empty anchors are available",
  );
  assertEquals(
    harness.updatedCompanions.length,
    0,
    "Expected no companion update when only empty anchors are available",
  );
});

const createAnimationEnqueueHarness = () => {
  const updates: Array<
    {
      table: string;
      payload: Record<string, unknown>;
      column: string;
      value: unknown;
    }
  > = [];
  const upserts: Array<
    {
      table: string;
      payload: Record<string, unknown>;
      options: Record<string, unknown>;
    }
  > = [];
  const guardrailAccessCalls: Array<Record<string, unknown>> = [];

  const supabase = {
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          updates.push({ table, payload, column, value });
          return { error: null };
        },
      }),
      upsert: (
        payload: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => {
        upserts.push({ table, payload, options });
        return {
          select: () => ({
            single: async () => ({
              data: { id: "animation-job-1" },
              error: null,
            }),
          }),
        };
      },
    }),
  };

  const createCostGuardrailSession = () => ({
    enforceAccess: async (args: Record<string, unknown>) => {
      guardrailAccessCalls.push(args);
    },
  });

  return {
    supabase,
    updates,
    upserts,
    guardrailAccessCalls,
    createCostGuardrailSession,
  };
};

Deno.test("maybeEnqueueCompanionAnimationJob skips without touching storage when animation is disabled", async () => {
  const harness = createAnimationEnqueueHarness();

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: harness.createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 5,
    imageUrl: "https://example.com/stage-5.png",
    env: { get: () => undefined },
  });

  assertEquals(result.status, "skipped", "Expected disabled animation to skip");
  assertEquals(result.reason, "disabled", "Expected disabled skip reason");
  assertEquals(
    harness.upserts.length,
    0,
    "Expected no animation job upsert when disabled",
  );
  assertEquals(
    harness.updates.length,
    0,
    "Expected no evolution metadata update when disabled",
  );
});

Deno.test("maybeEnqueueCompanionAnimationJob records a skipped status when FAL_KEY is missing", async () => {
  const harness = createAnimationEnqueueHarness();

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: harness.createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 5,
    imageUrl: "https://example.com/stage-5.png",
    env: {
      get: (name: string) =>
        name === "COMPANION_ANIMATION_ENABLED" ? "true" : undefined,
    },
    now: () => new Date("2026-05-02T12:00:00.000Z"),
  });

  assertEquals(result.status, "skipped", "Expected missing FAL_KEY to skip");
  assertEquals(
    result.reason,
    "fal_key_missing",
    "Expected missing key skip reason",
  );
  assertEquals(
    harness.upserts.length,
    0,
    "Expected no animation job upsert without credentials",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_status,
    "skipped",
    "Expected evolution row to record skipped animation",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_error_code,
    "fal_key_missing",
    "Expected missing key metadata",
  );
});

Deno.test("maybeEnqueueCompanionAnimationJob skips non-boundary stages before queueing", async () => {
  const harness = createAnimationEnqueueHarness();

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: harness.createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 3,
    imageUrl: "https://example.com/stage-3.png",
    env: {
      get: (name: string) => {
        if (name === "COMPANION_ANIMATION_ENABLED") return "true";
        if (name === "FAL_KEY") return "fal-key";
        return undefined;
      },
    },
    now: () => new Date("2026-05-02T12:00:00.000Z"),
  });

  assertEquals(result.status, "skipped", "Expected non-boundary stage to skip");
  assertEquals(
    result.reason,
    "stage_not_animatable",
    "Expected stage skip reason",
  );
  assertEquals(
    harness.upserts.length,
    0,
    "Expected no animation job for non-boundary stage",
  );
  assertEquals(
    harness.guardrailAccessCalls.length,
    0,
    "Expected no video guardrail check for non-boundary stage",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_status,
    "skipped",
    "Expected evolution metadata to record skip",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_error_code,
    "stage_not_animatable",
    "Expected stage metadata",
  );
});

Deno.test("maybeEnqueueCompanionAnimationJob skips reused evolution images before queueing", async () => {
  const harness = createAnimationEnqueueHarness();

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: harness.createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 5,
    imageUrl: "https://example.com/stage-1.png",
    previousImageUrl: "https://example.com/stage-1.png",
    generationMetadata: {
      sourceType: "reuse",
      portraitRegenerated: false,
      reusedFromStage: 1,
    },
    env: {
      get: (name: string) => {
        if (name === "COMPANION_ANIMATION_ENABLED") return "true";
        if (name === "FAL_KEY") return "fal-key";
        return undefined;
      },
    },
    now: () => new Date("2026-05-02T12:00:00.000Z"),
  });

  assertEquals(
    result.status,
    "skipped",
    "Expected reused image animation to skip",
  );
  assertEquals(
    result.reason,
    "image_unchanged",
    "Expected unchanged-image skip reason",
  );
  assertEquals(
    harness.upserts.length,
    0,
    "Expected no animation job for reused images",
  );
  assertEquals(
    harness.guardrailAccessCalls.length,
    0,
    "Expected no guardrail check for reused images",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_status,
    "skipped",
    "Expected evolution metadata to record skip",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_error_code,
    "image_unchanged",
    "Expected unchanged-image metadata",
  );
});

Deno.test("maybeEnqueueCompanionAnimationJob enqueues only when enabled, credentialed, public, and allowed", async () => {
  const harness = createAnimationEnqueueHarness();

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: harness.createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 5,
    imageUrl: "https://example.com/stage-5.png",
    element: "water",
    env: {
      get: (name: string) => {
        if (name === "COMPANION_ANIMATION_ENABLED") return "true";
        if (name === "FAL_KEY") return "fal-key";
        if (name === "FAL_KLING_MODEL") {
          return "fal-ai/kling-video/v3/standard/image-to-video";
        }
        return undefined;
      },
    },
    now: () => new Date("2026-05-02T12:00:00.000Z"),
  });

  assertEquals(result.status, "queued", "Expected animation job to be queued");
  assertEquals(result.jobId, "animation-job-1", "Expected queued job id");
  assertEquals(
    JSON.stringify(harness.guardrailAccessCalls[0]?.capabilities),
    JSON.stringify(["video"]),
    "Expected video cost guardrail access check",
  );
  assertEquals(
    JSON.stringify(harness.guardrailAccessCalls[0]?.providers),
    JSON.stringify(["fal"]),
    "Expected fal provider guardrail access check",
  );
  assertEquals(
    harness.upserts[0]?.table,
    "companion_animation_jobs",
    "Expected companion animation job upsert",
  );
  assertEquals(
    harness.upserts[0]?.payload.source_image_url,
    "https://example.com/stage-5.png",
    "Expected public source image",
  );
  assertEquals(
    harness.upserts[0]?.payload.provider,
    "fal",
    "Expected fal provider",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_status,
    "queued",
    "Expected evolution metadata to be queued",
  );
});

Deno.test("maybeEnqueueCompanionAnimationJob records skipped when video cost guardrails block", async () => {
  const harness = createAnimationEnqueueHarness();
  const createCostGuardrailSession = () => ({
    enforceAccess: async () => {
      throw new costGuardrailsModule.CostGuardrailBlockedError("blocked", {
        scopeType: "feature",
        scopeKey: "ai_companion_animation",
      });
    },
  });

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 5,
    imageUrl: "https://example.com/stage-5.png",
    env: {
      get: (name: string) => {
        if (name === "COMPANION_ANIMATION_ENABLED") return "true";
        if (name === "FAL_KEY") return "fal-key";
        return undefined;
      },
    },
  });

  assertEquals(result.status, "skipped", "Expected blocked animation to skip");
  assertEquals(
    result.reason,
    "cost_guardrail_blocked",
    "Expected blocked skip reason",
  );
  assertEquals(
    harness.upserts.length,
    0,
    "Expected no job when cost guardrails block",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_status,
    "skipped",
    "Expected skipped evolution metadata",
  );
  assertEquals(
    harness.updates[0]?.payload.animation_error_code,
    "cost_guardrail_blocked",
    "Expected cost guardrail metadata",
  );
});
