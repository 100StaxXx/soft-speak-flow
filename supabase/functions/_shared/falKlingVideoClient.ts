export const DEFAULT_FAL_KLING_MODEL =
  "fal-ai/kling-video/v3/standard/image-to-video";
export const DEFAULT_COMPANION_ANIMATION_DURATION_SECONDS = 5;
export const COMPANION_ANIMATION_VIDEO_BUCKET = "companion-animation-videos";
export const COMPANION_ANIMATION_PROVIDER = "fal";

export interface SubmitFalKlingVideoParams {
  fetchFn: typeof fetch;
  apiKey: string;
  model: string;
  imageUrl: string;
  endImageUrl?: string | null;
  prompt: string;
  durationSeconds?: number;
}

export interface FalQueueSubmitResult {
  requestId: string;
  statusUrl: string | null;
  responseUrl: string | null;
  cancelUrl: string | null;
}

export interface FalQueueStatusResult {
  status: string;
  responseUrl: string | null;
}

export interface FalQueueResult {
  status: string | null;
  videoUrl: string;
  raw: Record<string, unknown>;
}

export class FalKlingVideoError extends Error {
  status: number | null;
  code: string;
  retryable: boolean;

  constructor(message: string, options: {
    status?: number | null;
    code?: string;
    retryable?: boolean;
  } = {}) {
    super(message);
    this.name = "FalKlingVideoError";
    this.status = options.status ?? null;
    this.code = options.code ?? "fal_kling_error";
    this.retryable = options.retryable ?? true;
  }
}

const FAL_QUEUE_BASE_URL = "https://queue.fal.run";
const DEFAULT_NEGATIVE_PROMPT =
  "photorealism, live action, realistic fur, realistic feathers, natural-history footage, CGI, 3D render, painterly realism, style drift, identity drift, distorted anatomy, extra limbs, extra heads, text, captions, logos, franchise resemblance, cuts, scene changes, jitter, blur, low quality";

const ELEMENT_MOTION_LANGUAGE: Record<string, string> = {
  fire: "warm ember motes and a slow heat shimmer",
  ice: "crystalline glints and cool refracted light",
  storm: "subtle charged arcs and restrained electric atmosphere",
  nature: "gentle organic bloom, leaf drift, and living light",
  void: "quiet starfield depth and distant nebula glints",
  light: "soft sunlit rings and warm floating motes",
  water: "calm ripples, soft caustic light, and fluid glow",
};

const normalizeModel = (model: string | null | undefined): string => {
  const trimmed = model?.trim().replace(/^\/+|\/+$/g, "");
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_FAL_KLING_MODEL;
};

const falQueueUrl = (model: string) =>
  `${FAL_QUEUE_BASE_URL}/${normalizeModel(model)}`;

const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

const falQueueRequestModelCandidates = (model: string): string[] => {
  const normalized = normalizeModel(model);
  const candidates = [normalized];
  const parts = normalized.split("/").filter(Boolean);

  if (parts[0] === "fal-ai" && parts[1] === "kling-video" && parts.length > 2) {
    candidates.push(parts.slice(0, 2).join("/"));
  }

  return uniqueStrings(candidates);
};

const falQueueRequestUrls = (
  model: string,
  requestId: string,
  suffix = "",
): string[] =>
  falQueueRequestModelCandidates(model).map((candidate) =>
    `${FAL_QUEUE_BASE_URL}/${candidate}/requests/${
      encodeURIComponent(requestId)
    }${suffix}`
  );

const shouldTryNextQueueUrl = (error: unknown): boolean =>
  error instanceof FalKlingVideoError &&
  (error.status === 404 || error.status === 405);

