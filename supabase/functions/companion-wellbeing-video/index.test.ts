import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { deps, handleWellbeingVideo, trustedSourceImage, resolveWellbeingSourceImage, hasWellbeingVideoAccess, retryMode } from "./index.ts";
const BASE = "https://testproject.supabase.co";
const IMAGE = `${BASE}/storage/v1/object/public/companion-images/user-1/one.png`;
const body = { action: "prepare", companionId: "companion-1", category: "mind", stage: 5, sourceImageUrl: IMAGE, promptVersion: 3 };
import { COMPANION_VIDEO_CATEGORIES, IDLE_VIDEO_CATEGORIES, WELLBEING_PROMPT_VERSION } from "../../../src/shared/companionWellbeing.ts";

Deno.test("runtime smoke check is service-only and never touches jobs or paid generation", async () => {
  let verified = 0;
  const d = { ...deps,
    authenticateService: async () => new Response(null, { status: 403 }) as any,
    database: () => { throw new Error("Must not access customer data"); },
    verifySceneRuntime: async () => { verified++; return { habitats: 42, composedBytes: 20000 }; },
  };
  const request = () => new Request(`${BASE}/companion-wellbeing-video/runtime-check`, { method: "POST" });
  assertEquals((await handleWellbeingVideo(request(), d)).status, 403);
  assertEquals(verified, 0);
  d.authenticateService = async () => ({ userId: "service_role" });
  const success = await handleWellbeingVideo(request(), d);
  assertEquals(await success.json(), { ok: true, habitats: 42, composedBytes: 20000 });
  d.verifySceneRuntime = async () => { throw new Error("missing WASM"); };
  assertEquals((await handleWellbeingVideo(request(), d)).status, 503);
});

function fixture() {
  const jobs: any[] = [];
  const companion: any = { id: "companion-1", user_id: "user-1", current_stage: 8, current_image_url: IMAGE, core_element: "storm", product_mode: "cosmiq" };
  const calls = { submit: [] as any[], scenes: [] as any[], sceneFailure: false, upload: 0, ledger: 0, product: "cosmiq", internal: false, denied: false, access: true, poll: "COMPLETED", throws: false };
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
    access: async () => calls.access,
    scene: async (args) => {
      calls.scenes.push(args);
      if (calls.sceneFailure) throw new Error("Habitat unavailable");
      return `${BASE}/storage/v1/object/public/companion-images/user-1/wellbeing-scenes/${args.job.id}.jpg`;
    },
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
Deno.test("fresh cinema portraits and legacy bundled portraits can prepare and submit", async () => {
  const relative = "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__ice.png";
  for (const portrait of [IMAGE.replace("companion-images", "evolution-cards"), relative]) {
    const f = fixture(); f.companion.current_image_url = portrait;
    assertEquals((await f.request({ ...body, sourceImageUrl: portrait })).status, 200);
    f.calls.internal = true; await f.request({});
    assertEquals(f.calls.submit.length, 1);
    assertEquals(f.calls.scenes[0].job.source_image_url, resolveWellbeingSourceImage(portrait, BASE));
    assert(f.calls.submit[0].imageUrl.includes("/wellbeing-scenes/"));
  }
});
Deno.test("relative remote presets match their normalized client URLs without permitting arbitrary hosts", async () => {
  const f = fixture();
  const path = "companion-presets/dragon/t2_adolescent/normal/dragon__t2_adolescent__normal__ice.png";
  f.companion.current_image_url = `/${path}`;
  assertEquals((await f.request({ ...body, sourceImageUrl: `${BASE}/storage/v1/object/public/${path}` })).status, 200);
  for (const invalid of [`//evil.test/${path}`, `https://evil.test/${path}`, "/companion-presets/../private.png", `/${path}?token=secret`, `https://user:password@testproject.supabase.co/storage/v1/object/public/${path}`]) {
    assertEquals(resolveWellbeingSourceImage(invalid, BASE), null);
  }
});
Deno.test("expired access cannot queue or submit paid generation, but can read a cached clip", async () => {
  const f = fixture(); f.calls.access = false;
  assertEquals((await f.request()).status, 403); assertEquals(f.jobs.length, 0);
  f.calls.access = true; await f.request();
  f.calls.access = false; f.calls.internal = true; await f.request({});
  assertEquals(f.calls.submit.length, 0); assertEquals(f.jobs[0].error_code, "access_required");
  f.jobs[0].status = "succeeded"; f.jobs[0].video_url = "cached.mp4";
  f.calls.internal = false;
  assertEquals((await (await f.request({ ...body, action: "status" })).json()).clip.video_url, "cached.mp4");
});
Deno.test("a valid 14-day app trial is honored without requiring a paid subscription", async () => {
  const now = Date.now();
  const row = { user_id: "user-1", source: "trial", is_active: true, trial_started_at: new Date(now - 13 * 86400_000).toISOString(), trial_ends_at: new Date(now + 86400_000).toISOString() };
  const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: row, error: null }) };
  assertEquals(await hasWellbeingVideoAccess({ from: (table: string) => { assertEquals(table, "account_entitlements"); return query; } }, "user-1"), true);
});

