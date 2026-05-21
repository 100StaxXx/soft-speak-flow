import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

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

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");

const { handleGenerateCompanionLauncherImage } = await import("./index.ts");

const CURRENT_SCENE_URL = "https://assets.example.com/current-scene.png";
const PHOTOROOM_SEGMENT_URL = "https://sdk.photoroom.com/v1/segment";

interface QueryState {
  table: string;
  filters: Record<string, unknown>;
  payload: unknown;
  operation: "select" | "update" | "upsert" | null;
}

const createCutoutPng = async (
  variant: "valid" | "opaque" | "tiny" = "valid",
): Promise<Uint8Array> => {
  const image = new Image(96, 96);
  image.fill(0x00000000);

  if (variant === "valid") {
    image.drawBox(30, 18, 36, 60, 0x7c3aedff);
  } else if (variant === "opaque") {
    image.fill(0x7c3aedff);
  } else {
    image.drawBox(47, 47, 2, 2, 0x7c3aedff);
  }

  return await image.encode(1);
};

const validCutoutPng = await createCutoutPng("valid");
const opaqueCutoutPng = await createCutoutPng("opaque");
const tinyCutoutPng = await createCutoutPng("tiny");

function createMockSupabase({
  companion,
  publicUrl = "https://assets.example.com/generated-launcher.png",
  uploadError = null,
  updateError = null,
  updateMatches = true,
}: {
  companion: Record<string, unknown> | null;
  publicUrl?: string;
  uploadError?: unknown;
  updateError?: unknown;
  updateMatches?: boolean;
}) {
  const queryLog: QueryState[] = [];
  const uploadLog: Array<Record<string, unknown>> = [];
  const removeLog: Array<Record<string, unknown>> = [];
  const upsertLog: Array<Record<string, unknown>> = [];

  return {
    queryLog,
    uploadLog,
    removeLog,
    upsertLog,
    storage: {
      from: (bucket: string) => ({
        upload: async (
          path: string,
          data: Uint8Array,
          options: Record<string, unknown>,
        ) => {
          uploadLog.push({
            bucket,
            path,
            byteLength: data.byteLength,
            options,
          });
          return { error: uploadError };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl,
            path,
          },
        }),
        remove: async (paths: string[]) => {
          removeLog.push({ bucket, paths });
          return { error: null };
        },
      }),
    },
    from(table: string) {
      const state: QueryState = {
        table,
        filters: {},
        payload: null,
        operation: null,
      };
      queryLog.push(state);

      const resolve = async () => {
        if (state.operation === "update") {
          if (updateError) {
            return { data: null, error: updateError };
          }
          if (
            updateMatches &&
            companion &&
            state.filters.current_image_url === companion.current_image_url
          ) {
            return { data: { id: companion.id }, error: null };
          }
          return { data: null, error: null };
        }

        if (table === "user_companion") {
          return { data: companion, error: null };
        }

        return { data: null, error: null };
      };

      const builder: Record<string, unknown> = {};
      builder.select = () => {
        state.operation ??= "select";
        return builder;
      };
      builder.eq = (column: string, value: unknown) => {
        state.filters[column] = value;
        return builder;
      };
      builder.update = (payload: unknown) => {
        state.operation = "update";
        state.payload = payload;
        return builder;
      };
      builder.upsert = async (payload: unknown, options?: unknown) => {
        state.operation = "upsert";
        state.payload = payload;
        upsertLog.push({ table, payload, options });
        return { error: null };
      };
      builder.maybeSingle = async () => await resolve();
      builder.then = (onFulfilled: (value: unknown) => unknown) =>
        resolve().then(onFulfilled);
      return builder;
    },
  };
}

const createNoopCostGuardrailSession = (
  calls: Array<Record<string, unknown>> = [],
) => ({
  enforceAccess: async (options: Record<string, unknown>) => {
    calls.push(options);
  },
  wrapFetch: (fetchImpl: typeof fetch) => fetchImpl,
});

