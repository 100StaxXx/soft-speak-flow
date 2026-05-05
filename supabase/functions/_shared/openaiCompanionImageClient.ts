const OPENAI_IMAGE_GENERATIONS_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";
// Provider fallback can change aspect ratio; callers persist the returned size and render without stretching.
const FALLBACK_IMAGE_SIZE = "1024x1024";
const REFERENCE_IMAGE_MAX_DOWNLOAD_ATTEMPTS = 2;
const DEFAULT_REFERENCE_IMAGE_RETRY_BACKOFF_MS = 500;

let resolvedModelLogged = false;

export interface CompanionImageGenerationResult {
  imageDataUrl: string;
  revisedPrompt: string | null;
  size: string;
}

export class OpenAIImageRequestError extends Error {
  status: number;
  responseText: string;

  constructor(status: number, responseText: string) {
    super(`OpenAI image request failed (${status}): ${responseText}`);
    this.name = "OpenAIImageRequestError";
    this.status = status;
    this.responseText = responseText;
  }
}

interface BaseImageRequestArgs {
  guardedFetch: typeof fetch;
  openAIApiKey: string;
  prompt: string;
  size: string;
  quality?: "medium" | "high";
  userId?: string | null;
}

interface EditCompanionImageArgs extends BaseImageRequestArgs {
  referenceImages: Array<{ imageUrl: string }>;
}

const getReferenceImageRetryBackoffMs = (): number => {
  const raw = Deno.env.get("COMPANION_IMAGE_REFERENCE_RETRY_BACKOFF_MS");
  if (!raw) return DEFAULT_REFERENCE_IMAGE_RETRY_BACKOFF_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_REFERENCE_IMAGE_RETRY_BACKOFF_MS;
};

const isProductionRuntime = (): boolean => {
  const environment = (
    Deno.env.get("APP_ENV")
    ?? Deno.env.get("NODE_ENV")
    ?? Deno.env.get("ENVIRONMENT")
    ?? ""
  ).trim().toLowerCase();
  return environment === "production" || environment === "prod" || Boolean(Deno.env.get("DENO_DEPLOYMENT_ID"));
};

export const resolveCompanionImageModel = (): string => {
  const companionModel = Deno.env.get("OPENAI_COMPANION_IMAGE_MODEL");
  const defaultImageModel = Deno.env.get("OPENAI_IMAGE_MODEL");
  const resolved = companionModel ?? defaultImageModel ?? "gpt-image-2";
  const source = companionModel
    ? "OPENAI_COMPANION_IMAGE_MODEL"
    : defaultImageModel
    ? "OPENAI_IMAGE_MODEL"
    : "fallback";

  if (!companionModel && !defaultImageModel && isProductionRuntime()) {
    throw new Error("Companion image model is not configured in production");
  }

  if (!resolvedModelLogged) {
    resolvedModelLogged = true;
    console.log(`[CompanionImageModel] model=${resolved} source=${source}`);
  }

  return resolved;
};

const buildHeaders = (openAIApiKey: string) => ({
  Authorization: `Bearer ${openAIApiKey}`,
  "Content-Type": "application/json",
});

const buildMultipartHeaders = (openAIApiKey: string) => ({
  Authorization: `Bearer ${openAIApiKey}`,
});

const supportsInputFidelityOverride = (model: string): boolean => {
  const normalizedModel = model.toLowerCase();
  return !(
    normalizedModel === "gpt-image-2"
    || normalizedModel.startsWith("gpt-image-2-")
    || normalizedModel === "gpt-image-1-mini"
    || normalizedModel.startsWith("gpt-image-1-mini-")
  );
};

const buildBaseRequestBody = ({
  prompt,
  size,
  quality,
  userId,
}: Omit<BaseImageRequestArgs, "guardedFetch" | "openAIApiKey">): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    model: resolveCompanionImageModel(),
    prompt,
    size,
  };

  if (quality) {
    body.quality = quality;
  }

  if (typeof userId === "string" && userId.trim().length > 0) {
    body.user = userId.trim();
  }

  return body;
};

