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
  updateMatches = true,
}: {
  companion: Record<string, unknown> | null;
  publicUrl?: string;
  uploadError?: unknown;
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