const baseCompanion = (overrides: Record<string, unknown> = {}) => ({
  id: "companion-1",
  user_id: "user-1",
  preset_id: null,
  companion_name: "Nova",
  cached_creature_name: "Nova",
  spirit_animal: "Fox",
  core_element: "fire",
  favorite_color: "#f8c14a",
  current_stage: 3,
  current_image_url: CURRENT_SCENE_URL,
  launcher_image_url: null,
  launcher_image_focal_x: null,
  launcher_image_focal_y: null,
  launcher_image_source_url: null,
  ...overrides,
});

const createEnvGetter = (env: Record<string, string | undefined>) =>
  (name: string) => env[name];

const createMockFetch = ({
  referenceStatus = 200,
  photoRoomStatus = 200,
  photoRoomBody = validCutoutPng,
  photoRoomText = "provider unavailable",
}: {
  referenceStatus?: number;
  photoRoomStatus?: number;
  photoRoomBody?: Uint8Array;
  photoRoomText?: string;
} = {}) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchFn = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, init });

    if (url === CURRENT_SCENE_URL) {
      return new Response(new Uint8Array([1, 2, 3]), {
        status: referenceStatus,
        headers: { "Content-Type": "image/png" },
      });
    }

    if (url === PHOTOROOM_SEGMENT_URL) {
      if (photoRoomStatus >= 400) {
        return new Response(photoRoomText, { status: photoRoomStatus });
      }
      return new Response(photoRoomBody.slice().buffer as ArrayBuffer, {
        status: photoRoomStatus,
        headers: { "Content-Type": "image/png" },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  return { calls, fetchFn };
};

const buildDeps = ({
  supabase,
  fetchFn = createMockFetch().fetchFn,
  env = {
    PHOTOROOM_MODE: "live",
    PHOTOROOM_API_KEY_LIVE: "live_test_key",
    ENVIRONMENT: "production",
  },
  costCalls = [],
  authenticate,
  now = () => 123,
}: {
  supabase: ReturnType<typeof createMockSupabase>;
  fetchFn?: typeof fetch;
  env?: Record<string, string | undefined>;
  costCalls?: Array<Record<string, unknown>>;
  authenticate?: () => Promise<Record<string, unknown> | Response>;
  now?: () => number;
}) => ({
  authenticate: async () =>
    authenticate
      ? await authenticate()
      : { userId: "user-1", isInternal: false },
  createSupabaseClient: () => supabase,
  createCostGuardrailSessionFn: () => createNoopCostGuardrailSession(costCalls),
  fetchFn,
  getEnv: createEnvGetter(env),
  now,
});

const callHandler = async (
  deps: ReturnType<typeof buildDeps>,
  body: Record<string, unknown> = { companionId: "companion-1" },
) =>
  await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    deps as any,
  );

Deno.test("generate-companion-launcher-image rejects anonymous access", async () => {
  const supabase = createMockSupabase({ companion: baseCompanion() });
  const response = await callHandler(
    buildDeps({
      supabase,
      authenticate: async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
    }),
  );

  assertEquals(
    response.status,
    401,
    "Expected anonymous launcher generation to be rejected",
  );
});

Deno.test("generate-companion-launcher-image accepts internal backfill auth without a user token", async () => {
  const { fetchFn } = createMockFetch();
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(
    buildDeps({
      supabase,
      fetchFn,
      authenticate: async () => ({ isInternal: true }),
    }),
  );
  const body = await response.json();
  const selectQuery = supabase.queryLog.find((entry) =>
    entry.table === "user_companion" && entry.operation === "select"
  );

  assertEquals(response.status, 200, "Expected internal backfill to generate");
  assertEquals(body.provider, "photoroom:live", "Expected PhotoRoom provider");
  assertEquals(
    selectQuery?.filters.user_id,
    undefined,
    "Expected internal backfill to load by companion id without caller user scope",
  );
  assertEquals(supabase.uploadLog.length, 1, "Expected generated cutout upload");
});

Deno.test("generate-companion-launcher-image returns a fresh cached launcher", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({
    companion: baseCompanion({
      launcher_image_url:
        "https://assets.example.com/user-1/companion_user-1_launcher_validated_transparent_stage3_cached.png",
      launcher_image_focal_x: 0.44,
      launcher_image_focal_y: 0.56,
      launcher_image_source_url: CURRENT_SCENE_URL,
    }),
  });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 200, "Expected cached launcher response");
  assertEquals(body.cached, true, "Expected cached flag");
  assertEquals(
    body.imageUrl,
    "https://assets.example.com/user-1/companion_user-1_launcher_validated_transparent_stage3_cached.png",
    "Expected cached launcher URL",
  );
  assertEquals(calls.length, 0, "Expected no provider fetch for cached launcher");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload for cache hit");
});