const normalizeToDataUrl = async (
  guardedFetch: typeof fetch,
  payload: Record<string, unknown>,
): Promise<{ imageDataUrl: string; revisedPrompt: string | null }> => {
  const firstResult = Array.isArray(payload.data) ? payload.data[0] as Record<string, unknown> | undefined : undefined;
  const revisedPrompt = typeof firstResult?.revised_prompt === "string" ? firstResult.revised_prompt : null;
  const base64Image = typeof firstResult?.b64_json === "string" ? firstResult.b64_json : null;
  if (base64Image) {
    return {
      imageDataUrl: `data:image/png;base64,${base64Image}`,
      revisedPrompt,
    };
  }

  const directUrl = typeof firstResult?.url === "string" ? firstResult.url : null;
  if (!directUrl) {
    throw new Error("OpenAI image response did not include an image payload");
  }

  const imageResponse = await guardedFetch(directUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }

  const buffer = new Uint8Array(await imageResponse.arrayBuffer());
  let binary = "";
  buffer.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return {
    imageDataUrl: `data:image/png;base64,${btoa(binary)}`,
    revisedPrompt,
  };
};

const parseImageApiResponse = async (
  guardedFetch: typeof fetch,
  response: Response,
): Promise<{ imageDataUrl: string; revisedPrompt: string | null }> => {
  if (!response.ok) {
    throw new OpenAIImageRequestError(response.status, await response.text());
  }

  const payload = await response.json() as Record<string, unknown>;
  return await normalizeToDataUrl(guardedFetch, payload);
};

const performImageRequest = async ({
  guardedFetch,
  openAIApiKey,
  endpoint,
  body,
  fallbackToSquare = true,
}: {
  guardedFetch: typeof fetch;
  openAIApiKey: string;
  endpoint: string;
  body: Record<string, unknown>;
  fallbackToSquare?: boolean;
}): Promise<CompanionImageGenerationResult> => {
  const requestedSize = typeof body.size === "string" ? body.size : FALLBACK_IMAGE_SIZE;

  const requestImage = async (requestBody: Record<string, unknown>) =>
    await guardedFetch(endpoint, {
      method: "POST",
      headers: buildHeaders(openAIApiKey),
      body: JSON.stringify(requestBody),
    });

  let effectiveBody = { ...body };
  let response = await requestImage(effectiveBody);
  if (!response.ok && response.status === 400 && fallbackToSquare && requestedSize !== FALLBACK_IMAGE_SIZE) {
    effectiveBody = {
      ...effectiveBody,
      size: FALLBACK_IMAGE_SIZE,
    };
    response = await requestImage(effectiveBody);
  }

  if (!response.ok && response.status === 400 && "quality" in effectiveBody) {
    const { quality: _ignoredQuality, ...bodyWithoutQuality } = effectiveBody;
    effectiveBody = bodyWithoutQuality;
    response = await requestImage(effectiveBody);
  }

  const result = await parseImageApiResponse(guardedFetch, response);
  return {
    ...result,
    size: typeof effectiveBody.size === "string" ? effectiveBody.size : FALLBACK_IMAGE_SIZE,
  };
};

const inferFilenameFromUrl = (imageUrl: string, index: number, contentType: string): string => {
  try {
    const url = new URL(imageUrl);
    const pathname = url.pathname.split("/").filter(Boolean).pop();
    if (pathname && pathname.includes(".")) {
      return pathname;
    }
  } catch {
    // fall through to content-type based filename
  }

  const extension = contentType.includes("webp")
    ? "webp"
    : contentType.includes("jpeg") || contentType.includes("jpg")
    ? "jpg"
    : "png";

  return `reference-${index + 1}.${extension}`;
};

