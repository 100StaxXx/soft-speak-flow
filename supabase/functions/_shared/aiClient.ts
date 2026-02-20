const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";

const DEFAULT_IMAGE_SIZE = "1536x1024";
export const ALLOWED_IMAGE_SIZES = ["1024x1024", "1536x1024"] as const;
export type SupportedImageSize = (typeof ALLOWED_IMAGE_SIZES)[number];

function getEnv(name: string): string | undefined {
  const maybeDeno = (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } }).Deno;
  return maybeDeno?.env?.get?.(name);
}

const DEFAULT_TEXT_MODEL = getEnv("OPENAI_TEXT_MODEL") ?? "gpt-4o-mini";
const DEFAULT_IMAGE_MODEL = getEnv("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";

let shimInstalled = false;

function mapModel(model: unknown, wantsImage: boolean): string {
  const raw = typeof model === "string" ? model : "";
  const lower = raw.toLowerCase();

  if (wantsImage) {
    return DEFAULT_IMAGE_MODEL;
  }

  if (!raw) {
    return DEFAULT_TEXT_MODEL;
  }

  if (lower.startsWith("google/") || lower.startsWith("gemini")) {
    return DEFAULT_TEXT_MODEL;
  }

  return raw;
}

function extractTextPrompt(messages: unknown): string {
  if (!Array.isArray(messages)) {
    return "Generate an image from the provided description.";
  }

  const parts: string[] = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }

    const role = (message as { role?: unknown }).role;
    if (role !== "user") {
      continue;
    }

    const content = (message as { content?: unknown }).content;

    if (typeof content === "string" && content.trim()) {
      parts.push(content.trim());
      continue;
    }

    if (!Array.isArray(content)) {
      continue;
    }

    for (const item of content) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const type = (item as { type?: unknown }).type;
      if (type === "text") {
        const text = (item as { text?: unknown }).text;
        if (typeof text === "string" && text.trim()) {
          parts.push(text.trim());
        }
      }
    }
  }

  if (parts.length === 0) {
    return "Generate an image from the provided description.";
  }

  return parts.join("\n\n");
}

function extractReferenceImageUrls(messages: unknown): string[] {
  if (!Array.isArray(messages)) {
    return [];
  }

  const urls: string[] = [];

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      continue;
    }

    const content = (message as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const item of content) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const type = (item as { type?: unknown }).type;
      if (type !== "image_url") {
        continue;
      }

      const imageUrl = (item as { image_url?: unknown }).image_url;
      if (typeof imageUrl === "string" && imageUrl.trim()) {
        urls.push(imageUrl.trim());
        continue;
      }

      if (imageUrl && typeof imageUrl === "object") {
        const url = (imageUrl as { url?: unknown }).url;
        if (typeof url === "string" && url.trim()) {
          urls.push(url.trim());
        }
      }
    }
  }

  return urls;
}

function shouldGenerateImage(body: Record<string, unknown>): boolean {
  const modalities = body.modalities;
  const hasImageModality =
    Array.isArray(modalities) &&
    modalities.some((modality) => typeof modality === "string" && modality.toLowerCase() === "image");

  if (hasImageModality) {
    return true;
  }

  const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
  if (hasTools) {
    return false;
  }

  const model = typeof body.model === "string" ? body.model.toLowerCase() : "";
  return model.includes("image");
}

export function resolveImageSize(candidate: unknown, fallback: SupportedImageSize): SupportedImageSize;
export function resolveImageSize(candidate: unknown, fallback: null): SupportedImageSize | null;
export function resolveImageSize(
  candidate: unknown,
  fallback: SupportedImageSize | null = DEFAULT_IMAGE_SIZE,
): SupportedImageSize | null {
  if (typeof candidate === "string") {
    const normalized = candidate.trim();
    if ((ALLOWED_IMAGE_SIZES as readonly string[]).includes(normalized)) {
      return normalized as SupportedImageSize;
    }
  }
  return fallback;
}

async function handleImageRequest(
  originalFetch: typeof fetch,
  headers: Headers,
  body: Record<string, unknown>,
): Promise<Response> {
  const prompt = extractTextPrompt(body.messages);
  const referenceUrls = extractReferenceImageUrls(body.messages);

  const referenceHint =
    referenceUrls.length > 0
      ? `\n\nReference image URLs (preserve key subject identity and traits):\n${referenceUrls
          .map((url) => `- ${url}`)
          .join("\n")}`
      : "";

  const imageRequest = {
    model: mapModel(body.model, true),
    prompt: `${prompt}${referenceHint}`,
    size: resolveImageSize(body.image_size, DEFAULT_IMAGE_SIZE),
  };

  const response = await originalFetch(OPENAI_IMAGE_GENERATIONS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(imageRequest),
  });

  if (!response.ok) {
    return response;
  }

  const data = await response.json();
  const first = Array.isArray(data?.data) ? data.data[0] : undefined;
  const b64 = typeof first?.b64_json === "string" ? first.b64_json : "";
  const directUrl = typeof first?.url === "string" ? first.url : "";
  const imageUrl = b64 ? `data:image/png;base64,${b64}` : directUrl;

  if (!imageUrl) {
    return new Response(
      JSON.stringify({
        error: "OpenAI image generation returned no image payload",
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const compatibilityPayload = {
    choices: [
      {
        message: {
          role: "assistant",
          content: "",
          images: [
            {
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      },
    ],
  };

  return new Response(JSON.stringify(compatibilityPayload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeChatBody(body: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    ...body,
    model: mapModel(body.model, false),
  };

  delete normalized.modalities;
  return normalized;
}

export function installOpenAICompatibilityShim(): void {
  if (shimInstalled) {
    return;
  }

  shimInstalled = true;
  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url !== OPENAI_CHAT_COMPLETIONS_URL) {
      return originalFetch(input, init);
    }

    if ((init?.method ?? "GET").toUpperCase() !== "POST") {
      return originalFetch(input, init);
    }

    if (typeof init?.body !== "string") {
      return originalFetch(input, init);
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(init.body);
    } catch {
      return originalFetch(input, init);
    }

    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");

    if (shouldGenerateImage(parsedBody)) {
      return handleImageRequest(originalFetch, headers, parsedBody);
    }

    const normalizedBody = normalizeChatBody(parsedBody);

    return originalFetch(OPENAI_CHAT_COMPLETIONS_URL, {
      ...init,
      headers,
      body: JSON.stringify(normalizedBody),
    });
  };
}
