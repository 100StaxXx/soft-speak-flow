import {
  editCompanionImage,
  generateCompanionImage,
} from "./openaiCompanionImageClient.ts";

const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createImageResponse(content = "image-bytes", contentType = "image/png"): Response {
  return new Response(content, {
    status: 200,
    headers: {
      "Content-Type": contentType,
    },
  });
}

function restoreEnv(name: "OPENAI_COMPANION_IMAGE_MODEL" | "OPENAI_IMAGE_MODEL", value: string | undefined) {
  if (typeof value === "string") {
    Deno.env.set(name, value);
  } else {
    Deno.env.delete(name);
  }
}

function resolveInputUrl(input: string | URL | Request): string {
  if (typeof input === "string") {
    return input;
  }

  return input instanceof URL ? input.toString() : input.url;
}

function coerceRequestInit(
  init: globalThis.RequestInit | undefined,
): {
  body?: BodyInit | null;
  headers?: HeadersInit;
} {
  return (init ?? {}) as {
    body?: BodyInit | null;
    headers?: HeadersInit;
  };
}

Deno.test("generateCompanionImage downloads direct image URLs with guardedFetch", async () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.delete("OPENAI_COMPANION_IMAGE_MODEL");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    const calls: string[] = [];
    const guardedFetch: typeof fetch = async (input, init) => {
      const url = resolveInputUrl(input);
      calls.push(url);
      const requestInit = coerceRequestInit(init);

      if (url === OPENAI_IMAGE_GENERATIONS_URL) {
        const body = JSON.parse(String(requestInit.body ?? "{}")) as Record<string, unknown>;
        assert(body.model === "gpt-image-2", `Expected gpt-image-2 default model, got ${String(body.model)}`);
        assert(body.size === "1536x1024", `Expected requested size to be forwarded, got ${String(body.size)}`);
        return createJsonResponse({
          data: [
            {
              url: "https://cdn.example.com/generated.png",
              revised_prompt: "refined prompt",
            },
          ],
        });
      }

      if (url === "https://cdn.example.com/generated.png") {
        return createImageResponse("generated-image");
      }

      throw new Error(`Unexpected guardedFetch URL: ${url}`);
    };

    const result = await generateCompanionImage({
      guardedFetch,
      openAIApiKey: "test-key",
      prompt: "draw a companion",
      size: "1536x1024",
      quality: "high",
      userId: "user-1",
    });

    assert(calls.length === 2, `Expected 2 guardedFetch calls, got ${calls.length}`);
    assert(calls[0] === OPENAI_IMAGE_GENERATIONS_URL, `Expected generation call first, got ${calls[0]}`);
    assert(calls[1] === "https://cdn.example.com/generated.png", `Expected direct image download second, got ${calls[1]}`);
    assert(result.revisedPrompt === "refined prompt", `Expected revised prompt, got ${String(result.revisedPrompt)}`);
    assert(result.imageDataUrl.startsWith("data:image/png;base64,"), "Expected direct URL to be normalized to a PNG data URL");
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("generateCompanionImage falls back to square size and then drops quality after 400 responses", async () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.delete("OPENAI_COMPANION_IMAGE_MODEL");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    const seenRequests: Array<{ size: string | null; quality: string | null }> = [];
    const guardedFetch: typeof fetch = async (input, init) => {
      const url = resolveInputUrl(input);
      const requestInit = coerceRequestInit(init);

      if (url !== OPENAI_IMAGE_GENERATIONS_URL) {
        throw new Error(`Unexpected guardedFetch URL: ${url}`);
      }

      const body = JSON.parse(String(requestInit.body ?? "{}")) as Record<string, unknown>;
      seenRequests.push({
        size: typeof body.size === "string" ? body.size : null,
        quality: typeof body.quality === "string" ? body.quality : null,
      });

      if (seenRequests.length < 3) {
        return new Response(JSON.stringify({ error: "unsupported option" }), { status: 400 });
      }

      return createJsonResponse({
        data: [
          {
            b64_json: btoa("fallback-image"),
          },
        ],
      });
    };

    const result = await generateCompanionImage({
      guardedFetch,
      openAIApiKey: "test-key",
      prompt: "draw a fallback companion",
      size: "1536x1024",
      quality: "high",
      userId: "user-1",
    });

    assert(seenRequests.length === 3, `Expected 3 generation attempts, got ${seenRequests.length}`);
    assert(seenRequests[0]?.size === "1536x1024", `Expected first attempt to keep requested size, got ${String(seenRequests[0]?.size)}`);
    assert(seenRequests[0]?.quality === "high", `Expected first attempt quality high, got ${String(seenRequests[0]?.quality)}`);
    assert(seenRequests[1]?.size === "1024x1024", `Expected second attempt to fall back to square size, got ${String(seenRequests[1]?.size)}`);
    assert(seenRequests[1]?.quality === "high", `Expected second attempt to keep quality, got ${String(seenRequests[1]?.quality)}`);
    assert(seenRequests[2]?.size === "1024x1024", `Expected third attempt to keep square size, got ${String(seenRequests[2]?.size)}`);
    assert(seenRequests[2]?.quality === null, `Expected third attempt to drop quality, got ${String(seenRequests[2]?.quality)}`);
    assert(result.size === "1024x1024", `Expected returned size to reflect fallback, got ${result.size}`);
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("editCompanionImage sends multipart image uploads without input_fidelity for gpt-image-2", async () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.delete("OPENAI_COMPANION_IMAGE_MODEL");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    const guardedFetch: typeof fetch = async (input, init) => {
      const url = resolveInputUrl(input);
      const requestInit = coerceRequestInit(init);

      if (url === "https://example.com/reference-a.png") {
        return createImageResponse("reference-a");
      }

      if (url === "https://example.com/reference-b.jpg") {
        return createImageResponse("reference-b", "image/jpeg");
      }

      if (url === OPENAI_IMAGE_EDITS_URL) {
        const headers = requestInit.headers;
        const contentType = headers instanceof Headers
          ? headers.get("Content-Type")
          : headers && typeof headers === "object" && "Content-Type" in headers
          ? String((headers as Record<string, unknown>)["Content-Type"] ?? "")
          : "";
        assert(!contentType, "Multipart edit request should not set Content-Type manually");

        const formData = requestInit.body;
        assert(formData instanceof FormData, "Expected edit body to be FormData");
        assert(formData.get("model") === "gpt-image-2", `Expected gpt-image-2 model, got ${String(formData.get("model"))}`);
        assert(formData.get("prompt") === "evolve the companion", "Expected prompt to be present in multipart body");
        assert(formData.get("size") === "1536x1024", `Expected size in multipart body, got ${String(formData.get("size"))}`);
        assert(formData.get("quality") === "high", `Expected quality in multipart body, got ${String(formData.get("quality"))}`);
        assert(formData.get("user") === "user-1", `Expected user tag in multipart body, got ${String(formData.get("user"))}`);
        assert(formData.get("input_fidelity") === null, `Did not expect input_fidelity for gpt-image-2, got ${String(formData.get("input_fidelity"))}`);

        const images = formData.getAll("image[]");
        assert(images.length === 2, `Expected 2 uploaded reference images, got ${images.length}`);
        assert(images[0] instanceof File, "Expected first reference image to be a File");
        assert(images[1] instanceof File, "Expected second reference image to be a File");
        assert((images[0] as File).name === "reference-a.png", `Expected first file name to preserve URL extension, got ${(images[0] as File).name}`);
        assert((images[1] as File).name === "reference-b.jpg", `Expected second file name to preserve URL extension, got ${(images[1] as File).name}`);

        return createJsonResponse({
          data: [
            {
              b64_json: btoa("edited-image"),
              revised_prompt: "evolved prompt",
            },
          ],
        });
      }

      throw new Error(`Unexpected guardedFetch URL: ${url}`);
    };

    const result = await editCompanionImage({
      guardedFetch,
      openAIApiKey: "test-key",
      prompt: "evolve the companion",
      size: "1536x1024",
      quality: "high",
      userId: "user-1",
      referenceImages: [
        { imageUrl: "https://example.com/reference-a.png" },
        { imageUrl: "https://example.com/reference-b.jpg" },
      ],
    });

    assert(result.revisedPrompt === "evolved prompt", `Expected revised prompt, got ${String(result.revisedPrompt)}`);
    assert(result.imageDataUrl.startsWith("data:image/png;base64,"), "Expected multipart edit result to return a data URL");
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("editCompanionImage retries without input_fidelity when the provider rejects it", async () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.set("OPENAI_COMPANION_IMAGE_MODEL", "gpt-image-1.5");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    let editCalls = 0;
    const guardedFetch: typeof fetch = async (input, init) => {
      const url = resolveInputUrl(input);
      const requestInit = coerceRequestInit(init);

      if (url === "https://example.com/reference.png") {
        return createImageResponse("reference-image");
      }

      if (url === OPENAI_IMAGE_EDITS_URL) {
        editCalls += 1;
        const formData = requestInit.body;
        assert(formData instanceof FormData, "Expected FormData body for input_fidelity retry test");

        if (editCalls === 1) {
          assert(formData.get("model") === "gpt-image-1.5", `Expected overridden model, got ${String(formData.get("model"))}`);
          assert(formData.get("input_fidelity") === "high", `Expected first edit attempt input_fidelity high, got ${String(formData.get("input_fidelity"))}`);
          return new Response(JSON.stringify({ error: "Unsupported parameter: input_fidelity" }), { status: 400 });
        }

        assert(formData.get("input_fidelity") === null, `Expected retry to omit input_fidelity, got ${String(formData.get("input_fidelity"))}`);
        return createJsonResponse({
          data: [
            {
              b64_json: btoa("edited-image"),
            },
          ],
        });
      }

      throw new Error(`Unexpected guardedFetch URL: ${url}`);
    };

    const result = await editCompanionImage({
      guardedFetch,
      openAIApiKey: "test-key",
      prompt: "retry without fidelity",
      size: "1024x1024",
      quality: "high",
      userId: "user-1",
      referenceImages: [{ imageUrl: "https://example.com/reference.png" }],
    });

    assert(editCalls === 2, `Expected 2 edit calls, got ${editCalls}`);
    assert(result.imageDataUrl.startsWith("data:image/png;base64,"), "Expected retry result to return a data URL");
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("editCompanionImage can fall back size before retrying without input_fidelity", async () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.set("OPENAI_COMPANION_IMAGE_MODEL", "gpt-image-1.5");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    const seenRequests: Array<{ size: string | null; inputFidelity: string | null }> = [];
    const guardedFetch: typeof fetch = async (input, init) => {
      const url = resolveInputUrl(input);
      const requestInit = coerceRequestInit(init);

      if (url === "https://example.com/reference.png") {
        return createImageResponse("reference-image");
      }

      if (url === OPENAI_IMAGE_EDITS_URL) {
        const formData = requestInit.body;
        assert(formData instanceof FormData, "Expected FormData body for size and input_fidelity fallback test");
        seenRequests.push({
          size: typeof formData.get("size") === "string" ? String(formData.get("size")) : null,
          inputFidelity: typeof formData.get("input_fidelity") === "string" ? String(formData.get("input_fidelity")) : null,
        });

        if (seenRequests.length === 1) {
          return new Response(JSON.stringify({ error: "unsupported size" }), { status: 400 });
        }

        if (seenRequests.length === 2) {
          return new Response(JSON.stringify({ error: "Unsupported parameter: input_fidelity" }), { status: 400 });
        }

        return createJsonResponse({
          data: [
            {
              b64_json: btoa("edited-image"),
            },
          ],
        });
      }

      throw new Error(`Unexpected guardedFetch URL: ${url}`);
    };

    const result = await editCompanionImage({
      guardedFetch,
      openAIApiKey: "test-key",
      prompt: "fallback size and fidelity",
      size: "1536x1024",
      quality: "high",
      userId: "user-1",
      referenceImages: [{ imageUrl: "https://example.com/reference.png" }],
    });

    assert(seenRequests.length === 3, `Expected 3 edit calls, got ${seenRequests.length}`);
    assert(seenRequests[0]?.size === "1536x1024", `Expected first attempt requested size, got ${String(seenRequests[0]?.size)}`);
    assert(seenRequests[0]?.inputFidelity === "high", `Expected first attempt input_fidelity high, got ${String(seenRequests[0]?.inputFidelity)}`);
    assert(seenRequests[1]?.size === "1024x1024", `Expected second attempt square fallback, got ${String(seenRequests[1]?.size)}`);
    assert(seenRequests[1]?.inputFidelity === "high", `Expected second attempt input_fidelity high, got ${String(seenRequests[1]?.inputFidelity)}`);
    assert(seenRequests[2]?.size === "1024x1024", `Expected third attempt square fallback, got ${String(seenRequests[2]?.size)}`);
    assert(seenRequests[2]?.inputFidelity === null, `Expected third attempt to omit input_fidelity, got ${String(seenRequests[2]?.inputFidelity)}`);
    assert(result.size === "1024x1024", `Expected returned edit size to reflect fallback, got ${result.size}`);
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("editCompanionImage falls back to square size and then drops quality after 400 responses", async () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.delete("OPENAI_COMPANION_IMAGE_MODEL");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    const seenRequests: Array<{ size: string | null; quality: string | null; inputFidelity: string | null }> = [];
    const guardedFetch: typeof fetch = async (input, init) => {
      const url = resolveInputUrl(input);
      const requestInit = coerceRequestInit(init);

      if (url === "https://example.com/reference.png") {
        return createImageResponse("reference-image");
      }

      if (url !== OPENAI_IMAGE_EDITS_URL) {
        throw new Error(`Unexpected guardedFetch URL: ${url}`);
      }

      const formData = requestInit.body;
      assert(formData instanceof FormData, "Expected FormData body for edit fallback test");
      seenRequests.push({
        size: typeof formData.get("size") === "string" ? String(formData.get("size")) : null,
        quality: typeof formData.get("quality") === "string" ? String(formData.get("quality")) : null,
        inputFidelity: typeof formData.get("input_fidelity") === "string" ? String(formData.get("input_fidelity")) : null,
      });

      if (seenRequests.length < 3) {
        return new Response(JSON.stringify({ error: "unsupported option" }), { status: 400 });
      }

      return createJsonResponse({
        data: [
          {
            b64_json: btoa("fallback-edit-image"),
          },
        ],
      });
    };

    const result = await editCompanionImage({
      guardedFetch,
      openAIApiKey: "test-key",
      prompt: "evolve with fallbacks",
      size: "1536x1024",
      quality: "high",
      userId: "user-1",
      referenceImages: [{ imageUrl: "https://example.com/reference.png" }],
    });

    assert(seenRequests.length === 3, `Expected 3 edit attempts, got ${seenRequests.length}`);
    assert(seenRequests[0]?.size === "1536x1024", `Expected first edit attempt to keep requested size, got ${String(seenRequests[0]?.size)}`);
    assert(seenRequests[0]?.quality === "high", `Expected first edit attempt quality high, got ${String(seenRequests[0]?.quality)}`);
    assert(seenRequests[0]?.inputFidelity === null, `Did not expect first edit attempt input_fidelity for gpt-image-2, got ${String(seenRequests[0]?.inputFidelity)}`);
    assert(seenRequests[1]?.size === "1024x1024", `Expected second edit attempt to fall back to square size, got ${String(seenRequests[1]?.size)}`);
    assert(seenRequests[1]?.quality === "high", `Expected second edit attempt to keep quality, got ${String(seenRequests[1]?.quality)}`);
    assert(seenRequests[2]?.size === "1024x1024", `Expected third edit attempt to keep square size, got ${String(seenRequests[2]?.size)}`);
    assert(seenRequests[2]?.quality === null, `Expected third edit attempt to drop quality, got ${String(seenRequests[2]?.quality)}`);
    assert(seenRequests[2]?.inputFidelity === null, `Did not expect third edit attempt input_fidelity for gpt-image-2, got ${String(seenRequests[2]?.inputFidelity)}`);
    assert(result.size === "1024x1024", `Expected returned edit size to reflect fallback, got ${result.size}`);
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});

Deno.test("editCompanionImage omits input_fidelity for gpt-image-1-mini overrides", async () => {
  const originalCompanionImageModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const originalImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");

  try {
    Deno.env.set("OPENAI_COMPANION_IMAGE_MODEL", "gpt-image-1-mini");
    Deno.env.delete("OPENAI_IMAGE_MODEL");

    const guardedFetch: typeof fetch = async (input, init) => {
      const url = resolveInputUrl(input);
      const requestInit = coerceRequestInit(init);

      if (url === "https://example.com/reference.png") {
        return createImageResponse("reference-image");
      }

      if (url === OPENAI_IMAGE_EDITS_URL) {
        const formData = requestInit.body;
        assert(formData instanceof FormData, "Expected FormData body for image edits");
        assert(formData.get("model") === "gpt-image-1-mini", `Expected overridden model, got ${String(formData.get("model"))}`);
        assert(formData.get("input_fidelity") === null, `Did not expect input_fidelity for gpt-image-1-mini, got ${String(formData.get("input_fidelity"))}`);

        return createJsonResponse({
          data: [
            {
              b64_json: btoa("edited-image"),
            },
          ],
        });
      }

      throw new Error(`Unexpected guardedFetch URL: ${url}`);
    };

    await editCompanionImage({
      guardedFetch,
      openAIApiKey: "test-key",
      prompt: "evolve the companion",
      size: "1024x1024",
      quality: "medium",
      userId: "user-2",
      referenceImages: [{ imageUrl: "https://example.com/reference.png" }],
    });
  } finally {
    restoreEnv("OPENAI_COMPANION_IMAGE_MODEL", originalCompanionImageModel ?? undefined);
    restoreEnv("OPENAI_IMAGE_MODEL", originalImageModel ?? undefined);
  }
});
