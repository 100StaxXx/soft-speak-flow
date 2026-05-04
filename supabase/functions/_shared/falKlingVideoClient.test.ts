function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.env.set("SUPABASE_FUNCTIONS_TEST", "1");
Deno.env.set("FAL_KEY", "test-fal-key");

const mod = await import("./falKlingVideoClient.ts");
const { __testables } = mod;

Deno.test("normalizeStatus collapses provider statuses", () => {
  assertEquals(__testables.normalizeStatus("IN_QUEUE"), "IN_QUEUE", "IN_QUEUE preserved");
  assertEquals(__testables.normalizeStatus("in_progress"), "IN_PROGRESS", "lowercase normalised");
  assertEquals(__testables.normalizeStatus("COMPLETED"), "COMPLETED", "COMPLETED preserved");
  assertEquals(__testables.normalizeStatus("ERROR"), "FAILED", "ERROR mapped to FAILED");
  assertEquals(__testables.normalizeStatus("CANCELLED"), "FAILED", "CANCELLED mapped to FAILED");
  assertEquals(__testables.normalizeStatus("unknown"), "IN_PROGRESS", "unknown defaults to IN_PROGRESS");
});

Deno.test("extractVideoUrl reads common payload shapes", () => {
  assertEquals(
    __testables.extractVideoUrl({ video: { url: "https://cdn.fal/x.mp4" } }),
    "https://cdn.fal/x.mp4",
    "Extracts video.url",
  );
  assertEquals(
    __testables.extractVideoUrl({ video_url: "https://cdn.fal/y.mp4" }),
    "https://cdn.fal/y.mp4",
    "Extracts top-level video_url",
  );
  assertEquals(
    __testables.extractVideoUrl({ videos: [{ url: "https://cdn.fal/z.mp4" }] }),
    "https://cdn.fal/z.mp4",
    "Extracts videos[0].url",
  );
  assertEquals(
    __testables.extractVideoUrl({ unrelated: true }),
    null,
    "Returns null when nothing matches",
  );
});

Deno.test("submitFalKlingVideo posts the expected payload and returns the request id", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  const fetchImpl: typeof fetch = (input, init) => {
    capturedUrl = typeof input === "string" ? input : (input as URL).toString();
    capturedInit = init;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          request_id: "req-123",
          status_url: "https://queue.fal.run/x/requests/req-123/status",
          response_url: "https://queue.fal.run/x/requests/req-123",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  };

  const result = await mod.submitFalKlingVideo({
    imageUrl: "https://example.com/page.png",
    fetchImpl,
  });

  assertEquals(result.requestId, "req-123", "Returns request id");
  assert(capturedUrl.endsWith(`${__testables.DEFAULT_MODEL}`), "POSTs to the default model URL");

  const headers = capturedInit?.headers as Record<string, string>;
  assertEquals(headers["Authorization"], "Key test-fal-key", "Sends Authorization: Key {FAL_KEY}");

  const body = JSON.parse(String(capturedInit?.body ?? "{}"));
  assertEquals(body.image_url, "https://example.com/page.png", "Forwards image_url");
  assertEquals(body.duration, "5", "Defaults duration to 5");
  assertEquals(body.generate_audio, false, "Audio disabled");
  assertEquals(body.prompt, __testables.DEFAULT_PROMPT, "Uses default prompt");
  assertEquals(body.negative_prompt, __testables.DEFAULT_NEGATIVE_PROMPT, "Uses default negative prompt");
});

Deno.test("submitFalKlingVideo throws when fal.ai returns non-2xx", async () => {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(new Response("rate limited", { status: 429 }));

  let caught: unknown = null;
  try {
    await mod.submitFalKlingVideo({ imageUrl: "https://x", fetchImpl });
  } catch (error) {
    caught = error;
  }
  assert(caught instanceof Error, "Throws on error response");
  assert(String(caught).includes("429"), "Surfaces upstream status code");
});

Deno.test("getFalKlingStatus returns normalised status", async () => {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(
      new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

  const status = await mod.getFalKlingStatus("req-1", { fetchImpl });
  assertEquals(status.status, "IN_PROGRESS", "Status normalised");
  assertEquals(status.rawStatus, "IN_PROGRESS", "Raw status preserved");
});

Deno.test("getFalKlingResult returns the parsed video URL", async () => {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify({
          video: { url: "https://cdn.fal/v/req-1.mp4", duration: 5 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

  const result = await mod.getFalKlingResult("req-1", { fetchImpl });
  assertEquals(result.videoUrl, "https://cdn.fal/v/req-1.mp4", "Returns the MP4 URL");
  assertEquals(result.durationSeconds, 5, "Returns duration when present");
});
