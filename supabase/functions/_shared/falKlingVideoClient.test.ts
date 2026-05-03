import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCompanionAnimationPrompt,
  downloadFalVideo,
  getFalKlingQueueResult,
  getFalKlingQueueStatus,
  resolveFalKlingModelFromEnv,
  submitFalKlingVideo,
} from "./falKlingVideoClient.ts";

Deno.test("buildCompanionAnimationPrompt asks for a stable continuous reveal", () => {
  const prompt = buildCompanionAnimationPrompt({ element: "fire", stage: 13 });

  if (!prompt.includes("Preserve the companion identity")) {
    throw new Error("Expected prompt to preserve identity");
  }
  if (!prompt.includes("One continuous shot with no cuts")) {
    throw new Error("Expected prompt to avoid cuts");
  }
  if (!prompt.includes("warm ember motes")) {
    throw new Error("Expected element-specific motion language");
  }
});

Deno.test("submitFalKlingVideo posts the Kling image-to-video queue payload", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await submitFalKlingVideo({
    fetchFn: ((url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return Promise.resolve(
        new Response(JSON.stringify({
          request_id: "fal-request-1",
          status_url: "https://queue.fal.run/status",
          response_url: "https://queue.fal.run/result",
        })),
      );
    }) as typeof fetch,
    apiKey: "fal-key",
    model: "fal-ai/kling-video/v3/standard/image-to-video",
    imageUrl: "https://example.com/companion.png",
    prompt: "Animate carefully",
    durationSeconds: 5,
  });

  assertEquals(result.requestId, "fal-request-1");
  assertEquals(
    calls[0]?.url,
    "https://queue.fal.run/fal-ai/kling-video/v3/standard/image-to-video",
  );
  assertEquals(calls[0]?.init.method, "POST");
  assertEquals(
    (calls[0]?.init.headers as Record<string, string>).Authorization,
    "Key fal-key",
  );
  assertEquals(JSON.parse(String(calls[0]?.init.body)), {
    start_image_url: "https://example.com/companion.png",
    prompt: "Animate carefully",
    duration: "5",
    generate_audio: false,
    negative_prompt:
      "identity drift, distorted anatomy, extra limbs, extra heads, text, captions, logos, cuts, scene changes, jitter, blur, low quality",
  });
});

Deno.test("getFalKlingQueueStatus and result parse fal queue responses", async () => {
  const fetchFn = ((url: string | URL | Request) => {
    const stringUrl = String(url);
    if (stringUrl.endsWith("/status")) {
      return Promise.resolve(
        new Response(JSON.stringify({
          status: "COMPLETED",
          response_url: "https://queue.fal.run/result",
        })),
      );
    }

    return Promise.resolve(
      new Response(JSON.stringify({
        status: "COMPLETED",
        data: {
          video: {
            url: "https://example.com/result.mp4",
          },
        },
      })),
    );
  }) as typeof fetch;

  const status = await getFalKlingQueueStatus({
    fetchFn,
    apiKey: "fal-key",
    model: "fal-ai/kling-video/v3/standard/image-to-video",
    requestId: "request-1",
  });
  const result = await getFalKlingQueueResult({
    fetchFn,
    apiKey: "fal-key",
    model: "fal-ai/kling-video/v3/standard/image-to-video",
    requestId: "request-1",
  });

  assertEquals(status.status, "COMPLETED");
  assertEquals(result.videoUrl, "https://example.com/result.mp4");
});

Deno.test("downloadFalVideo rejects empty video payloads", async () => {
  await assertRejects(
    () =>
      downloadFalVideo({
        fetchFn: (() =>
          Promise.resolve(
            new Response(new Uint8Array(), {
              headers: { "Content-Type": "video/mp4" },
            }),
          )) as typeof fetch,
        videoUrl: "https://example.com/empty.mp4",
      }),
    Error,
    "Downloaded fal video was empty",
  );
});

Deno.test("resolveFalKlingModelFromEnv falls back to the standard v3 model", () => {
  assertEquals(
    resolveFalKlingModelFromEnv({ get: () => undefined }),
    "fal-ai/kling-video/v3/standard/image-to-video",
  );
  assertEquals(
    resolveFalKlingModelFromEnv({ get: () => " fal-ai/custom/model/ " }),
    "fal-ai/custom/model",
  );
});
