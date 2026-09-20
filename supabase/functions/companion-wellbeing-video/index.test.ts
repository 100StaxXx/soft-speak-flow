import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { deps, handleWellbeingVideo, trustedSourceImage, retryMode } from "./index.ts";
const BASE = "https://testproject.supabase.co";
const IMAGE = `${BASE}/storage/v1/object/public/companion-images/user-1/one.png`;
const body = { action: "prepare", companionId: "companion-1", category: "mind", stage: 5, sourceImageUrl: IMAGE };

function fixture() {
  const jobs: any[] = [];
  const companion: any = { id: "companion-1", user_id: "user-1", current_stage: 8, current_image_url: IMAGE, core_element: "storm", product_mode: "cosmiq" };
  const calls = { submit: [] as any[], upload: 0, ledger: 0, product: "cosmiq", internal: false, denied: false, poll: "COMPLETED", throws: false };
  const db: any = {
    rpc: () => {
      const job = jobs.find((row) => ["queued", "submitting", "processing"].includes(row.status) && !row.lease_token);
      if (job) job.lease_token = "lease-1";
      return Promise.resolve({ data: job ? [{ ...job }] : [], error: null });
    },
    from: (table: string) => {
      const filters: Array<(row: any) => boolean> = [];
      let patch: any;
      let inserted: any;
      let head = false;
      const rows = () => (table === "user_companion" ? [companion] : jobs).filter((row) => filters.every((filter) => filter(row)));
      const execute = () => {
        if (inserted) {
          const exists = jobs.some((job) => job.companion_id === inserted.companion_id && job.stage === inserted.stage && job.category === inserted.category && job.source_key === inserted.source_key && job.prompt_version === inserted.prompt_version);
          if (!exists) jobs.push({ id: `job-${jobs.length}`, status: "queued", retry_count: 0, deadline_at: new Date(Date.now() + 30 * 60_000).toISOString(), created_at: new Date().toISOString(), ...inserted });
        }
        const matched = rows();
        if (patch) matched.forEach((row) => Object.assign(row, patch));
        return { data: head ? null : matched, count: matched.length, error: null };
      };
      const chain: any = {
        select: (_columns: string, options?: any) => { head = options?.head ?? false; return chain; },
        eq: (key: string, value: unknown) => { filters.push((row) => row[key] === value); return chain; },
        gte: () => chain,
        update: (value: any) => { patch = value; return chain; },
        upsert: (value: any) => { inserted = value; return chain; },
        maybeSingle: () => { const result = execute(); return Promise.resolve({ ...result, data: result.data?.[0] ?? null }); },
        then: (resolve: any) => Promise.resolve(execute()).then(resolve),
      };
      return chain;
    },
    storage: { from: () => ({ upload: () => { calls.upload++; return { error: null }; }, getPublicUrl: () => ({ data: { publicUrl: `${BASE}/clip.mp4` } }) }) },
  };
  const d: typeof deps = {
    ...deps, database: () => db,
    authenticate: async () => calls.denied ? new Response("Unauthorized", { status: 401 }) : calls.internal ? { isInternal: true } : { userId: "user-1", isInternal: false },
    product: async () => calls.product as "cosmiq" | "graceward",
    env: (key) => key === "SUPABASE_URL" ? BASE : "fake-test-key", now: () => Date.now(),
    guardrails: (() => ({ wrapFetch: (fetcher: any) => fetcher })) as any,
    submit: async (args) => { calls.submit.push(args); if (calls.throws) throw new Error("Timeout after submit"); return { requestId: "fal-one", statusUrl: "", responseUrl: "", cancelUrl: "" }; },
    status: async () => ({ status: calls.poll, responseUrl: null, raw: {} }),
    result: async () => ({ videoUrl: `${BASE}/result.mp4`, status: "COMPLETED", raw: {} }),
    download: async () => ({ bytes: new Uint8Array([1,2]), contentType: "video/mp4" }),
    ledger: async () => { calls.ledger++; },
  };
  const request = (payload: any = body) => handleWellbeingVideo(new Request("https://example.test", { method: "POST", body: JSON.stringify(payload) }), d);
  return { jobs, companion, calls, d, request };
}