const parseJsonResponse = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  let payload: Record<string, unknown> | null = null;
  try {
    const parsed = await response.json();
    payload = parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = (typeof payload?.detail === "string" && payload.detail) ||
      (typeof payload?.message === "string" && payload.message) ||
      (typeof payload?.error === "string" && payload.error) ||
      `fal queue request failed with status ${response.status}`;
    throw new FalKlingVideoError(message, {
      status: response.status,
      code: response.status === 401 || response.status === 403
        ? "fal_auth_failed"
        : "fal_request_failed",
      retryable: response.status === 408 || response.status === 429 ||
        response.status >= 500,
    });
  }

  if (!payload) {
    throw new FalKlingVideoError("fal queue returned an empty response", {
      status: response.status,
      code: "fal_empty_response",
      retryable: true,
    });
  }

  return payload;
};

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const firstString = (values: unknown[]): string | null => {
  for (const value of values) {
    const stringValue = asString(value);
    if (stringValue) return stringValue;
  }
  return null;
};

export const buildCompanionAnimationPrompt = ({
  element,
  stage,
}: {
  element?: string | null;
  stage?: number | null;
}): string => {
  const normalizedElement = element?.trim().toLowerCase() ?? "";
  const elementLanguage = ELEMENT_MOTION_LANGUAGE[normalizedElement] ??
    "subtle premium glow, sparse particles, and slow atmospheric motion";

  if (stage === 1) {
    return [
      "COMPANION HATCH TRANSITION ART BIBLE V2: Create one continuous premium 2D anime/storybook hatch transition between the two supplied endpoint images.",
      "Use the supplied endpoint images as the sole source of product identity, species, element, and visual direction.",
      "The supplied start image is the exact companion egg and must be the opening frame. The supplied end image is the exact infant companion portrait and must be the final frame.",
      "Begin with the egg composition unchanged, then add a restrained tremble, spreading luminous cracks, and a soft shell-opening burst that naturally conceals the transformation.",
      `Transition atmosphere: ${elementLanguage}.`,
      "Reveal only the infant shown in the supplied end image. Preserve its exact species, face and eye design, markings, colors, expression, linework, cel shading, background, and framing.",
      "Hold on the supplied infant portrait at the end so the final video frame aligns cleanly with the in-app stage-one image.",
      "One continuous shot with no cuts, captions, logos, alternate creatures, extra limbs, identity drift, style drift, photorealism, live action, CGI, or 3D rendering.",
    ].join(" ");
  }

  const prestige = typeof stage === "number" && stage >= 56
    ? "grand, powerful, and elegant"
    : typeof stage === "number" && stage >= 13
    ? "evolved, confident, and flourishing"
    : "gentle, alive, and companionable";

  return [
    "COMPANION EVOLUTION TRANSITION ART BIBLE V4: Create one continuous premium 2D anime/storybook transition between the two supplied endpoint portraits.",
    "Use the supplied endpoint images as the sole source of product identity, species, element, and visual direction.",
    "The supplied start image is the exact prior approved companion portrait and must be the opening frame. The supplied end image is the exact new companion portrait and must be the final frame.",
    "Evolve naturally from the prior form into the new form while preserving identity, silhouette lineage, face and eye design, markings, species, colors, line weight, and cel shading.",
    `Motion style: ${prestige}; ${elementLanguage}.`,
    "Use a restrained luminous transition to bridge only the differences visible between the supplied portraits, then hold on the exact supplied end portrait for a clean in-app handoff.",
    "Keep the supplied illustrated backgrounds and framing coherent; never introduce a realistic environment.",
    "One continuous shot with no cuts. Camera movement is minimal and steady.",
    "Never convert the companion portrait or illustrated scene into photorealism, live action, realistic fur or feathers, CGI, 3D, or a different illustration style.",
    "Do not imitate or resemble any specific existing game, anime, mascot, or copyrighted character.",
  ].join(" ");
};