const downloadReferenceImageFile = async ({
  guardedFetch,
  imageUrl,
  index,
}: {
  guardedFetch: typeof fetch;
  imageUrl: string;
  index: number;
}): Promise<File> => {
  let lastStatus: number | null = null;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= REFERENCE_IMAGE_MAX_DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await guardedFetch(imageUrl);
      lastStatus = response.status;
      if (!response.ok) {
        const retryableStatus = response.status === 408 || response.status >= 500;
        if (retryableStatus && attempt < REFERENCE_IMAGE_MAX_DOWNLOAD_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, getReferenceImageRetryBackoffMs()));
          continue;
        }
        throw new Error(`Failed to download reference image: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get("content-type") || "image/png";
      return new File(
        [buffer],
        inferFilenameFromUrl(imageUrl, index, contentType),
        { type: contentType },
      );
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message.startsWith("Failed to download reference image:")) {
        throw error;
      }
      if (attempt >= REFERENCE_IMAGE_MAX_DOWNLOAD_ATTEMPTS) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, getReferenceImageRetryBackoffMs()));
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error(`Failed to download reference image: ${lastStatus ?? "unknown_status"}`);
};

const buildEditFormData = ({
  model,
  prompt,
  size,
  quality,
  userId,
  referenceFiles,
  includeInputFidelity,
}: {
  model: string;
  prompt: string;
  size: string;
  quality?: "medium" | "high";
  userId?: string | null;
  referenceFiles: File[];
  includeInputFidelity: boolean;
}): FormData => {
  const formData = new FormData();
  formData.append("model", model);
  formData.append("prompt", prompt);
  formData.append("size", size);

  if (quality) {
    formData.append("quality", quality);
  }

  if (includeInputFidelity) {
    formData.append("input_fidelity", "high");
  }

  if (typeof userId === "string" && userId.trim().length > 0) {
    formData.append("user", userId.trim());
  }

  referenceFiles.forEach((file) => {
    formData.append("image[]", file, file.name);
  });

  return formData;
};

const performMultipartEditRequest = async ({
  guardedFetch,
  openAIApiKey,
  prompt,
  size,
  quality,
  userId,
  referenceImages,
}: {
  guardedFetch: typeof fetch;
  openAIApiKey: string;
  prompt: string;
  size: string;
  quality?: "medium" | "high";
  userId?: string | null;
  referenceImages: Array<{ imageUrl: string }>;
}): Promise<CompanionImageGenerationResult> => {
  const model = resolveCompanionImageModel();
  let includeInputFidelity = supportsInputFidelityOverride(model);
  const referenceFiles = await Promise.all(
    referenceImages.map((referenceImage, index) =>
      downloadReferenceImageFile({
        guardedFetch,
        imageUrl: referenceImage.imageUrl,
        index,
      })),
  );

  const requestImage = async (formData: FormData) =>
    await guardedFetch(OPENAI_IMAGE_EDITS_URL, {
      method: "POST",
      headers: buildMultipartHeaders(openAIApiKey),
      body: formData,
    });

  let effectiveSize = size;
  let includeQuality = quality;

  const requestCurrentImageEdit = async () =>
    await requestImage(
      buildEditFormData({
        model,
        prompt,
        size: effectiveSize,
        quality: includeQuality,
        userId,
        referenceFiles,
        includeInputFidelity,
      }),
    );

  const retryWithoutInputFidelityIfRejected = async (currentResponse: Response): Promise<Response> => {
    if (!currentResponse.ok && currentResponse.status === 400 && includeInputFidelity) {
      const errorText = await currentResponse.clone().text().catch(() => "");
      const normalizedErrorText = errorText.toLowerCase();
      if (
        normalizedErrorText.includes("input_fidelity")
        || normalizedErrorText.includes("input fidelity")
        || normalizedErrorText.includes("inputfidelity")
      ) {
        includeInputFidelity = false;
        return await requestCurrentImageEdit();
      }
    }

    return currentResponse;
  };

  let response = await retryWithoutInputFidelityIfRejected(await requestCurrentImageEdit());

  if (!response.ok && response.status === 400 && effectiveSize !== FALLBACK_IMAGE_SIZE) {
    effectiveSize = FALLBACK_IMAGE_SIZE;
    response = await retryWithoutInputFidelityIfRejected(await requestCurrentImageEdit());
  }

  if (!response.ok && response.status === 400 && includeQuality) {
    includeQuality = undefined;
    response = await retryWithoutInputFidelityIfRejected(await requestCurrentImageEdit());
  }

  const result = await parseImageApiResponse(guardedFetch, response);
  return {
    ...result,
    size: effectiveSize,
  };
};

export const generateCompanionImage = async ({
  guardedFetch,
  openAIApiKey,
  prompt,
  size,
  quality = "high",
  userId,
}: BaseImageRequestArgs): Promise<CompanionImageGenerationResult> =>
  await performImageRequest({
    guardedFetch,
    openAIApiKey,
    endpoint: OPENAI_IMAGE_GENERATIONS_URL,
    body: buildBaseRequestBody({
      prompt,
      size,
      quality,
      userId,
    }),
  });

export const editCompanionImage = async ({
  guardedFetch,
  openAIApiKey,
  prompt,
  size,
  quality = "high",
  userId,
  referenceImages,
}: EditCompanionImageArgs): Promise<CompanionImageGenerationResult> => {
  if (!Array.isArray(referenceImages) || referenceImages.length === 0) {
    throw new Error("Companion image edits require at least one reference image");
  }

  return await performMultipartEditRequest({
    guardedFetch,
    openAIApiKey,
    prompt,
    size,
    quality,
    userId,
    referenceImages,
  });
};
