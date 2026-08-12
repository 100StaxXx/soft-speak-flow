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

  if (
    !prompt.includes("exact prior approved companion portrait") ||
    !prompt.includes("exact new companion portrait")
  ) {
    throw new Error("Expected prompt to lock both evolution endpoints");
  }
  if (!prompt.includes("One continuous shot with no cuts")) {
    throw new Error("Expected prompt to avoid cuts");
  }
  if (!prompt.includes("warm ember motes")) {
    throw new Error("Expected element-specific motion language");
  }
  if (!prompt.includes("COMPANION EVOLUTION TRANSITION ART BIBLE V4")) {
    throw new Error("Expected prompt to identify the animated art bible");
  }
  if (!prompt.includes("sole source of product identity")) {
    throw new Error("Expected shared prompts to derive product identity from the endpoints");
  }
  if (
    !prompt.includes("line weight") ||
    !prompt.includes("cel shading")
  ) {
    throw new Error(
      "Expected prompt to preserve the 2D anime/cel-shaded style",
    );
  }
  if (!prompt.includes("never introduce a realistic environment")) {
    throw new Error("Expected prompt to reject realistic animation backdrops");
  }
  if (
    !prompt.includes("Never convert the companion portrait or illustrated scene into photorealism")
  ) {
    throw new Error("Expected prompt to prohibit photorealistic style drift");
  }
});

Deno.test("buildCompanionAnimationPrompt locks hatch videos to egg and infant endpoints", () => {
  const prompt = buildCompanionAnimationPrompt({ element: "light", stage: 1 });

  if (
    !prompt.includes("exact companion egg") || !prompt.includes("opening frame")
  ) {
    throw new Error(
      "Expected the hatch prompt to lock the egg as the first frame",
    );
  }
  if (
    !prompt.includes("exact infant companion portrait") ||
    !prompt.includes("final frame")
  ) {
    throw new Error(
      "Expected the hatch prompt to lock the infant as the last frame",
    );
  }
  if (!prompt.includes("final video frame aligns cleanly")) {
    throw new Error(
      "Expected the hatch prompt to preserve the handoff to the stage-one portrait",
    );
  }
  if (!prompt.includes("COMPANION HATCH TRANSITION ART BIBLE V2")) {
    throw new Error("Expected a product-neutral hatch art bible");
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
    imageUrl: "https://example.com/egg.png",
    endImageUrl: "https://example.com/infant.png",
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
    start_image_url: "https://example.com/egg.png",
    end_image_url: "https://example.com/infant.png",
    prompt: "Animate carefully",
    duration: "5",
    generate_audio: false,
    negative_prompt:
      "photorealism, live action, realistic fur, realistic feathers, natural-history footage, CGI, 3D render, painterly realism, style drift, identity drift, distorted anatomy, extra limbs, extra heads, text, captions, logos, franchise resemblance, cuts, scene changes, jitter, blur, low quality",
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