Deno.test("unsubmitted access-blocked jobs resume only after access is restored", async () => {
  const f = fixture(); await f.request();
  f.calls.access = false; f.calls.internal = true; await f.request({});
  assertEquals(f.jobs[0].error_code, "access_required");
  f.calls.internal = false;
  assertEquals((await f.request()).status, 403);
  assertEquals(f.jobs[0].status, "failed");
  f.calls.access = true;
  await Promise.all([f.request(), f.request()]);
  assertEquals(f.jobs.length, 1);
  assertEquals(f.jobs[0].status, "queued");
  assertEquals(f.jobs[0].retry_count, 1);
  f.calls.internal = true; await f.request({});
  assertEquals(f.calls.submit.length, 1);
  assertEquals(retryMode({ status: "failed", error_code: "access_required", provider_task_id: "already-submitted" }), null);
});
Deno.test("status checks never enqueue, repeated prepare calls reuse one saved job", async () => {
  const f = fixture();
  assertEquals(await (await f.request({ ...body, action: "status" })).json(), { clip: null, state: "not_generated" });
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

Deno.test("missing portrait is preparation, not an animation failure or a paid job", async () => {
  const f = fixture(); f.companion.current_image_url = null;
  const response = await f.request({ ...body, sourceImageUrl: "" });
  assertEquals(response.status, 200);
  assertEquals((await response.json()).clip.status, "awaiting_portrait");
  assertEquals(f.jobs.length, 0);
});

Deno.test("prewarming all categories and repeating it keeps exactly three durable jobs", async () => {
  const f = fixture();
  for (let visit = 0; visit < 2; visit++) {
    await Promise.all(["mind", "body", "soul"].map((category) => f.request({ ...body, category })));
  }
  assertEquals(f.jobs.length, 3);
  assertEquals(f.calls.submit.length, 0);
});
Deno.test("prewarming all seven moments twice creates only seven jobs, including four 4-second idle clips", async () => {
  const f = fixture();
  for (let visit = 0; visit < 2; visit++) {
    const responses = await Promise.all(COMPANION_VIDEO_CATEGORIES.map((category) => f.request({ ...body, category })));
    for (const response of responses) assertEquals(response.status, 200);
  }
  assertEquals(f.jobs.length, 7);
  assertEquals(f.calls.submit.length, 0);
  f.calls.internal = true;
  for (let tick = 0; tick < 6; tick++) await f.request({});
  assertEquals(f.calls.submit.length, 7);
  assertEquals(f.calls.submit.filter((call) => call.durationSeconds === 4).length, 4);
  assertEquals(f.calls.submit.filter((call) => call.durationSeconds === 5).length, 3);
  for (const call of f.calls.submit) assertEquals(call.endImageUrl, call.imageUrl);
  f.calls.internal = false;
  const response = await (await f.request({ ...body, category: IDLE_VIDEO_CATEGORIES[0], action: "status" })).json();
  assertEquals(response.clip.duration_seconds, 4);
  assertEquals(response.clip.prompt_version, WELLBEING_PROMPT_VERSION);
  assert(response.clip.scene_image_url.includes("/wellbeing-scenes/"));
});
Deno.test("jobs queued by the previous release retain their original duration and submission contract", async () => {
  const f = fixture(); await f.request(); f.jobs[0].prompt_version = 2;
  f.calls.internal = true; await f.request({});
  assertEquals(f.calls.submit[0].durationSeconds, 3);
  assertEquals(f.calls.submit[0].endImageUrl, undefined);
});
Deno.test("old installed clients never receive the new longer clips", async () => {
  const f = fixture(); await f.request();
  f.jobs[0].status = "succeeded"; f.jobs[0].video_url = "new-five-second.mp4";
  const oldRequest = { ...body, promptVersion: undefined };
  assertEquals((await f.request(oldRequest)).status, 426);
  f.jobs[0].prompt_version = 2; f.jobs[0].video_url = "old-three-second.mp4";
  const old = await (await f.request(oldRequest)).json();
  assertEquals(old.clip.video_url, "old-three-second.mp4");
  assertEquals(old.clip.duration_seconds, 3);
  assertEquals(f.jobs.length, 1);
});
Deno.test("daily cap permits two sets, but blocks a third appearance without changing saved clips", async () => {
  const f = fixture();
  for (const category of COMPANION_VIDEO_CATEGORIES) await f.request({ ...body, category });
  const second = IMAGE.replace("one.png", "two.png"); f.companion.current_image_url = second;
  for (const category of COMPANION_VIDEO_CATEGORIES) assertEquals((await f.request({ ...body, sourceImageUrl: second, category })).status, 200);
  assertEquals(f.jobs.length, 14);
  assertEquals((await f.request({ ...body, sourceImageUrl: second })).status, 200);
  const third = IMAGE.replace("one.png", "three.png"); f.companion.current_image_url = third;
  assertEquals((await f.request({ ...body, sourceImageUrl: third })).status, 429);
  assertEquals(f.jobs.length, 14);
});
Deno.test("worker submits five seconds with identical scene endpoints once, then stores the video", async () => {
  const f = fixture(); await f.request(); f.calls.internal = true;
  await f.request({});
  assertEquals(f.calls.submit.length, 1);
  assertEquals(f.calls.submit[0].durationSeconds, 5);
  assertEquals(f.calls.submit[0].endImageUrl, f.calls.submit[0].imageUrl);
  assertEquals(f.jobs[0].scene_image_url, f.calls.submit[0].imageUrl);
  assert(f.calls.submit[0].imageUrl.includes("/wellbeing-scenes/"));
  assertEquals(f.calls.scenes[0].element, "storm");
  assertEquals(f.calls.scenes[0].job.source_image_url, IMAGE);
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

Deno.test("missing habitat never submits a backgroundless paid video", async () => {
  const f = fixture(); await f.request();
  f.calls.internal = true; f.calls.sceneFailure = true;
  await f.request({});
  assertEquals(f.calls.submit.length, 0);
  assertEquals(f.jobs[0].status, "queued");
  f.calls.sceneFailure = false; await f.request({});
  assertEquals(f.calls.submit.length, 1);
  assert(f.calls.submit[0].imageUrl.includes("/wellbeing-scenes/"));
});

Deno.test("new scene version replaces the lookup for backgroundless clips without deleting them", async () => {
  const f = fixture(); await f.request();
  f.jobs[0].prompt_version = 1;
  f.jobs[0].status = "succeeded"; f.jobs[0].video_url = "old-backgroundless.mp4";
  const response = await (await f.request()).json();
  assertEquals(f.jobs.length, 2);
  assertEquals(f.jobs[0].video_url, "old-backgroundless.mp4");
  assertEquals(f.jobs[1].prompt_version, 3);
  assertEquals(response.clip.status, "queued");
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