Deno.test("generate-companion-launcher-image uses sandbox key outside production and saves validated cutout", async () => {
  const { calls, fetchFn } = createMockFetch();
  const costCalls: Array<Record<string, unknown>> = [];
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(
    buildDeps({
      supabase,
      fetchFn,
      costCalls,
      env: {
        PHOTOROOM_MODE: "sandbox",
        PHOTOROOM_API_KEY_SANDBOX: "sandbox_test_key",
        ENVIRONMENT: "development",
      },
      now: () => 234,
    }),
  );
  const body = await response.json();
  const photoRoomCall = calls.find((call) => call.url === PHOTOROOM_SEGMENT_URL);
  const updateQuery = supabase.queryLog.find((entry) =>
    entry.table === "user_companion" && entry.operation === "update"
  );

  assertEquals(response.status, 200, "Expected sandbox cutout to save");
  assertEquals(body.cached, false, "Expected generated response");
  assertEquals(body.provider, "photoroom:sandbox", "Expected sandbox provider");
  assert(
    typeof body.alphaStats?.borderTransparentPixelRatio === "number",
    "Expected alpha diagnostics in response",
  );
  assertEquals(
    (photoRoomCall?.init?.headers as Record<string, string>)?.["x-api-key"],
    "sandbox_test_key",
    "Expected sandbox API key",
  );
  assert(photoRoomCall?.init?.body instanceof FormData, "Expected multipart form body");
  assert(
    Array.isArray(costCalls[0]?.providers) &&
      (costCalls[0]?.providers as string[])[0] === "photoroom",
    "Expected PhotoRoom cost guardrail provider",
  );
  assertEquals(supabase.uploadLog.length, 1, "Expected generated cutout upload");
  assert(
    String(supabase.uploadLog[0].path).includes(
      "user-1/companion_user-1_launcher_validated_transparent_stage3_234.png",
    ),
    "Expected validated transparent launcher file path",
  );
  assertEquals(
    (updateQuery?.payload as Record<string, unknown>).launcher_image_url,
    "https://assets.example.com/generated-launcher.png",
    "Expected launcher image URL update",
  );
  assertEquals(
    (updateQuery?.payload as Record<string, unknown>).launcher_image_source_url,
    CURRENT_SCENE_URL,
    "Expected launcher source URL update",
  );
  assertEquals(
    supabase.upsertLog.length,
    1,
    "Expected storage ledger registration",
  );
});

Deno.test("generate-companion-launcher-image uses live key in production", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(
    buildDeps({
      supabase,
      fetchFn,
      env: {
        PHOTOROOM_MODE: "live",
        PHOTOROOM_API_KEY_LIVE: "live_test_key",
        ENVIRONMENT: "production",
      },
    }),
  );
  const body = await response.json();
  const photoRoomCall = calls.find((call) => call.url === PHOTOROOM_SEGMENT_URL);

  assertEquals(response.status, 200, "Expected live PhotoRoom cutout to save");
  assertEquals(body.provider, "photoroom:live", "Expected live provider");
  assertEquals(
    (photoRoomCall?.init?.headers as Record<string, string>)?.["x-api-key"],
    "live_test_key",
    "Expected live API key",
  );
});

