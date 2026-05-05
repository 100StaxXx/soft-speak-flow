import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
Deno.env.set("SUPABASE_ANON_KEY", "anon-key");

const module = await import("./index.ts");
type PrewarmDeps = NonNullable<
  Parameters<typeof module.handlePrewarmCompanionAnimation>[1]
>;

const createRequest = (body: Record<string, unknown>) =>
  new Request(
    "https://example.supabase.co/functions/v1/prewarm-companion-animation",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer user-token",
      },
      body: JSON.stringify(body),
    },
  );

const createHarness = ({
  companion,
  existingEvolution = null,
}: {
  companion: Record<string, unknown>;
  existingEvolution?: Record<string, unknown> | null;
}) => {
  const upserts: Array<{ table: string; payload: Record<string, unknown> }> =
    [];
  const enqueueCalls: Array<Record<string, unknown>> = [];
  const workerCalls: string[] = [];

  const supabase = {
    from: (table: string) => {
      if (table === "user_companion") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: companion, error: null }),
              }),
            }),
          }),
        };
      }

      if (table === "companion_evolutions") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: existingEvolution,
                  error: null,
                }),
              }),
            }),
          }),
          upsert: (payload: Record<string, unknown>) => {
            upserts.push({ table, payload });
            return {
              select: () => ({
                single: async () => ({
                  data: {
                    id: "evo-1",
                    animation_status: existingEvolution?.animation_status ??
                      null,
                    animation_video_url:
                      existingEvolution?.animation_video_url ??
                        null,
                  },
                  error: null,
                }),
              }),
            };
          },
        };
      }

      if (table === "companion_animation_jobs") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "job-1" }, error: null }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from: (bucket: string) => ({
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.com/storage/${bucket}/${path}` },
        }),
      }),
    },
  };

  const deps: PrewarmDeps = {
    authenticate: async () => ({ userId: "user-1", isInternal: false }),
    createSupabaseClient: () => supabase,
    createCostGuardrailSessionFn:
      (() => ({})) as unknown as PrewarmDeps["createCostGuardrailSessionFn"],
    enqueueAnimationJob: async (params) => {
      enqueueCalls.push(params as unknown as Record<string, unknown>);
      return { status: "queued", jobId: "job-1" };
    },
    invokeAnimationWorker: async (jobId) => {
      workerCalls.push(jobId);
      return { ok: false, reason: "test_worker_disabled" };
    },
    now: () => new Date("2026-05-03T12:00:00.000Z"),
  };

  return { deps, upserts, enqueueCalls, workerCalls };
};

Deno.test("prewarm-companion-animation enqueues a preset stage-one hatch animation", async () => {
  const harness = createHarness({
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: "fox",
      core_element: "fire",
      current_stage: 0,
      current_xp: 14,
      image_lineage_metadata: null,
    },
  });

  const response = await module.handlePrewarmCompanionAnimation(
    createRequest({ companionId: "companion-1", stage: 1 }),
    harness.deps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "queued");
  assertEquals(body.jobId, "job-1");
  assertEquals(harness.upserts[0].payload.companion_id, "companion-1");
  assertEquals(harness.upserts[0].payload.stage, 1);
  assertEquals(harness.upserts[0].payload.xp_at_evolution, 9);
  assertEquals(
    typeof harness.upserts[0].payload.image_url === "string" &&
      harness.upserts[0].payload.image_url.includes("fox"),
    true,
  );
  assertEquals(harness.enqueueCalls[0].evolutionId, "evo-1");
  assertEquals(harness.enqueueCalls[0].stage, 1);
  assertEquals(harness.workerCalls[0], "job-1");
});

Deno.test("prewarm-companion-animation uses hidden AI stage-one lineage art", async () => {
  const harness = createHarness({
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: null,
      core_element: "ice",
      current_stage: 0,
      current_xp: 14,
      image_lineage_metadata: {
        hiddenBoundaryAnchors: {
          "1": {
            imageUrl: "https://example.com/hidden-stage-one.png",
            visibility: "hidden_until_reached",
          },
        },
      },
    },
  });

  const response = await module.handlePrewarmCompanionAnimation(
    createRequest({ companionId: "companion-1", stage: 1 }),
    harness.deps,
  );

  assertEquals(response.status, 200);
  assertEquals(
    harness.upserts[0].payload.image_url,
    "https://example.com/hidden-stage-one.png",
  );
  assertEquals(harness.upserts[0].payload.xp_at_evolution, 9);
  assertEquals(
    harness.enqueueCalls[0].imageUrl,
    "https://example.com/hidden-stage-one.png",
  );
});

Deno.test("prewarm-companion-animation skips arbitrary future stages", async () => {
  const harness = createHarness({
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: "fox",
      core_element: "fire",
      current_stage: 0,
      current_xp: 14,
      image_lineage_metadata: null,
    },
  });

  const response = await module.handlePrewarmCompanionAnimation(
    createRequest({ companionId: "companion-1", stage: 5 }),
    harness.deps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "skipped");
  assertEquals(body.reason, "evolution_record_unavailable");
  assertEquals(harness.upserts.length, 0);
  assertEquals(harness.enqueueCalls.length, 0);
});

Deno.test("prewarm-companion-animation requeues an existing claimed later-stage evolution", async () => {
  const harness = createHarness({
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: null,
      core_element: "water",
      current_stage: 3,
      current_xp: 100,
      image_lineage_metadata: null,
    },
    existingEvolution: {
      id: "evo-2",
      image_url: "https://example.com/stage-3.png",
      animation_status: "failed",
      animation_video_url: null,
    },
  });

  const response = await module.handlePrewarmCompanionAnimation(
    createRequest({ companionId: "companion-1", stage: 3, force: true }),
    harness.deps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "queued");
  assertEquals(harness.upserts[0].payload.stage, 3);
  assertEquals(
    harness.upserts[0].payload.image_url,
    "https://example.com/stage-3.png",
  );
  assertEquals(harness.enqueueCalls[0].evolutionId, "evo-1");
  assertEquals(harness.enqueueCalls[0].stage, 3);
  assertEquals(
    harness.enqueueCalls[0].imageUrl,
    "https://example.com/stage-3.png",
  );
});

Deno.test("prewarm-companion-animation kicks an existing queued animation worker", async () => {
  const harness = createHarness({
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: null,
      core_element: "water",
      current_stage: 3,
      current_xp: 100,
      image_lineage_metadata: null,
    },
    existingEvolution: {
      id: "evo-2",
      image_url: "https://example.com/stage-3.png",
      animation_status: "queued",
      animation_video_url: null,
    },
  });

  const response = await module.handlePrewarmCompanionAnimation(
    createRequest({ companionId: "companion-1", stage: 3 }),
    harness.deps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "queued");
  assertEquals(body.jobId, "job-1");
  assertEquals(harness.enqueueCalls.length, 0);
  assertEquals(harness.workerCalls[0], "job-1");
});

Deno.test("prewarm-companion-animation skips eggs that are not hatch-ready", async () => {
  const harness = createHarness({
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: "fox",
      core_element: "fire",
      current_stage: 0,
      current_xp: 0,
      image_lineage_metadata: null,
    },
  });

  const response = await module.handlePrewarmCompanionAnimation(
    createRequest({ companionId: "companion-1", stage: 1 }),
    harness.deps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "skipped");
  assertEquals(body.reason, "hatch_not_ready");
  assertEquals(harness.upserts.length, 0);
  assertEquals(harness.enqueueCalls.length, 0);
});

Deno.test("prewarm-companion-animation does not mint claimed rows after hatch", async () => {
  const harness = createHarness({
    companion: {
      id: "companion-1",
      user_id: "user-1",
      preset_id: "fox",
      core_element: "fire",
      current_stage: 1,
      current_xp: 14,
      image_lineage_metadata: null,
    },
  });

  const response = await module.handlePrewarmCompanionAnimation(
    createRequest({ companionId: "companion-1", stage: 1 }),
    harness.deps,
  );
  const body = await response.json();

  assertEquals(response.status, 200);
  assertEquals(body.status, "skipped");
  assertEquals(body.reason, "evolution_record_unavailable");
  assertEquals(harness.upserts.length, 0);
  assertEquals(harness.enqueueCalls.length, 0);
});
