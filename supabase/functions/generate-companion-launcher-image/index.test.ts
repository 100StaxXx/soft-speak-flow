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
Deno.env.set("OPENAI_API_KEY", "test-openai-key");

const { handleGenerateCompanionLauncherImage } = await import("./index.ts");

const transparentPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

interface QueryState {
  table: string;
  filters: Record<string, unknown>;
  payload: unknown;
  operation: "select" | "update" | "upsert" | null;
}

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

        if (state.operation === "upsert") {
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

const createNoopCostGuardrailSession = () => ({
  enforceAccess: async () => {},
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
  current_image_url: "https://assets.example.com/current-scene.png",
  launcher_image_url: null,
  launcher_image_focal_x: null,
  launcher_image_focal_y: null,
  launcher_image_source_url: null,
  ...overrides,
});

Deno.test("generate-companion-launcher-image rejects anonymous access", async () => {
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error("should not generate");
      },
      now: () => 123,
    },
  );

  assertEquals(
    response.status,
    401,
    "Expected anonymous launcher generation to be rejected",
  );
});

Deno.test("generate-companion-launcher-image returns a fresh cached launcher", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion({
      launcher_image_url: "https://assets.example.com/cached-launcher.png",
      launcher_image_focal_x: 0.44,
      launcher_image_focal_y: 0.56,
      launcher_image_source_url: "https://assets.example.com/current-scene.png",
    }),
  });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error("should not generate");
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    200,
    "Expected cached launcher response to succeed",
  );
  assertEquals(body.cached, true, "Expected cached flag");
  assertEquals(
    body.imageUrl,
    "https://assets.example.com/cached-launcher.png",
    "Expected cached launcher URL",
  );
  assertEquals(
    supabase.uploadLog.length,
    0,
    "Expected no upload for fresh cached launcher",
  );
});

Deno.test("generate-companion-launcher-image skips stale requested source without generating", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion({
      current_image_url: "https://assets.example.com/current-scene.png",
    }),
  });
  let editCalls = 0;

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({
        companionId: "companion-1",
        sourceImageUrl: "https://assets.example.com/old-scene.png",
      }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        editCalls += 1;
        throw new Error("should not generate for a stale source request");
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected stale source skip to succeed");
  assertEquals(body.skipped, true, "Expected stale source skip");
  assertEquals(body.stale, true, "Expected stale flag");
  assertEquals(
    body.reason,
    "source_image_changed",
    "Expected stale source reason",
  );
  assertEquals(
    body.sourceImageUrl,
    "https://assets.example.com/current-scene.png",
    "Expected current source image in response",
  );
  assertEquals(
    body.requestedSourceImageUrl,
    "https://assets.example.com/old-scene.png",
    "Expected requested source image diagnostic",
  );
  assertEquals(editCalls, 0, "Expected no image edit for stale request");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns structured error when reference image is unavailable", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion({
      current_image_url: null,
    }),
  });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error("should not generate without a reference image");
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 400, "Expected invalid reference status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_REFERENCE_UNAVAILABLE",
    "Expected structured reference error code",
  );
  assertEquals(
    body.stage,
    "validate_reference",
    "Expected structured reference error stage",
  );
  assertEquals(
    body.failureReason,
    "missing_reference_image",
    "Expected structured reference failure reason",
  );
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns structured error when OpenAI config is missing", async () => {
  const originalOpenAiKey = Deno.env.get("OPENAI_API_KEY");
  Deno.env.delete("OPENAI_API_KEY");
  const supabase = createMockSupabase({ companion: baseCompanion() });

  try {
    const response = await handleGenerateCompanionLauncherImage(
      new Request("https://example.com", {
        method: "POST",
        body: JSON.stringify({ companionId: "companion-1" }),
      }),
      {
        authenticate: async () => ({ userId: "user-1", isInternal: false }),
        createSupabaseClient: () => supabase,
        createCostGuardrailSessionFn: createNoopCostGuardrailSession,
        editCompanionImageFn: async () => {
          throw new Error("should not generate without OpenAI config");
        },
        now: () => 123,
      },
    );

    const body = await response.json();
    assertEquals(response.status, 500, "Expected missing config status");
    assertEquals(
      body.code,
      "COMPANION_LAUNCHER_CONFIG_ERROR",
      "Expected structured config error code",
    );
    assertEquals(body.stage, "configure_openai", "Expected config error stage");
    assertEquals(
      body.failureReason,
      "openai_config_missing",
      "Expected structured config failure reason",
    );
    assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
  } finally {
    if (originalOpenAiKey) {
      Deno.env.set("OPENAI_API_KEY", originalOpenAiKey);
    }
  }
});

