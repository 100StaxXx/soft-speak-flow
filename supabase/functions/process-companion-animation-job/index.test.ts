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
  video_url: null,
  storage_path: null,
  completed_at: null,
  requested_at: "2026-05-02T12:00:00.000Z",
  started_at: "2026-05-02T12:00:01.000Z",
  updated_at: "2026-05-02T12:00:01.000Z",
  ...overrides,
});

Deno.test("handleProcessCompanionAnimationJob returns a playable URL for terminal succeeded jobs", async () => {
  const terminalJob = createJob({
    status: "succeeded",
    provider_task_id: "fal-request-1",
    video_url: "https://example.com/animation.mp4",
  });
  const supabase = {
    from: (table: string) => {
      if (table !== "companion_animation_jobs") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: terminalJob, error: null }),
          }),
        }),
      };
    },
  };
  const { deps } = createDeps({
    fetchFn: (() => {
      throw new Error("terminal jobs should not call the provider");
    }) as typeof fetch,
  });
  const handlerDeps = {
    ...deps,
    createClient: (() => supabase) as never,
    env: {
      get: (name: string) => {
        if (name === "SUPABASE_URL") return "https://example.supabase.co";
        if (name === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
        if (name === "SUPABASE_ANON_KEY") return "anon-key";
        if (name === "INTERNAL_FUNCTION_SECRET") return "internal-secret";
        return deps.env.get(name);
      },
    },
  } as ProcessDeps;

  const response = await module.handleProcessCompanionAnimationJob(
    new Request("https://example.test/process", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": "internal-secret",
      },
      body: JSON.stringify({ jobId: "job-1" }),
    }),
    handlerDeps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "succeeded");
  assertEquals(body.videoUrl, "https://example.com/animation.mp4");
});

const createSupabaseHarness = ({
  failEvolutionUpdates = false,
}: {
  failEvolutionUpdates?: boolean;
} = {}) => {
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
          if (table === "companion_evolutions" && failEvolutionUpdates) {
            return { error: new Error("evolution write failed") };
          }
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

Deno.test("processClaimedCompanionAnimationJob falls back to the top-level Kling queue request path", async () => {
  const { supabase, updates, uploads } = createSupabaseHarness();
  const fetchCalls: string[] = [];
  const { deps } = createDeps({
    fetchFn: ((url: string | URL | Request) => {
      const stringUrl = String(url);
      fetchCalls.push(stringUrl);

      if (
        stringUrl.endsWith(
          "/fal-ai/kling-video/v3/standard/image-to-video/requests/fal-request-1/status",
        )
      ) {
        return Promise.resolve(
          new Response("method not allowed", { status: 405 }),
        );
      }

      if (
        stringUrl.endsWith("/fal-ai/kling-video/requests/fal-request-1/status")
      ) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "COMPLETED" })),
        );
      }

      if (
        stringUrl.endsWith(
          "/fal-ai/kling-video/v3/standard/image-to-video/requests/fal-request-1",
        )
      ) {
        return Promise.resolve(
          new Response("method not allowed", { status: 405 }),
        );
      }

      if (stringUrl.endsWith("/fal-ai/kling-video/requests/fal-request-1")) {
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
  assertEquals(
    fetchCalls.includes(
      "https://queue.fal.run/fal-ai/kling-video/requests/fal-request-1/status",
    ),
    true,
  );
  assertEquals(
    updates.find((update) => update.table === "companion_evolutions")?.payload
      .animation_status,
    "succeeded",
  );
});

Deno.test("processClaimedCompanionAnimationJob does not mark a job succeeded before the evolution row has the video URL", async () => {
  const { supabase, updates } = createSupabaseHarness({
    failEvolutionUpdates: true,
  });
  const { deps } = createDeps({
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

  await assertRejects(
    () =>
      module.processClaimedCompanionAnimationJob({
        supabase: supabase as never,
        job: createJob({ provider_task_id: "fal-request-1" }) as never,
        deps,
      }),
    Error,
    "evolution write failed",
  );

  assertEquals(
    updates.some((update) =>
      update.table === "companion_animation_jobs" &&
      update.payload.status === "succeeded"
    ),
    false,
  );
});

Deno.test("handleProcessCompanionAnimationJob repairs a succeeded evolution when the job terminal update fails", async () => {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> =
    [];
  const baseJob = createJob({
    provider_task_id: "fal-request-1",
    status: "queued",
  });
  let jobSelectCount = 0;
  let succeededJobUpdateAttempts = 0;
  let evolutionState: Record<string, unknown> = {
    animation_status: "processing",
    animation_video_url: null,
    animation_storage_path: null,
    animation_completed_at: null,
  };

  const createUpdateChain = (
    table: string,
    payload: Record<string, unknown>,
  ) => {
    const chain = {
      error: null as Error | null,
      eq: (_column: string, _value: unknown) => chain,
      select: (_columns: string) => ({
        maybeSingle: async () => ({
          data: {
            ...baseJob,
            status: "processing",
            started_at: "2026-05-02T12:00:30.000Z",
            updated_at: "2026-05-02T12:00:30.000Z",
          },
          error: null,
        }),
      }),
    };

    updates.push({ table, payload });
    if (table === "companion_evolutions") {
      evolutionState = { ...evolutionState, ...payload };
    }
    if (
      table === "companion_animation_jobs" && payload.status === "succeeded"
    ) {
      succeededJobUpdateAttempts += 1;
      if (succeededJobUpdateAttempts === 1) {
        chain.error = new Error("job terminal update failed");
      }
    }

    return chain;
  };

  const supabase = {
    from: (table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, _value: unknown) => ({
          maybeSingle: async () => {
            if (table === "companion_animation_jobs") {
              jobSelectCount += 1;
              return {
                data: {
                  ...baseJob,
                  status: jobSelectCount === 1 ? "queued" : "processing",
                },
                error: null,
              };
            }

            if (table === "companion_evolutions") {
              return { data: evolutionState, error: null };
            }

            return { data: null, error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) =>
        createUpdateChain(table, payload),
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async () => ({ error: null }),
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl:
              `https://example.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        }),
      }),
    },
  };

  const { deps } = createDeps({
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
  const handlerDeps = {
    ...deps,
    createClient: (() => supabase) as never,
    env: {
      get: (name: string) => {
        if (name === "SUPABASE_URL") return "https://example.supabase.co";
        if (name === "SUPABASE_SERVICE_ROLE_KEY") return "service-role-key";
        if (name === "SUPABASE_ANON_KEY") return "anon-key";
        if (name === "INTERNAL_FUNCTION_SECRET") return "internal-secret";
        return deps.env.get(name);
      },
    },
  } as ProcessDeps;

  const response = await module.handleProcessCompanionAnimationJob(
    new Request("https://example.test/process", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": "internal-secret",
      },
      body: JSON.stringify({ jobId: "job-1" }),
    }),
    handlerDeps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "succeeded");
  assertEquals(body.repaired, true);
  assertEquals(succeededJobUpdateAttempts, 2);
  assertEquals(
    updates.some((update) =>
      update.table === "companion_evolutions" &&
      update.payload.animation_status === "failed"
    ),
    false,
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