Deno.test("generate-companion-launcher-image generates cutouts for preset-backed companions with remote current images", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({
    companion: baseCompanion({
      preset_id: "dragon",
      current_image_url: CURRENT_SCENE_URL,
    }),
  });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();
  const photoRoomCall = calls.find((call) => call.url === PHOTOROOM_SEGMENT_URL);

  assertEquals(response.status, 200, "Expected preset-backed remote cutout to save");
  assertEquals(body.provider, "photoroom:live", "Expected PhotoRoom provider");
  assert(Boolean(photoRoomCall), "Expected PhotoRoom fetch for remote preset-backed image");
  assertEquals(supabase.uploadLog.length, 1, "Expected generated cutout upload");
});

Deno.test("generate-companion-launcher-image rejects sandbox mode in production", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(
    buildDeps({
      supabase,
      fetchFn,
      env: {
        PHOTOROOM_MODE: "sandbox",
        PHOTOROOM_API_KEY_SANDBOX: "sandbox_test_key",
        ENVIRONMENT: "production",
      },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 500, "Expected production sandbox rejection");
  assertEquals(body.code, "COMPANION_LAUNCHER_CONFIG_ERROR", "Expected config code");
  assertEquals(
    body.failureReason,
    "photoroom_live_mode_required",
    "Expected live-mode requirement",
  );
  assertEquals(calls.length, 0, "Expected no fetch with invalid production mode");
});

Deno.test("generate-companion-launcher-image rejects sandbox mode without explicit dev environment", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(
    buildDeps({
      supabase,
      fetchFn,
      env: {
        PHOTOROOM_MODE: "sandbox",
        PHOTOROOM_API_KEY_SANDBOX: "sandbox_test_key",
      },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 500, "Expected sandbox environment rejection");
  assertEquals(
    body.failureReason,
    "photoroom_sandbox_environment_required",
    "Expected explicit non-production environment requirement",
  );
  assertEquals(calls.length, 0, "Expected no fetch with unsafe sandbox config");
});

Deno.test("generate-companion-launcher-image returns structured error when PhotoRoom key is missing", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(
    buildDeps({
      supabase,
      fetchFn,
      env: {
        PHOTOROOM_MODE: "live",
        ENVIRONMENT: "production",
      },
    }),
  );
  const body = await response.json();

  assertEquals(response.status, 500, "Expected missing live key status");
  assertEquals(body.stage, "configure_photoroom", "Expected config stage");
  assertEquals(
    body.failureReason,
    "photoroom_live_key_missing",
    "Expected missing live key reason",
  );
  assertEquals(calls.length, 0, "Expected no fetch without PhotoRoom key");
});

Deno.test("generate-companion-launcher-image rejects opaque rectangle PhotoRoom outputs", async () => {
  const { fetchFn } = createMockFetch({ photoRoomBody: opaqueCutoutPng });
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 424, "Expected invalid alpha status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_VALIDATION_FAILED",
    "Expected validation failure code",
  );
  assert(
    ["missing_alpha", "opaque_rectangle", "opaque_borders", "full_canvas_subject"]
      .includes(body.failureReason),
    "Expected opaque output validation reason",
  );
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload for bad alpha");
});

Deno.test("generate-companion-launcher-image rejects tiny PhotoRoom subjects", async () => {
  const { fetchFn } = createMockFetch({ photoRoomBody: tinyCutoutPng });
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 424, "Expected tiny subject validation status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_VALIDATION_FAILED",
    "Expected validation failure code",
  );
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload for tiny subject");
});