Deno.test("generate-companion-launcher-image returns structured error when reference download fails", async () => {
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error("Failed to download reference image: 503");
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    502,
    "Expected reference download failure status",
  );
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_REFERENCE_DOWNLOAD_FAILED",
    "Expected structured reference download code",
  );
  assertEquals(
    body.stage,
    "download_reference",
    "Expected structured reference download stage",
  );
  assertEquals(
    body.failureReason,
    "reference_download_failed",
    "Expected structured reference download reason",
  );
  assertEquals(
    body.retryable,
    true,
    "Expected transient reference failure to be retryable",
  );
  assertEquals(body.upstreamStatus, 503, "Expected upstream reference status");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns non-retryable structured error when OpenAI edit returns a permanent 4xx", async () => {
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error(
          'OpenAI image request failed (400): {"error":"invalid image input"}',
        );
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    424,
    "Expected permanent OpenAI edit failure status",
  );
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_OPENAI_EDIT_FAILED",
    "Expected structured OpenAI edit code",
  );
  assertEquals(body.stage, "edit_image", "Expected OpenAI edit stage");
  assertEquals(
    body.failureReason,
    "openai_edit_failed",
    "Expected structured OpenAI edit reason",
  );
  assertEquals(
    body.retryable,
    false,
    "Expected permanent OpenAI edit failure to be non-retryable",
  );
  assertEquals(body.upstreamStatus, 400, "Expected upstream OpenAI status");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image classifies raw AI API 400 errors as permanent edit failures", async () => {
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error("AI API error: 400");
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    424,
    "Expected raw AI API 400 to be mapped to a permanent upstream failure",
  );
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_OPENAI_EDIT_FAILED",
    "Expected structured OpenAI edit code",
  );
  assertEquals(body.upstreamStatus, 400, "Expected upstream OpenAI status");
  assertEquals(body.retryable, false, "Expected raw upstream 400 not to retry");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns retryable structured error when OpenAI edit returns a transient 5xx", async () => {
  const supabase = createMockSupabase({ companion: baseCompanion() });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error(
          'OpenAI image request failed (503): {"error":"temporarily unavailable"}',
        );
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(
    response.status,
    502,
    "Expected transient OpenAI edit failure status",
  );
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_OPENAI_EDIT_FAILED",
    "Expected structured OpenAI edit code",
  );
  assertEquals(
    body.retryable,
    true,
    "Expected transient OpenAI edit failure retry hint",
  );
  assertEquals(body.upstreamStatus, 503, "Expected upstream OpenAI status");
  assertEquals(supabase.uploadLog.length, 0, "Expected no upload");
});

Deno.test("generate-companion-launcher-image returns structured retryable upload errors", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion(),
    uploadError: new Error("storage unavailable"),
  });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => ({
        imageDataUrl: transparentPngDataUrl,
        revisedPrompt: null,
        size: "1024x1024",
      }),
      now: () => 456,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 502, "Expected upload failure status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_UPLOAD_FAILED",
    "Expected structured upload code",
  );
  assertEquals(body.stage, "upload_image", "Expected upload stage");
  assertEquals(
    body.failureReason,
    "storage_upload_failed",
    "Expected upload failure reason",
  );
  assertEquals(body.retryable, true, "Expected upload failure retry hint");
  assertEquals(
    typeof body.requestId,
    "string",
    "Expected generated request diagnostic id",
  );
  assertEquals(supabase.uploadLog.length, 1, "Expected attempted upload");
});

Deno.test("generate-companion-launcher-image returns structured retryable save errors", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion(),
    updateError: new Error("update unavailable"),
  });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => ({
        imageDataUrl: transparentPngDataUrl,
        revisedPrompt: null,
        size: "1024x1024",
      }),
      now: () => 456,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 500, "Expected save failure status");
  assertEquals(
    body.code,
    "COMPANION_LAUNCHER_UPDATE_FAILED",
    "Expected structured save code",
  );
  assertEquals(body.stage, "save_companion", "Expected save stage");
  assertEquals(
    body.failureReason,
    "companion_update_failed",
    "Expected save failure reason",
  );
  assertEquals(body.retryable, true, "Expected save failure retry hint");
  assertEquals(
    typeof body.requestId,
    "string",
    "Expected generated request diagnostic id",
  );
  assertEquals(supabase.uploadLog.length, 1, "Expected attempted upload");
});

