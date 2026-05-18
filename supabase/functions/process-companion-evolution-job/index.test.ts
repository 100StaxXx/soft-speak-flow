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

const module = await import("./index.ts");

type FakeJob = {
  id: string;
  user_id: string;
  companion_id: string;
  requested_stage: number;
  status: "queued" | "processing" | "succeeded" | "failed";
  retry_count: number;
  next_retry_at: string | null;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  requested_at: string;
  updated_at: string;
};

const queuedJob: FakeJob = {
  id: "evolution-job-1",
  user_id: "user-1",
  companion_id: "companion-1",
  requested_stage: 5,
  status: "queued",
  retry_count: 0,
  next_retry_at: null,
  error_code: null,
  error_message: null,
  started_at: null,
  requested_at: "2026-05-17T12:00:00.000Z",
  updated_at: "2026-05-17T12:00:00.000Z",
};

const processingJob: FakeJob = {
  ...queuedJob,
  status: "processing",
  started_at: "2026-05-17T12:00:01.000Z",
  updated_at: "2026-05-17T12:00:01.000Z",
};

const makeInternalRequest = () =>
  new Request(
    "https://example.supabase.co/functions/v1/process-companion-evolution-job",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-key": "internal-secret",
      },
      body: JSON.stringify({}),
    },
  );