Deno.test("generate-companion-launcher-image returns non-retryable provider errors for PhotoRoom 4xx", async () => {
  const { fetchFn } = createMockFetch({
    photoRoomStatus: 400,
    photoRoomText: "invalid image",
  });
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 424, "Expected permanent PhotoRoom failure status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_PHOTOROOM_FAILED",
    "Expected PhotoRoom failure code",
  );
  assertEquals(body.retryable, false, "Expected 4xx not to retry");
  assertEquals(body.upstreamStatus, 400, "Expected upstream PhotoRoom status");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns retryable provider errors for PhotoRoom 5xx", async () => {
  const { fetchFn } = createMockFetch({
    photoRoomStatus: 503,
    photoRoomText: "temporarily unavailable",
  });
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 502, "Expected transient PhotoRoom failure status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_PHOTOROOM_FAILED",
    "Expected PhotoRoom failure code",
  );
  assertEquals(body.retryable, true, "Expected 5xx retry hint");
  assertEquals(body.upstreamStatus, 503, "Expected upstream PhotoRoom status");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image skips stale requested source without processing", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(
    buildDeps({ supabase, fetchFn }),
    {
      companionId: "companion-1",
      sourceImageUrl: "https://assets.example.com/old-scene.png",
    },
  );
  const body = await response.json();

  assertEquals(response.status, 200, "Expected stale source skip to succeed");
  assertEquals(body.skipped, true, "Expected stale source skip");
  assertEquals(body.stale, true, "Expected stale flag");
  assertEquals(body.reason, "source_image_changed", "Expected stale source reason");
  assertEquals(calls.length, 0, "Expected no fetch for stale source");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns structured error when reference image is unavailable", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion({ current_image_url: null }),
  });

  const response = await callHandler(buildDeps({ supabase }));
  const body = await response.json();

  assertEquals(response.status, 400, "Expected invalid reference status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_REFERENCE_UNAVAILABLE",
    "Expected structured reference error code",
  );
  assertEquals(body.stage, "validate_reference", "Expected reference stage");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns structured error when reference download fails", async () => {
  const { fetchFn } = createMockFetch({ referenceStatus: 503 });
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 502, "Expected reference download failure status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_REFERENCE_DOWNLOAD_FAILED",
    "Expected reference download code",
  );
  assertEquals(body.retryable, true, "Expected transient reference retry hint");
  assertEquals(body.upstreamStatus, 503, "Expected upstream reference status");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns structured retryable upload errors", async () => {
  const { fetchFn } = createMockFetch();
  const supabase = createMockSupabase({
    companion: baseCompanion(),
    uploadError: new Error("storage unavailable"),
  });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 502, "Expected upload failure status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_UPLOAD_FAILED",
    "Expected structured upload code",
  );
  assertEquals(body.retryable, true, "Expected upload failure retry hint");
  assertEquals(supabase.uploadLog.length, 1, "Expected attempted upload");
});

Deno.test("generate-companion-launcher-image returns structured retryable save errors", async () => {
  const { fetchFn } = createMockFetch();
  const supabase = createMockSupabase({
    companion: baseCompanion(),
    updateError: new Error("update unavailable"),
  });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 500, "Expected save failure status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_UPDATE_FAILED",
    "Expected structured save code",
  );
  assertEquals(body.retryable, true, "Expected save failure retry hint");
  assertEquals(supabase.uploadLog.length, 1, "Expected attempted upload");
});

Deno.test("generate-companion-launcher-image discards uploads when the source image changes mid-flight", async () => {
  const { fetchFn } = createMockFetch();
  const supabase = createMockSupabase({
    companion: baseCompanion(),
    updateMatches: false,
  });

  const response = await callHandler(
    buildDeps({ supabase, fetchFn, now: () => 789 }),
  );
  const body = await response.json();

  assertEquals(response.status, 200, "Expected stale source no-op to succeed");
  assertEquals(body.stale, true, "Expected stale source response");
  assertEquals(body.reason, "source_image_changed", "Expected stale reason");
  assertEquals(body.imageUrl, null, "Expected no launcher URL");
  assertEquals(supabase.uploadLog.length, 1, "Expected pre-update upload");
  assertEquals(supabase.removeLog.length, 1, "Expected stale upload cleanup");
  assertEquals(supabase.upsertLog.length, 0, "Expected no ledger registration");
});

Deno.test("generate-companion-launcher-image rejects bundled preset asset paths before PhotoRoom", async () => {
  const { calls, fetchFn } = createMockFetch();
  const supabase = createMockSupabase({
    companion: baseCompanion({
      preset_id: "dragon",
      current_image_url:
        "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
    }),
  });

  const response = await callHandler(buildDeps({ supabase, fetchFn }));
  const body = await response.json();

  assertEquals(response.status, 400, "Expected bundled path rejection");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_REFERENCE_UNAVAILABLE",
    "Expected reference validation code",
  );
  assertEquals(calls.length, 0, "Expected no fetch for preset companion");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});
