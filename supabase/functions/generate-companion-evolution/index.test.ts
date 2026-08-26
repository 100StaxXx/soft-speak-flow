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
Deno.env.set("COSMIQ_CINEMA_ENABLED", "true");
Deno.env.set("COSMIQ_CINEMA_ROLLOUT_PERCENT", "100");

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
  product_mode?: "graceward" | "cosmiq";
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
  stageMaturity: 9,
  centering: 8,
  backgroundCutout: 8,
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
  stageMaturity: 9,
  centering: 4,
  backgroundCutout: 4,
  overall: 4,
  subjectCenterX: 0.2,
  subjectCenterY: 0.2,
  notes: "too similar to previous portrait",
});

const createBackgroundFailingScores = () => ({
  ...createPassingScores(7),
  backgroundCutout: 3,
  notes: "visible sky and cloud backdrop behind the companion",
});

const createSupabaseHarness = ({
  companion,
  thresholds,
  previousGenerationMetadata = null,
  cinemaEvent = null,
}: {
  companion: CompanionRecord;
  thresholds: EvolutionThreshold[];
  previousGenerationMetadata?: unknown;
  cinemaEvent?: Record<string, unknown> | null;
}) => {
  const updatedCompanions: Array<Record<string, unknown>> = [];
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const supabase = {
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl:
              `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
      }),
    },
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

      if (table === "companion_cinema_events") {
        const query = {
          select: () => query,
          eq: () => query,
          order: () => query,
          limit: () => query,
          maybeSingle: async () => ({ data: cinemaEvent, error: null }),
        };
        return query;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return { data: "cinema-event-queued", error: null };
    },
  };

  return {
    supabase,
    updatedCompanions,
    rpcCalls,
  };
};

const createDeps = ({
  companion,
  thresholds,
  judgeScores = [createPassingScores()] as Array<
    CompanionImageJudgeScoreFixture | null
  >,
  previousGenerationMetadata = null,
  cinemaEvent = null,
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
  cinemaEvent?: Record<string, unknown> | null;
  visualAnchors?: Array<Record<string, unknown> | null>;
}) => {
  const { supabase, updatedCompanions, rpcCalls } = createSupabaseHarness({
    companion,
    thresholds,
    previousGenerationMetadata,
    cinemaEvent,
  });
  const generateCalls: Array<Record<string, unknown>> = [];
  const judgeCalls: Array<Record<string, unknown>> = [];
  const extractAnchorCalls: Array<Record<string, unknown>> = [];
  const upsertCalls: Array<Record<string, unknown>> = [];
  const uploadCalls: Array<Record<string, unknown>> = [];
  const animationEnqueueCalls: Array<Record<string, unknown>> = [];
  const premadeAssetVerificationCalls: Array<Record<string, unknown>> = [];
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
    verifyPremadeCompanionAsset: async (args: Record<string, unknown>) => {
      premadeAssetVerificationCalls.push(args);
      return true;
    },
    enqueueCompanionAnimationJob: async (args: Record<string, unknown>) => {
      animationEnqueueCalls.push(args as unknown as Record<string, unknown>);
      return { status: "queued", jobId: "animation-job-1" } as never;
    },
    info: (...args: unknown[]) => {
      infoLogs.push(args);
    },
    error: (..._args: unknown[]) => undefined,
  } as unknown as GenerateCompanionEvolutionDeps;

  return {
    deps,
    updatedCompanions,
    rpcCalls,
    generateCalls,
    judgeCalls,
    extractAnchorCalls,
    upsertCalls,
    uploadCalls,
    animationEnqueueCalls,
    premadeAssetVerificationCalls,
    infoLogs,
  };
};

Deno.test("explicit Graceward companions claim premade portraits and videos without generation", async () => {
  const companion = createCompanion({
    product_mode: "graceward",
    spirit_animal: "Lion",
    core_element: "light",
    image_lineage_metadata: null,
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

  assertEquals(response.status, 200, "Expected premade hatch to succeed");
  assertEquals(
    payload.image_url,
    "https://example.supabase.co/storage/v1/object/public/companion-presets/premade/v1/graceward/lion/light/portraits/level-1.webp",
    "Expected the exact premade portrait URL",
  );
  assertEquals(
    payload.animation_video_url,
    "https://example.supabase.co/storage/v1/object/public/companion-animation-videos/premade/v1/graceward/lion/light/videos/level-0-to-1.mp4",
    "Expected the exact premade transition video URL",
  );
  assertEquals(harness.generateCalls.length, 0, "Expected no image generation");
  assertEquals(harness.judgeCalls.length, 0, "Expected no runtime judging");
  assertEquals(
    harness.animationEnqueueCalls.length,
    0,
    "Expected no runtime animation job",
  );
  assertEquals(
    harness.premadeAssetVerificationCalls.length,
    2,
    "Expected both published assets to be verified before claiming",
  );
  assertEquals(
    (harness.upsertCalls[0]?.generationMetadata as Record<string, unknown>)
      .sourceType,
    "premade",
    "Expected premade provenance",
  );
  assertEquals(
    (harness.upsertCalls[0]?.premadeAnimation as Record<string, unknown>)
      .storagePath,
    "premade/v1/graceward/lion/light/videos/level-0-to-1.mp4",
    "Expected the premade video to be persisted with the evolution",
  );
});

Deno.test("explicit Graceward companions fail clearly when a premade asset is missing", async () => {
  const companion = createCompanion({
    product_mode: "graceward",
    spirit_animal: "Lion",
    core_element: "light",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 1, xp_required: 10 },
      { stage: 2, xp_required: 30 },
    ],
  });
  let verificationCount = 0;
  harness.deps.verifyPremadeCompanionAsset = async () => {
    verificationCount += 1;
    return verificationCount === 1;
  };

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(response.status, 409, "Expected missing asset conflict status");
  assertEquals(
    payload.code,
    "premade_asset_unavailable",
    "Expected a terminal asset error code",
  );
  assertEquals(harness.upsertCalls.length, 0, "Expected no evolution claim");
  assertEquals(
    harness.generateCalls.length,
    0,
    "Expected no generation fallback",
  );
});

Deno.test("Graceward defers visual boundaries above the Level 5 launch scope", async () => {
  const companion = createCompanion({
    product_mode: "graceward",
    current_stage: 5,
    current_xp: 1_300,
    spirit_animal: "Lion",
    core_element: "light",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 13, xp_required: 1_200 },
      { stage: 14, xp_required: 1_550 },
    ],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(response.status, 200, "Expected a clean deferred response");
  assertEquals(
    payload.evolved,
    false,
    "Expected no unsupported evolution claim",
  );
  assertEquals(
    payload.release_max_stage,
    5,
    "Expected the Graceward release ceiling",
  );
  assertEquals(harness.upsertCalls.length, 0, "Expected no evolution record");
  assertEquals(
    harness.premadeAssetVerificationCalls.length,
    0,
    "Expected no storage checks beyond the release scope",
  );
});

Deno.test("explicit Cosmiq companions requeue personalized cinema instead of falling back to premade art", async () => {
  const companion = createCompanion({
    product_mode: "cosmiq",
    current_stage: 5,
    current_xp: 1_300,
    preset_id: "phoenix",
    spirit_animal: "Phoenix",
    core_element: "nature",
    current_image_url: "https://example.com/phoenix-stage-5.png",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 13, xp_required: 1_200 },
      { stage: 14, xp_required: 1_550 },
    ],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    503,
    "Expected Cosmiq to wait for generated cinema",
  );
  assertEquals(payload.evolved, false, "Expected no premade evolution claim");
  assertEquals(
    payload.code,
    "cinema_event_preparing",
    "Expected a retryable cinema response",
  );
  assertEquals(
    payload.cinema_event_id,
    "cinema-event-queued",
    "Expected the queued event id",
  );
  assertEquals(
    harness.rpcCalls.length,
    1,
    "Expected one idempotent cinema enqueue",
  );
  assertEquals(
    harness.rpcCalls[0]?.name,
    "enqueue_cosmiq_cinema_event_internal",
    "Expected the Cosmiq-only enqueue RPC",
  );
  assertEquals(
    harness.premadeAssetVerificationCalls.length,
    0,
    "Expected no premade storage reads",
  );
  assertEquals(
    harness.generateCalls.length,
    0,
    "Expected no synchronous image generation",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no evolution record before cinema is ready",
  );
});

Deno.test("Cosmiq can promote cinema both before and after the user reveals it", () => {
  assertEquals(
    module.isPromotableCinemaEventStatus("ready"),
    true,
    "Expected a newly ready film to promote",
  );
  assertEquals(
    module.isPromotableCinemaEventStatus("revealed"),
    true,
    "Expected a film the user already watched to remain promotable",
  );
  assertEquals(
    module.isPromotableCinemaEventStatus("rendering_video"),
    false,
    "Expected an incomplete film to remain blocked",
  );
  assertEquals(
    module.isPromotableCinemaEventStatus("failed"),
    false,
    "Expected a failed film to remain blocked",
  );
});

Deno.test("explicit Cosmiq companions wait instead of falling back when cinema is disabled", async () => {
  const companion = createCompanion({
    product_mode: "cosmiq",
    current_stage: 5,
    current_xp: 1_300,
    preset_id: "phoenix",
    spirit_animal: "Phoenix",
    core_element: "nature",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 13, xp_required: 1_200 },
      { stage: 14, xp_required: 1_550 },
    ],
  });

  const response = await withEnvValue(
    "COSMIQ_CINEMA_ENABLED",
    "false",
    () =>
      module.handleGenerateCompanionEvolution(
        createInternalRequest(),
        harness.deps,
      ),
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    503,
    "Expected the personalized claim to pause",
  );
  assertEquals(
    payload.evolved,
    false,
    "Expected the companion to stay on its approved form",
  );
  assertEquals(
    payload.code,
    "cosmiq_cinema_disabled",
    "Expected an explicit paused-generation error",
  );
  assertEquals(
    harness.rpcCalls.length,
    0,
    "Expected no cinema enqueue while the global switch is disabled",
  );
  assertEquals(
    harness.premadeAssetVerificationCalls.length,
    0,
    "Expected no Graceward premade verification",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no fallback evolution mutation",
  );
});

Deno.test("legacy companions without an explicit product mode keep their canonical compatibility path", async () => {
  const companion = createCompanion({
    current_stage: 5,
    current_xp: 1_300,
    preset_id: "phoenix",
    spirit_animal: "Phoenix",
    core_element: "nature",
    current_image_url: "https://example.com/phoenix-stage-5.png",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 13, xp_required: 1_200 },
      { stage: 14, xp_required: 1_550 },
    ],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();
  const expectedUrl =
    "/companion-presets/phoenix/t3_awakened/normal/phoenix__t3_awakened__normal__nature.png";

  assertEquals(
    response.status,
    200,
    "Expected canonical Cosmiq evolution to succeed",
  );
  assertEquals(
    payload.image_url,
    expectedUrl,
    "Expected exact stage-13 canonical art",
  );
  assertEquals(
    payload.portrait_regenerated,
    true,
    "Expected a changed preset portrait",
  );
  assertEquals(
    harness.generateCalls.length,
    0,
    "Expected no AI portrait generation for presets",
  );
  assertEquals(
    harness.upsertCalls[0]?.generationMetadata &&
      (harness.upsertCalls[0].generationMetadata as Record<string, unknown>)
        .presetAssetSource,
    "canonical_cosmiq_bundled",
    "Expected canonical bundled provenance",
  );
  assertEquals(
    harness.animationEnqueueCalls[0]?.previousImageUrl,
    "https://example.com/phoenix-stage-5.png",
    "Expected animation to start from the prior approved portrait",
  );
  assertEquals(
    harness.animationEnqueueCalls[0]?.imageUrl,
    expectedUrl,
    "Expected animation to end on the exact canonical portrait",
  );
});

Deno.test("unsupported legacy companions retain their last approved later-stage portrait", async () => {
  const companion = createCompanion({
    current_stage: 5,
    current_xp: 1_300,
    preset_id: "dragon",
    spirit_animal: "Dragon",
    core_element: "storm",
    current_image_url: "https://example.com/approved-dragon-stage-5.png",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 13, xp_required: 1_200 },
      { stage: 14, xp_required: 1_550 },
    ],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();
  const metadata = harness.upsertCalls[0]?.generationMetadata as Record<
    string,
    unknown
  >;

  assertEquals(
    response.status,
    200,
    "Expected legacy companion progression to remain usable",
  );
  assertEquals(
    payload.image_url,
    "https://example.com/approved-dragon-stage-5.png",
    "Expected no fabricated later-stage URL",
  );
  assertEquals(
    payload.portrait_regenerated,
    false,
    "Expected portrait reuse to be explicit",
  );
  assertEquals(
    metadata.sourceType,
    "reuse",
    "Expected reuse provenance to skip animation",
  );
  assertEquals(
    metadata.presetAssetSource,
    "legacy_reuse",
    "Expected legacy fallback provenance",
  );
});

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
          approvedForReveal: true,
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

  const animationEnqueueCall = harness.animationEnqueueCalls[0];
  assert(
    animationEnqueueCall,
    "Expected hidden anchor reveal to enqueue an animation job",
  );
  assertEquals(
    animationEnqueueCall.evolutionId,
    "evo-1",
    "Expected animation enqueue to target the persisted evolution",
  );
  assertEquals(
    animationEnqueueCall.stage,
    1,
    "Expected animation enqueue to use the revealed stage",
  );
  assertEquals(
    animationEnqueueCall.imageUrl,
    "https://example.com/hidden-stage-1.png",
    "Expected animation enqueue to animate the hidden anchor image",
  );
  assertEquals(
    animationEnqueueCall.previousImageUrl,
    "https://example.com/stage-0.png",
    "Expected animation enqueue to include the previous companion image",
  );
});

Deno.test("Graceward stage-1 hatch generates and validates an infant when its hidden anchor is missing", async () => {
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
    "Expected infant backfill hatch response to succeed",
  );
  assertEquals(
    payload.portrait_regenerated,
    true,
    "Expected missing hidden art to be replaced with a validated infant render",
  );
  assertEquals(
    harness.generateCalls.length,
    1,
    "Expected one infant render for a passing first attempt",
  );
  assertEquals(
    harness.judgeCalls.length,
    1,
    "Expected the infant render to be quality gated before reveal",
  );
  assertEquals(
    payload.image_url,
    "https://example.com/generated-stage-1.png",
    "Expected the approved generated infant portrait",
  );

  const upsertCall = harness.upsertCalls[0];
  assert(upsertCall, "Expected canonical hatch to upsert an evolution record");
  const generationMetadata = upsertCall.generationMetadata as Record<
    string,
    unknown
  >;
  assertEquals(
    generationMetadata.sourceType,
    "legacy_backfill",
    "Expected backfill provenance for a missing legacy anchor",
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
    "Expected canonical stage-1 anchor to be visible after hatch",
  );
  assertEquals(
    hiddenAnchors["1"]?.sourceType,
    "legacy_backfill",
    "Expected generated backfill lineage provenance",
  );

  const animationEnqueueCall = harness.animationEnqueueCalls[0];
  assert(
    animationEnqueueCall,
    "Expected canonical hatch to enqueue an animation job",
  );
  assertEquals(
    animationEnqueueCall.evolutionId,
    "evo-1",
    "Expected animation enqueue to target the persisted evolution",
  );
  assertEquals(
    animationEnqueueCall.stage,
    1,
    "Expected animation enqueue to use stage 1",
  );
  assertEquals(
    animationEnqueueCall.imageUrl,
    "https://example.com/generated-stage-1.png",
    "Expected animation enqueue to end on the validated infant portrait",
  );
  assertEquals(
    animationEnqueueCall.previousImageUrl,
    "https://example.com/legacy-ai-egg.png",
    "Expected animation enqueue to include the legacy starter image",
  );
  assertEquals(
    (animationEnqueueCall.generationMetadata as Record<string, unknown>)
      .sourceType,
    "legacy_backfill",
    "Expected animation enqueue metadata to preserve backfill provenance",
  );
});

Deno.test("legacy stage-1 backfill rejects generated starters that fail the background gate", async () => {
  const companion = createCompanion({
    image_lineage_metadata: null,
    current_image_url: "https://example.com/legacy-ai-egg.png",
    initial_image_url: "https://example.com/legacy-ai-egg.png",
    spirit_animal: "Sphinx",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 1, xp_required: 10 },
      { stage: 2, xp_required: 30 },
    ],
    judgeScores: [createBackgroundFailingScores()],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    422,
    "Expected failed stage-1 background gate status",
  );
  assertEquals(
    payload.code,
    "evolution_quality_gate_failed",
    "Expected quality gate error code",
  );
  assert(
    String(payload.error).includes("visible sky and cloud backdrop"),
    "Expected quality gate error to include judge backdrop critique",
  );
  assertEquals(
    harness.generateCalls.length,
    2,
    "Expected retry budget to be used before rejection",
  );
  assertEquals(
    harness.uploadCalls.length,
    0,
    "Expected no upload for failed background gate",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no evolution record for failed background gate",
  );
  assertEquals(
    harness.updatedCompanions.length,
    0,
    "Expected no companion update for failed background gate",
  );
});

Deno.test("legacy stage-1 backfill rejects an adult-looking hatch endpoint", async () => {
  const companion = createCompanion({
    image_lineage_metadata: null,
    current_image_url: "https://example.com/legacy-ai-egg.png",
    initial_image_url: "https://example.com/legacy-ai-egg.png",
    spirit_animal: "Lion",
  });
  const adultScores = {
    ...createPassingScores(),
    stageMaturity: 2,
    notes: "Adult mane and mature body proportions are visible.",
  };
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 1, xp_required: 10 },
      { stage: 2, xp_required: 30 },
    ],
    judgeScores: [adultScores],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(response.status, 422, "Expected adult endpoint rejection");
  assertEquals(
    payload.code,
    "evolution_quality_gate_failed",
    "Expected stage-one quality gate code",
  );
  assertEquals(harness.generateCalls.length, 2, "Expected the retry budget");
  assertEquals(harness.uploadCalls.length, 0, "Expected no adult upload");
  assertEquals(harness.upsertCalls.length, 0, "Expected no evolution row");
});

Deno.test("legacy stage-1 backfill does not persist when the judge is unavailable", async () => {
  const companion = createCompanion({
    image_lineage_metadata: null,
    current_image_url: "https://example.com/legacy-ai-egg.png",
    initial_image_url: "https://example.com/legacy-ai-egg.png",
    spirit_animal: "Sphinx",
  });
  const harness = createDeps({
    companion,
    thresholds: [
      { stage: 1, xp_required: 10 },
      { stage: 2, xp_required: 30 },
    ],
    judgeScores: [null],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    502,
    "Expected unavailable judge status",
  );
  assertEquals(
    payload.code,
    "evolution_validation_unavailable",
    "Expected retryable validation-unavailable code",
  );
  assertEquals(
    harness.generateCalls.length,
    1,
    "Expected generated candidate to be rejected before upload",
  );
  assertEquals(
    harness.uploadCalls.length,
    0,
    "Expected no upload when judge is unavailable",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no evolution record when judge is unavailable",
  );
  assertEquals(
    harness.updatedCompanions.length,
    0,
    "Expected no companion update when judge is unavailable",
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

Deno.test("boundary evolutions use the previous approved portrait as the edit reference", async () => {
  const companion = createCompanion({
    current_stage: 1,
    current_xp: 100,
    current_image_url: "https://example.com/approved-stage-1.png",
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
  const editCalls: Array<Record<string, unknown>> = [];
  harness.deps.editCompanionImage = async (args) => {
    editCalls.push(args as unknown as Record<string, unknown>);
    return {
      imageDataUrl: `data:image/png;base64,${btoa("reference-evolution")}`,
      revisedPrompt: null,
      size: String(args.size),
      model: "test-image-model",
    };
  };

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );

  assertEquals(
    response.status,
    200,
    "Expected reference-driven evolution to succeed",
  );
  assertEquals(
    editCalls.length,
    1,
    "Expected one previous-portrait image edit",
  );
  assertEquals(
    harness.generateCalls.length,
    0,
    "Expected no text-only render when the reference edit succeeds",
  );
  const referenceImages = editCalls[0]?.referenceImages as Array<
    { imageUrl: string }
  >;
  assertEquals(
    referenceImages[0]?.imageUrl,
    "https://example.com/approved-stage-1.png",
    "Expected the last approved portrait to seed the new boundary image",
  );
  const generationMetadata = harness.upsertCalls[0]
    ?.generationMetadata as Record<string, unknown>;
  assertEquals(
    generationMetadata.renderSourceType,
    "previous_portrait_reference_edit",
    "Expected persisted provenance to identify reference-image evolution",
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
    judgeScores: [createBackgroundFailingScores(), createPassingScores(7)],
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
      secondGenerateCall.prompt.includes("Retry critique:") &&
      secondGenerateCall.prompt.includes("visible sky and cloud backdrop"),
    "Expected second boundary generation prompt to include background critique feedback",
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

Deno.test("boundary evolutions do not persist with anchors when the judge is unavailable", async () => {
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
    judgeScores: [null],
  });

  const response = await module.handleGenerateCompanionEvolution(
    createInternalRequest(),
    harness.deps,
  );
  const payload = await response.json();

  assertEquals(
    response.status,
    502,
    "Expected unavailable judge status",
  );
  assertEquals(
    payload.code,
    "evolution_validation_unavailable",
    "Expected retryable validation-unavailable code",
  );
  assertEquals(
    harness.uploadCalls.length,
    0,
    "Expected no upload when judge is unavailable",
  );
  assertEquals(
    harness.upsertCalls.length,
    0,
    "Expected no evolution record when judge is unavailable",
  );
  assertEquals(
    harness.updatedCompanions.length,
    0,
    "Expected no companion update when judge is unavailable",
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
    previousImageUrl: "https://example.com/stage-1.png",
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
    harness.upserts[0]?.payload.start_image_url,
    "https://example.com/stage-1.png",
    "Expected the prior approved portrait to persist as the first frame",
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

Deno.test("maybeEnqueueCompanionAnimationJob persists egg and infant endpoints for hatching", async () => {
  const harness = createAnimationEnqueueHarness();

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: harness.createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 1,
    imageUrl: "https://example.com/infant.png",
    previousImageUrl: "/companion-eggs/v2/egg__t0_egg__normal__light.webp",
    element: "light",
    env: {
      get: (name: string) => {
        if (name === "COMPANION_ANIMATION_ENABLED") return "true";
        if (name === "FAL_KEY") return "fal-key";
        return undefined;
      },
    },
    now: () => new Date("2026-05-02T12:00:00.000Z"),
  });

  assertEquals(result.status, "queued", "Expected hatch video job to queue");
  assertEquals(
    harness.upserts[0]?.payload.start_image_url,
    "/companion-eggs/v2/egg__t0_egg__normal__light.webp",
    "Expected the bundled Graceward egg to persist as the first frame",
  );
  assertEquals(
    harness.upserts[0]?.payload.source_image_url,
    "https://example.com/infant.png",
    "Expected the infant portrait to persist as the final frame",
  );
  assertEquals(
    String(harness.upserts[0]?.payload.prompt).includes("exact companion egg"),
    true,
    "Expected an egg-to-infant hatch prompt",
  );
});

Deno.test("maybeEnqueueCompanionAnimationJob skips hatch video generation without a public egg image", async () => {
  const harness = createAnimationEnqueueHarness();

  const result = await module.maybeEnqueueCompanionAnimationJob({
    supabase: harness.supabase,
    createCostGuardrailSession: harness.createCostGuardrailSession as never,
    userId: USER_ID,
    companionId: "companion-1",
    evolutionId: "evo-1",
    stage: 1,
    imageUrl: "https://example.com/infant.png",
    previousImageUrl: "/not-a-real-egg/light.png",
    element: "light",
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
    "Expected invalid hatch input to skip",
  );
  assertEquals(
    result.reason,
    "hatch_start_image_url_unavailable",
    "Expected the missing egg endpoint reason",
  );
  assertEquals(harness.upserts.length, 0, "Expected no malformed hatch job");
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
    previousImageUrl: "https://example.com/stage-1.png",
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