Deno.test("rejects unauthenticated, other-product, unowned and stale appearance requests", async () => {
  const f = fixture();
  f.calls.denied = true; assertEquals((await f.request()).status, 401);
  f.calls.denied = false; f.calls.product = "graceward"; assertEquals((await f.request()).status, 403);
  f.calls.product = "cosmiq"; f.companion.user_id = "someone-else"; assertEquals((await f.request()).status, 404);
  f.companion.user_id = "user-1"; assertEquals((await f.request({ ...body, stage: 13 })).status, 409);
  assertEquals((await f.request({ ...body, sourceImageUrl: "https://evil.test/photo.png" })).status, 409);
  assertEquals((await f.request({ ...body, category: "prayer" })).status, 400);
  assertEquals(f.jobs.length, 0);
});
Deno.test("only accepts images from approved project storage buckets", () => {
  assert(trustedSourceImage(IMAGE, BASE));
  for (const image of ["http://localhost:54321/private", "https://evil.test/photo.png", `${BASE}/storage/v1/object/public/private/a.png`, `${IMAGE}?secret=x`, "/companion.png"]) assertEquals(trustedSourceImage(image, BASE), false);
});
Deno.test("status checks never enqueue, repeated prepare calls reuse one saved job", async () => {
  const f = fixture();
  assertEquals(await (await f.request({ ...body, action: "status" })).json(), { clip: null });
  assertEquals(f.jobs.length, 0);
  await f.request(); await f.request();
  assertEquals(f.jobs.length, 1);
  assertEquals(f.calls.submit.length, 0);
  assert(f.jobs[0].prompt.includes("moving reflection"));
  f.jobs[0].status = "succeeded"; f.jobs[0].video_url = "saved.mp4";
  assertEquals((await (await f.request()).json()).clip.video_url, "saved.mp4");
  assertEquals(f.jobs.length, 1);
});
Deno.test("each category and new revealed portrait gets its own cache entry", async () => {
  const f = fixture(); await f.request(); await f.request({ ...body, category: "soul" });
  f.companion.current_stage = 13; f.companion.current_image_url = IMAGE.replace("one.png", "two.png");
  await f.request({ ...body, stage: 13, sourceImageUrl: f.companion.current_image_url });
  assertEquals(f.jobs.length, 3);
  assertEquals(new Set(f.jobs.map((job) => job.prompt)).size, 3);
});
Deno.test("worker submits exactly three seconds once, saves provider id, then stores and registers the video", async () => {
  const f = fixture(); await f.request(); f.calls.internal = true;
  await f.request({});
  assertEquals(f.calls.submit.length, 1);
  assertEquals(f.calls.submit[0].durationSeconds, 3);
  assertEquals(f.calls.submit[0].imageUrl, IMAGE);
  assertEquals(f.jobs[0].provider_task_id, "fal-one");
  await f.request({});
  assertEquals(f.calls.submit.length, 1);
  assertEquals(f.jobs[0].status, "succeeded");
  assertEquals(f.calls.upload, 1); assertEquals(f.calls.ledger, 1);
});
Deno.test("does not resubmit after ambiguous provider failure or worker crash", async () => {
  const f = fixture(); await f.request(); f.calls.internal = true; f.calls.throws = true;
  await f.request({}); await f.request({});
  assertEquals(f.calls.submit.length, 1);
  assertEquals(f.jobs[0].error_code, "submission_needs_review");
  f.jobs[0].status = "submitting"; f.jobs[0].lease_token = null;
  await f.request({});
  assertEquals(f.calls.submit.length, 1);
  assertEquals(f.jobs[0].status, "failed");
});
Deno.test("pending provider work is polled without a new generation and times out cleanly", async () => {
  const f = fixture(); await f.request(); f.calls.internal = true; await f.request({});
  f.calls.poll = "IN_PROGRESS"; await f.request({});
  assertEquals(f.jobs[0].status, "processing"); assertEquals(f.calls.submit.length, 1);
  f.jobs[0].deadline_at = new Date(Date.now() - 60_000).toISOString(); await f.request({});
  assertEquals(f.jobs[0].error_code, "preparation_timed_out");
});

Deno.test("explicit retry is bounded and resumes timed-out work without another paid submission", async () => {
  const f = fixture(); await f.request(); f.calls.internal = true; await f.request({});
  f.jobs[0].deadline_at = new Date(Date.now() - 60_000).toISOString(); await f.request({});
  f.calls.internal = false; await f.request({ ...body, action: "retry" });
  assertEquals(f.jobs[0].status, "processing"); assertEquals(f.jobs[0].retry_count, 1);
  assertEquals(f.jobs[0].provider_task_id, "fal-one");
  f.calls.internal = true; await f.request({});
  assertEquals(f.jobs[0].status, "succeeded"); assertEquals(f.calls.submit.length, 1);
  assertEquals(retryMode({ status: "failed", error_code: "submission_needs_review" }), null);
  assertEquals(retryMode({ status: "failed", error_code: "provider_failed", retry_count: 1 }), null);
  assertEquals(retryMode({ status: "failed", error_code: "provider_failed", retry_count: 0 }), "queued");
});
Deno.test("skips queued work if the companion changes and blocks Graceward workers", async () => {
  const f = fixture(); await f.request(); f.calls.internal = true; f.companion.current_stage = 13; await f.request({});
  assertEquals(f.jobs[0].error_code, "appearance_changed"); assertEquals(f.calls.submit.length, 0);
  const g = fixture(); await g.request(); g.calls.internal = true; g.calls.product = "graceward"; await g.request({});
  assertEquals(g.jobs[0].error_code, "wrong_product"); assertEquals(g.calls.submit.length, 0);
});