export const submitFalKlingVideo = async ({
  fetchFn,
  apiKey,
  model,
  imageUrl,
  endImageUrl,
  prompt,
  durationSeconds = DEFAULT_COMPANION_ANIMATION_DURATION_SECONDS,
}: SubmitFalKlingVideoParams): Promise<FalQueueSubmitResult> => {
  const response = await fetchFn(falQueueUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start_image_url: imageUrl,
      ...(endImageUrl ? { end_image_url: endImageUrl } : {}),
      prompt,
      duration: String(durationSeconds),
      generate_audio: false,
      negative_prompt: DEFAULT_NEGATIVE_PROMPT,
    }),
  });
  const payload = await parseJsonResponse(response);
  const requestId = firstString([
    payload.request_id,
    payload.requestId,
    payload.id,
  ]);

  if (!requestId) {
    throw new FalKlingVideoError(
      "fal queue response did not include a request id",
      {
        status: response.status,
        code: "fal_missing_request_id",
        retryable: true,
      },
    );
  }

  return {
    requestId,
    statusUrl: asString(payload.status_url),
    responseUrl: asString(payload.response_url),
    cancelUrl: asString(payload.cancel_url),
  };
};

export const getFalKlingQueueStatus = async ({
  fetchFn,
  apiKey,
  model,
  requestId,
}: {
  fetchFn: typeof fetch;
  apiKey: string;
  model: string;
  requestId: string;
}): Promise<FalQueueStatusResult> => {
  let lastError: unknown;
  for (const url of falQueueRequestUrls(model, requestId, "/status")) {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    });
    try {
      const payload = await parseJsonResponse(response);
      const status = firstString([payload.status]) ?? "UNKNOWN";

      return {
        status,
        responseUrl: asString(payload.response_url),
      };
    } catch (error) {
      if (!shouldTryNextQueueUrl(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
};

const extractVideoUrlFromPayload = (
  payload: Record<string, unknown>,
): string | null => {
  const data = payload.data && typeof payload.data === "object"
    ? payload.data as Record<string, unknown>
    : null;
  const response = payload.response && typeof payload.response === "object"
    ? payload.response as Record<string, unknown>
    : data ?? payload;

  const video = response.video && typeof response.video === "object"
    ? response.video as Record<string, unknown>
    : null;
  const videos = Array.isArray(response.videos) ? response.videos : [];
  const firstVideo = videos[0] && typeof videos[0] === "object"
    ? videos[0] as Record<string, unknown>
    : null;

  return firstString([
    response.video_url,
    response.output_url,
    response.url,
    video?.url,
    firstVideo?.url,
  ]);
};

export const getFalKlingQueueResult = async ({
  fetchFn,
  apiKey,
  model,
  requestId,
}: {
  fetchFn: typeof fetch;
  apiKey: string;
  model: string;
  requestId: string;
}): Promise<FalQueueResult> => {
  let lastError: unknown;
  for (const url of falQueueRequestUrls(model, requestId)) {
    const response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    });
    try {
      const payload = await parseJsonResponse(response);
      const videoUrl = extractVideoUrlFromPayload(payload);

      if (!videoUrl) {
        throw new FalKlingVideoError("fal result did not include a video URL", {
          status: response.status,
          code: "fal_missing_video_url",
          retryable: false,
        });
      }

      return {
        status: asString(payload.status),
        videoUrl,
        raw: payload,
      };
    } catch (error) {
      if (!shouldTryNextQueueUrl(error)) {
        throw error;
      }
      lastError = error;
    }
  }

  throw lastError;
};

export const downloadFalVideo = async ({
  fetchFn,
  videoUrl,
}: {
  fetchFn: typeof fetch;
  videoUrl: string;
}): Promise<{ bytes: Uint8Array; contentType: string }> => {
  const response = await fetchFn(videoUrl);
  if (!response.ok) {
    throw new FalKlingVideoError(
      `Failed to download fal video with status ${response.status}`,
      {
        status: response.status,
        code: "fal_video_download_failed",
        retryable: response.status === 408 || response.status === 429 ||
          response.status >= 500,
      },
    );
  }

  const contentType = response.headers.get("Content-Type") || "video/mp4";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new FalKlingVideoError("Downloaded fal video was empty", {
      status: response.status,
      code: "fal_video_empty",
      retryable: true,
    });
  }

  return { bytes, contentType };
};

export const resolveFalKlingModelFromEnv = (
  env: Pick<typeof Deno.env, "get"> = Deno.env,
): string =>
  normalizeModel(env.get("FAL_KLING_MODEL") ?? DEFAULT_FAL_KLING_MODEL);