Deno.test("generate-companion-launcher-image regenerates stale launcher art and updates source fields", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion({
      launcher_image_url: "https://assets.example.com/old-launcher.png",
      launcher_image_source_url: "https://assets.example.com/old-scene.png",
    }),
  });
  const editCalls: Array<Record<string, unknown>> = [];

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async (args: any) => {
        editCalls.push(args);
        return {
          imageDataUrl: transparentPngDataUrl,
          revisedPrompt: null,
          size: "1024x1024",
        };
      },
      now: () => 456,
    },
  );

  const body = await response.json();
  const updateQuery = supabase.queryLog.find((entry) =>
    entry.table === "user_companion" && entry.operation === "update"
  );

  assertEquals(
    response.status,
    200,
    "Expected stale launcher regeneration to succeed",
  );
  assertEquals(body.cached, false, "Expected generated response");
  assertEquals(
    body.imageUrl,
    "https://assets.example.com/generated-launcher.png",
    "Expected uploaded public URL",
  );
  assertEquals(editCalls.length, 1, "Expected one image edit call");
  assertEquals(supabase.uploadLog.length, 1, "Expected generated image upload");
  assert(
    String(supabase.uploadLog[0].path).includes(
      "user-1/companion_user-1_launcher_stage3_456.png",
    ),
    "Expected upload path to follow companion image storage convention",
  );
  assert(updateQuery !== undefined, "Expected user_companion update");
  assertEquals(
    (updateQuery?.payload as Record<string, unknown>).launcher_image_url,
    "https://assets.example.com/generated-launcher.png",
    "Expected launcher image URL update",
  );
  assertEquals(
    (updateQuery?.payload as Record<string, unknown>).launcher_image_source_url,
    "https://assets.example.com/current-scene.png",
    "Expected launcher source URL update",
  );
  assertEquals(
    updateQuery?.filters.current_image_url,
    "https://assets.example.com/current-scene.png",
    "Expected update to guard against stale source image writes",
  );
  assertEquals(
    supabase.upsertLog.length,
    1,
    "Expected generated launcher asset registration",
  );
  assertEquals(
    (supabase.upsertLog[0].payload as Record<string, unknown>).source_kind,
    "companion_launcher_image",
    "Expected launcher storage ledger source kind",
  );
});

Deno.test("generate-companion-launcher-image discards uploads when the source image changes mid-flight", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion(),
    updateMatches: false,
  });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => ({
        imageDataUrl: transparentPngDataUrl,
        revisedPrompt: null,
        size: "1024x1024",
      }),
      now: () => 789,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected stale source no-op to succeed");
  assertEquals(body.stale, true, "Expected stale source response");
  assertEquals(
    body.reason,
    "source_image_changed",
    "Expected stale source reason",
  );
  assertEquals(
    body.imageUrl,
    null,
    "Expected no launcher URL for stale source response",
  );
  assertEquals(
    supabase.uploadLog.length,
    1,
    "Expected stale image to have been uploaded before update guard",
  );
  assertEquals(supabase.removeLog.length, 1, "Expected stale upload cleanup");
  assertEquals(
    supabase.upsertLog.length,
    0,
    "Expected no ledger registration for stale upload",
  );
});

Deno.test("generate-companion-launcher-image no-ops for preset companions", async () => {
  const supabase = createMockSupabase({
    companion: baseCompanion({
      preset_id: "dragon",
      current_image_url:
        "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
    }),
  });

  const response = await handleGenerateCompanionLauncherImage(
    new Request("https://example.com", {
      method: "POST",
      body: JSON.stringify({ companionId: "companion-1" }),
    }),
    {
      authenticate: async () => ({ userId: "user-1", isInternal: false }),
      createSupabaseClient: () => supabase,
      createCostGuardrailSessionFn: createNoopCostGuardrailSession,
      editCompanionImageFn: async () => {
        throw new Error("should not generate for presets");
      },
      now: () => 123,
    },
  );

  const body = await response.json();
  assertEquals(response.status, 200, "Expected preset no-op to succeed");
  assertEquals(body.skipped, true, "Expected preset companion skip");
  assertEquals(body.reason, "preset_companion", "Expected preset skip reason");
  assertEquals(
    supabase.uploadLog.length,
    0,
    "Expected no upload for preset companion",
  );
});
