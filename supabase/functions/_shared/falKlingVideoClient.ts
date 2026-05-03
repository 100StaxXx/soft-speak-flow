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
  "identity drift, distorted anatomy, extra limbs, extra heads, text, captions, logos, cuts, scene changes, jitter, blur, low quality";

const ELEMENT_MOTION_LANGUAGE: Record<string, string> = {
  fire: "warm ember motes and a slow heat shimmer",
  ice: "crystalline glints and cool refracted light",
  storm: "subtle charged arcs and restrained electric atmosphere",
  nature: "gentle organic bloom, leaf drift, and living light",
  void: "quiet starfield depth and distant nebula glints",
  light: "soft halo rings and noble celestial motes",
  water: "calm ripples, soft caustic light, and fluid glow",
};

const normalizeModel = (model: string | null | undefined): string => {
  const trimmed = model?.trim().replace(/^\/+|\/+$/g, "");
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_FAL_KLING_MODEL;
};

const falQueueUrl = (model: string) =>
  `${FAL_QUEUE_BASE_URL}/${normalizeModel(model)}`;

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
  const prestige = typeof stage === "number" && stage >= 56
    ? "legendary, powerful, and elegant"
    : typeof stage === "number" && stage >= 13
    ? "evolved, confident, and magical"
    : "gentle, alive, and companionable";

  return [
    "Animate this exact companion portrait into a short evolution reveal.",
    "Preserve the companion identity, silhouette, species, colors, expression, and framing.",
    `Motion style: ${prestige}; ${elementLanguage}.`,
    "One continuous shot with no cuts. The subject breathes subtly and settles into the final pose.",
    "Camera movement is minimal and cinematic; premium reveal energy surrounds the companion without obscuring it.",
  ].join(" ");
};

export const submitFalKlingVideo = async ({
  fetchFn,
  apiKey,
  model,
  imageUrl,
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
  const response = await fetchFn(
    `${falQueueUrl(model)}/requests/${encodeURIComponent(requestId)}/status`,
    {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    },
  );
  const payload = await parseJsonResponse(response);
  const status = firstString([payload.status]) ?? "UNKNOWN";

  return {
    status,
    responseUrl: asString(payload.response_url),
  };
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
  const response = await fetchFn(
    `${falQueueUrl(model)}/requests/${encodeURIComponent(requestId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    },
  );
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
