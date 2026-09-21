const args = new Map(
  Deno.args.map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=")];
  }),
);

const fixtureDirectory = args.get("--fixtures")?.trim();
const port = Number(args.get("--port") ?? 8787);
if (!fixtureDirectory || !Number.isFinite(port)) {
  throw new Error("--fixtures and a valid --port are required");
}

const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X2NDNwAAAABJRU5ErkJggg==";
const pngBytes = Uint8Array.from(
  atob(pngBase64),
  (character) => character.charCodeAt(0),
);

const requests = new Map<string, number>();
const metrics = {
  imageEdits: 0,
  imageJudges: 0,
  falSubmissions: 0,
  falStatusChecks: 0,
  falResults: 0,
  falCancellations: 0,
  videoDownloads: 0,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve({ hostname: "0.0.0.0", port }, async (request) => {
  const url = new URL(request.url);

  if (url.pathname === "/health") return json({ status: "ok" });
  if (url.pathname === "/reset" && request.method === "POST") {
    requests.clear();
    for (const key of Object.keys(metrics) as Array<keyof typeof metrics>) {
      metrics[key] = 0;
    }
    return json({ status: "reset" });
  }
  if (url.pathname === "/metrics") {
    return json({ ...metrics, trackedRequests: requests.size });
  }
  if (url.pathname === "/image.png") {
    return new Response(pngBytes, { headers: { "Content-Type": "image/png" } });
  }
  if (url.pathname.startsWith("/video/") && url.pathname.endsWith(".mp4")) {
    const duration = Number(
      url.pathname.split("/").at(-1)?.replace(".mp4", ""),
    );
    const fixturePath = `${fixtureDirectory}/cinema-${duration}.mp4`;
    try {
      metrics.videoDownloads += 1;
      return new Response(await Deno.readFile(fixturePath), {
        headers: { "Content-Type": "video/mp4" },
      });
    } catch {
      return json({ error: "fixture_not_found", duration }, 404);
    }
  }

  if (url.pathname === "/openai/v1/images/edits" && request.method === "POST") {
    metrics.imageEdits += 1;
    return json({
      data: [{ b64_json: pngBase64, revised_prompt: "Cosmiq E2E portrait" }],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    });
  }
  if (
    url.pathname === "/openai/v1/chat/completions" &&
    request.method === "POST"
  ) {
    metrics.imageJudges += 1;
    return json({
      choices: [{
        message: {
          tool_calls: [{
            function: {
              arguments: JSON.stringify({
                continuity: 9,
                difference: 9,
                anatomy: 9,
                stageMaturity: 9,
                centering: 9,
                backgroundCutout: 9,
                overall: 9,
                subjectCenterX: 0.5,
                subjectCenterY: 0.5,
                notes: "Synthetic E2E candidate accepted.",
              }),
            },
          }],
        },
      }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });
  }

  if (url.pathname.startsWith("/fal/") && request.method === "POST") {
    const payload = await request.json().catch(() => ({})) as Record<
      string,
      unknown
    >;
    const duration = Math.max(3, Math.min(30, Number(payload.duration ?? 12)));
    const requestId = `mock-${crypto.randomUUID()}`;
    requests.set(requestId, duration);
    metrics.falSubmissions += 1;
    return json({ request_id: requestId });
  }

  const match = url.pathname.match(/\/requests\/([^/]+)(\/status|\/cancel)?$/);
  if (url.pathname.startsWith("/fal/") && match) {
    const requestId = decodeURIComponent(match[1]);
    const duration = requests.get(requestId);
    if (!duration) return json({ error: "request_not_found" }, 404);
    if (match[2] === "/cancel" && request.method === "PUT") {
      metrics.falCancellations += 1;
      return json({ status: "CANCELLED" });
    }
    if (match[2] === "/status") {
      metrics.falStatusChecks += 1;
      return json({ status: "COMPLETED" });
    }
    metrics.falResults += 1;
    return json({
      status: "COMPLETED",
      video: { url: `http://host.lima.internal:${port}/video/${duration}.mp4` },
    });
  }

  return json({ error: "not_found", path: url.pathname }, 404);
});
