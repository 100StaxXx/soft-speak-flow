import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
Deno.env.set("SUPABASE_ANON_KEY", "anon-key");
Deno.env.set("INTERNAL_FUNCTION_SECRET", "internal-secret");

const module = await import("./index.ts");
type ProcessDeps = NonNullable<
  Parameters<typeof module.processClaimedCompanionAnimationJob>[0]["deps"]
>;

const createJob = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  user_id: "user-1",
  companion_id: "companion-1",
  evolution_id: "evo-1",
  stage: 5,
  source_image_url: "https://example.com/stage-5.png",
  provider: "fal",
  provider_model: "fal-ai/kling-video/v3/standard/image-to-video",
  provider_task_id: null,
  provider_status: null,
  status: "processing",
  prompt: "Animate the companion",
  retry_count: 0,
  next_retry_at: null,
  requested_at: "2026-05-02T12:00:00.000Z",
  started_at: "2026-05-02T12:00:01.000Z",
  updated_at: "2026-05-02T12:00:01.000Z",
  ...overrides,
});

const createSupabaseHarness = () => {
  const updates: Array<
    {
      table: string;
      payload: Record<string, unknown>;
      column: string;
      value: unknown;
    }
  > = [];
  const uploads: Array<
    {
      bucket: string;
      path: string;
      bytes: Uint8Array;
      options: Record<string, unknown>;
    }
  > = [];

  const supabase = {
    from: (table: string) => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          updates.push({ table, payload, column, value });
          return { error: null };
        },
      }),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (
          path: string,
          bytes: Uint8Array,
          options: Record<string, unknown>,
        ) => {
          uploads.push({ bucket, path, bytes, options });
          return { error: null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl:
              `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
      }),
    },
  };

  return { supabase, updates, uploads };
};

const createDeps = ({
  fetchFn,
  falKey = "fal-key",
}: {
  fetchFn: typeof fetch;
  falKey?: string | null;
}) => {
  const ledgerCalls: Array<Record<string, unknown>> = [];
  const costGuardrailCalls: Array<Record<string, unknown>> = [];
  const deps = {
    createClient: (() => {
      throw new Error(
        "createClient should not be used by processClaimedCompanionAnimationJob tests",
      );
    }) as never,
    createCostGuardrailSession: (args: Record<string, unknown>) => {
      costGuardrailCalls.push(args);
      return {
        wrapFetch: (innerFetch: typeof fetch) => innerFetch,
      };
    },
    registerUserStorageAsset: async (args: Record<string, unknown>) => {
      ledgerCalls.push(args);
    },
    fetchFn,
    env: {
      get: (name: string) => {
        if (name === "FAL_KEY") return falKey ?? undefined;
        if (name === "FAL_KLING_MODEL") {
          return "fal-ai/kling-video/v3/standard/image-to-video";
        }
        return undefined;
      },
    },
    now: () => new Date("2026-05-02T12:00:30.000Z"),
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  } as unknown as ProcessDeps;

  return { deps, ledgerCalls, costGuardrailCalls };
};

Deno.test("processClaimedCompanionAnimationJob submits a new fal queue request", async () => {
  const { supabase, updates } = createSupabaseHarness();
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const { deps, costGuardrailCalls } = createDeps({
    fetchFn: ((url: string | URL | Request, init?: RequestInit) => {
      fetchCalls.push({ url: String(url), init });
      return Promise.resolve(
        new Response(JSON.stringify({ request_id: "fal-request-1" })),
      );
    }) as typeof fetch,
  });

  const result = await module.processClaimedCompanionAnimationJob({
    supabase: supabase as never,
    job: createJob() as never,
    deps,
  });

  const resultRecord = result as Record<string, unknown>;
  assertEquals(resultRecord.status, "processing");
  assertEquals(resultRecord.providerTaskId, "fal-request-1");
  assertEquals(
    costGuardrailCalls[0]?.endpointKey,
    "process-companion-animation-job",
  );
  assertEquals(
    fetchCalls[0]?.url,
    "https://queue.fal.run/fal-ai/kling-video/v3/standard/image-to-video",
  );
  assertEquals(
    updates.find((update) => update.table === "companion_animation_jobs")
      ?.payload.provider_task_id,
    "fal-request-1",
  );
  assertEquals(
    updates.find((update) => update.table === "companion_evolutions")?.payload
      .animation_status,
    "processing",
  );
});

Deno.test("processClaimedCompanionAnimationJob downloads, uploads, ledgers, and records a completed video", async () => {
  const { supabase, updates, uploads } = createSupabaseHarness();
  const { deps, ledgerCalls } = createDeps({
    fetchFn: ((url: string | URL | Request) => {
      const stringUrl = String(url);
      if (stringUrl.endsWith("/status")) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "COMPLETED" })),
        );
      }
      if (stringUrl.endsWith("/requests/fal-request-1")) {
        return Promise.resolve(
          new Response(JSON.stringify({
            status: "COMPLETED",
            video: { url: "https://fal.example/video.mp4" },
          })),
        );
      }
      return Promise.resolve(
        new Response(new Uint8Array([1, 2, 3]), {
          headers: { "Content-Type": "video/mp4" },
        }),
      );
    }) as typeof fetch,
  });

  const result = await module.processClaimedCompanionAnimationJob({
    supabase: supabase as never,
    job: createJob({ provider_task_id: "fal-request-1" }) as never,
    deps,
  });

  const resultRecord = result as Record<string, unknown>;
  assertEquals(resultRecord.status, "succeeded");
  assertEquals(uploads[0]?.bucket, "companion-animation-videos");
  assertEquals(uploads[0]?.options.contentType, "video/mp4");
  assertEquals(ledgerCalls[0]?.sourceKind, "companion_animation_video");

  const jobUpdate = updates.find((update) =>
    update.table === "companion_animation_jobs"
  );
  const evolutionUpdate = updates.find((update) =>
    update.table === "companion_evolutions"
  );
  assertEquals(jobUpdate?.payload.status, "succeeded");
  assertEquals(evolutionUpdate?.payload.animation_status, "succeeded");
  assertEquals(
    evolutionUpdate?.payload.animation_video_url,
    resultRecord.videoUrl,
  );
});

Deno.test("processClaimedCompanionAnimationJob rejects terminal fal failures without retrying", async () => {
  const { supabase } = createSupabaseHarness();
  const { deps } = createDeps({
    fetchFn: (() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: "FAILED" })),
      )) as typeof fetch,
  });

  await assertRejects(
    () =>
      module.processClaimedCompanionAnimationJob({
        supabase: supabase as never,
        job: createJob({ provider_task_id: "fal-request-1" }) as never,
        deps,
      }),
    Error,
    "fal animation job failed with status FAILED",
  );
});