const createFakeSupabaseFactory = ({
  job = queuedJob,
  deviceTokens = [],
}: {
  job?: FakeJob | null;
  deviceTokens?: Array<{ device_token: string }>;
}) => {
  const updates: Array<{ table: string; payload: Record<string, unknown> }> =
    [];
  const functionInvocations: Array<{
    name: string;
    options?: Record<string, unknown>;
  }> = [];

  const createClient = () => {
    const from = (table: string) => {
      let updatePayload: Record<string, unknown> | null = null;
      const filters: Record<string, unknown> = {};

      const resolveMaybeSingle = async () => {
        if (table === "companion_evolution_jobs") {
          if (updatePayload?.status === "processing") {
            return { data: processingJob, error: null };
          }
          return { data: job, error: null };
        }

        if (table === "user_companion") {
          return {
            data: {
              id: "companion-1",
              initial_image_url: "https://example.com/egg.png",
              created_at: "2026-05-01T00:00:00.000Z",
              spirit_animal: "Wolf",
              core_element: "fire",
              favorite_color: "#ff8800",
              vitality: 300,
              wisdom: 300,
              discipline: 300,
              resolve: 300,
              creativity: 300,
              alignment: 300,
            },
            error: null,
          };
        }

        if (table === "companion_evolutions") {
          if (filters.id === "evo-5") {
            return {
              data: {
                id: "evo-5",
                companion_id: "companion-1",
                stage: 5,
                image_url: "https://example.com/stage-5.png",
                generation_metadata: { sourceType: "lineage_generation" },
                animation_status: null,
                animation_video_url: null,
              },
              error: null,
            };
          }

          if (filters.stage === 4) {
            return {
              data: { image_url: "https://example.com/stage-4.png" },
              error: null,
            };
          }

          return { data: { id: "evo-5" }, error: null };
        }

        if (table === "companion_animation_jobs") {
          return { data: null, error: null };
        }

        if (table === "companion_stories") {
          return { data: { id: "story-5" }, error: null };
        }

        if (table === "profiles") {
          return { data: { referred_by: null }, error: null };
        }

        return { data: null, error: null };
      };

      const resolveAwait = async () => {
        if (table === "companion_evolution_jobs" && updatePayload) {
          return { data: null, error: null };
        }

        if (table === "companion_evolution_cards") {
          return {
            data: Array.from({ length: 6 }, (_, stage) => ({
              evolution_stage: stage,
            })),
            error: null,
          };
        }

        if (table === "push_device_tokens") {
          return { data: deviceTokens, error: null };
        }

        return resolveMaybeSingle();
      };

      const builder = {
        select: () => builder,
        update: (payload: Record<string, unknown>) => {
          updatePayload = payload;
          updates.push({ table, payload });
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        in: () => builder,
        or: () => builder,
        order: () => builder,
        limit: () => builder,
        lte: () => builder,
        maybeSingle: resolveMaybeSingle,
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => resolveAwait().then(onFulfilled, onRejected),
      };

      return builder;
    };

    return {
      from,
      functions: {
        invoke: async (name: string, options?: Record<string, unknown>) => {
          functionInvocations.push({ name, options });
          return { data: null, error: null };
        },
      },
      rpc: async () => ({ data: null, error: null }),
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    };
  };

  return { createClient, updates, functionInvocations };
};

Deno.test("process-companion-evolution-job internal scheduler claims and completes a queued job", async () => {
  const fakeSupabase = createFakeSupabaseFactory({
    job: queuedJob,
    deviceTokens: [{ device_token: "device-token-1" }],
  });
  const fetchCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const animationEnqueueCalls: Array<Record<string, unknown>> = [];

  const response = await module.handleProcessCompanionEvolutionJob(
    makeInternalRequest(),
    {
      createClient: fakeSupabase.createClient as never,
      fetch: (async (url: string | URL | Request, init?: RequestInit) => {
        fetchCalls.push({
          url: String(url),
          body: JSON.parse(String(init?.body ?? "{}")),
        });
        return new Response(
          JSON.stringify({
            evolved: true,
            previous_stage: 4,
            new_stage: 5,
            image_url: "https://example.com/stage-5.png",
            evolution_id: "evo-5",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }) as typeof fetch,
      createCostGuardrailSession: (() => ({
        wrapFetch: (fetchFn: typeof fetch) => fetchFn,
        enforceAccess: async () => undefined,
      })) as never,
      enqueueCompanionAnimationJob: (async (
        args: Record<string, unknown>,
      ) => {
        animationEnqueueCalls.push(args);
        return { status: "queued", jobId: "animation-job-1" };
      }) as never,
      info: () => undefined,
      warn: () => undefined,
    },
  );

  const payload = await response.json();
  assertEquals(response.status, 200, "Expected queued job to complete");
  assertEquals(payload.status, "succeeded", "Expected success payload");
  assertEquals(payload.jobId, "evolution-job-1", "Expected processed job id");
  assertEquals(
    payload.animationEnqueue?.status,
    "queued",
    "Expected missing animation to be enqueued after image success",
  );
  assertEquals(
    payload.animationEnqueue?.jobId,
    "animation-job-1",
    "Expected animation enqueue result to be returned",
  );
  assertEquals(fetchCalls.length, 1, "Expected one evolution pipeline call");
  assertEquals(
    fetchCalls[0].body.userId,
    "user-1",
    "Expected internal pipeline call to identify the job owner",
  );
  assert(
    fakeSupabase.updates.some((update) =>
      update.table === "companion_evolution_jobs" &&
      update.payload.status === "processing"
    ),
    "Expected the job to be claimed for processing",
  );
  assert(
    fakeSupabase.updates.some((update) =>
      update.table === "companion_evolution_jobs" &&
      update.payload.status === "succeeded"
    ),
    "Expected the job to be marked succeeded",
  );
  assertEquals(
    animationEnqueueCalls.length,
    1,
    "Expected worker to enqueue the missing animation once",
  );
  assertEquals(
    animationEnqueueCalls[0]?.evolutionId,
    "evo-5",
    "Expected animation enqueue to target the returned evolution id",
  );
  assertEquals(
    animationEnqueueCalls[0]?.stage,
    5,
    "Expected animation enqueue to use the requested visual stage",
  );
  assertEquals(
    animationEnqueueCalls[0]?.imageUrl,
    "https://example.com/stage-5.png",
    "Expected animation enqueue to use the completed evolution image",
  );
  assertEquals(
    animationEnqueueCalls[0]?.previousImageUrl,
    "https://example.com/stage-4.png",
    "Expected animation enqueue to include the previous evolution image",
  );
  assertEquals(
    animationEnqueueCalls[0]?.element,
    "fire",
    "Expected animation enqueue to include companion element",
  );
  assertEquals(
    fakeSupabase.functionInvocations.some((call) =>
      call.name === "send-apns-notification"
    ),
    false,
    "Expected evolution image worker not to send the ready push before animation completion",
  );
});

Deno.test("process-companion-evolution-job internal scheduler idles when no job is queued", async () => {
  const fakeSupabase = createFakeSupabaseFactory({ job: null });

  const response = await module.handleProcessCompanionEvolutionJob(
    makeInternalRequest(),
    {
      createClient: fakeSupabase.createClient as never,
      fetch: (async () => {
        throw new Error("fetch should not be called without a queued job");
      }) as typeof fetch,
    },
  );

  const payload = await response.json();
  assertEquals(response.status, 200, "Expected idle response to be successful");
  assertEquals(payload.status, "idle", "Expected idle status");
});
