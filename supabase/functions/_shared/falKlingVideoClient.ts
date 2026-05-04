// Thin client for fal.ai's hosted Kling image-to-video endpoint.
// Used by process-companion-animation-job to turn a companion's scenic page
// image into a short reveal video, played after the strobe sequence in the
// evolution UI.

const DEFAULT_MODEL = "fal-ai/kling-video/v3/standard/image-to-video";
const FAL_QUEUE_BASE_URL = "https://queue.fal.run";

const DEFAULT_PROMPT =
  "Subtle living motion: gentle breathing, ambient particle drift, soft elemental glow. Maintain identity, no scene change.";

const DEFAULT_NEGATIVE_PROMPT =
  "identity drift, distorted anatomy, extra limbs, extra heads, text, captions, logos, scene change, cuts, jitter, blur, low quality";

export type KlingDuration = 5 | 10;

export type KlingProviderStatus =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

export interface KlingSubmitOptions {
  imageUrl: string;
  prompt?: string;
  negativePrompt?: string;
  duration?: KlingDuration;
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface KlingSubmitResult {
  requestId: string;
  statusUrl: string | null;
  responseUrl: string | null;
}

export interface KlingStatusResult {
  status: KlingProviderStatus;
  rawStatus: string;
  responseUrl: string | null;
  statusUrl: string | null;
}

export interface KlingFinalResult {
  videoUrl: string;
  durationSeconds: number | null;
  raw: unknown;
}

function getApiKey(): string {
  const key = Deno.env.get("FAL_KEY")
    ?? Deno.env.get("FAL_API_KEY")
    ?? Deno.env.get("FAL_AI_API_KEY");
  if (!key) {
    throw new Error("FAL_KEY (or FAL_API_KEY) is not configured for Kling video generation");
  }
  return key;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Key ${getApiKey()}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeStatus(raw: unknown): KlingProviderStatus {
  const value = typeof raw === "string" ? raw.toUpperCase() : "";
  if (value === "IN_QUEUE" || value === "IN_PROGRESS" || value === "COMPLETED" || value === "FAILED") {
    return value;
  }
  if (value === "ERROR" || value === "CANCELLED" || value === "TIMED_OUT") {
    return "FAILED";
  }
  // Fal occasionally reports lowercase "completed"; treat unrecognized success-shaped strings as IN_PROGRESS.
  return "IN_PROGRESS";
}

export async function submitFalKlingVideo(
  options: KlingSubmitOptions,
): Promise<KlingSubmitResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_MODEL;
  const url = `${FAL_QUEUE_BASE_URL}/${model}`;

  const payload = {
    image_url: options.imageUrl,
    prompt: options.prompt ?? DEFAULT_PROMPT,
    negative_prompt: options.negativePrompt ?? DEFAULT_NEGATIVE_PROMPT,
    duration: String(options.duration ?? 5),
    generate_audio: false,
  };

  const response = await fetchImpl(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`fal.ai submit failed: ${response.status} ${body.slice(0, 240)}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const requestId = asString(data.request_id) ?? asString(data.requestId);
  if (!requestId) {
    throw new Error("fal.ai submit response missing request_id");
  }

  return {
    requestId,
    statusUrl: asString(data.status_url) ?? asString(data.statusUrl),
    responseUrl: asString(data.response_url) ?? asString(data.responseUrl),
  };
}

export async function getFalKlingStatus(
  requestId: string,
  options: { model?: string; fetchImpl?: typeof fetch } = {},
): Promise<KlingStatusResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_MODEL;
  const url = `${FAL_QUEUE_BASE_URL}/${model}/requests/${requestId}/status`;

  const response = await fetchImpl(url, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`fal.ai status failed: ${response.status} ${body.slice(0, 240)}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const rawStatus = asString(data.status) ?? "";
  return {
    status: normalizeStatus(rawStatus),
    rawStatus,
    responseUrl: asString(data.response_url) ?? asString(data.responseUrl),
    statusUrl: asString(data.status_url) ?? asString(data.statusUrl),
  };
}

function extractVideoUrl(payload: Record<string, unknown>): string | null {
  // fal.ai/Kling response shape: { video: { url, ... }, ... }
  const videoNode = payload.video as Record<string, unknown> | undefined;
  if (videoNode && typeof videoNode === "object") {
    const direct = asString(videoNode.url);
    if (direct) return direct;
  }
  // Some routes return a top-level video_url
  const flat = asString(payload.video_url) ?? asString(payload.url) ?? asString(payload.output_url);
  if (flat) return flat;
  // videos: [{ url }] shape (fallback)
  if (Array.isArray(payload.videos) && payload.videos.length > 0) {
    const first = payload.videos[0] as Record<string, unknown>;
    const fromArr = asString(first?.url);
    if (fromArr) return fromArr;
  }
  return null;
}

export async function getFalKlingResult(
  requestId: string,
  options: { model?: string; fetchImpl?: typeof fetch } = {},
): Promise<KlingFinalResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = options.model ?? DEFAULT_MODEL;
  const url = `${FAL_QUEUE_BASE_URL}/${model}/requests/${requestId}`;

  const response = await fetchImpl(url, {
    method: "GET",
    headers: authHeaders(),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`fal.ai result failed: ${response.status} ${body.slice(0, 240)}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const videoUrl = extractVideoUrl(data);
  if (!videoUrl) {
    throw new Error("fal.ai result missing video URL");
  }

  // Try a few common shapes for duration.
  const videoNode = data.video as Record<string, unknown> | undefined;
  const durationSeconds =
    asNumber(videoNode?.duration)
    ?? asNumber(data.duration)
    ?? null;

  return { videoUrl, durationSeconds, raw: data };
}

export const __testables = {
  DEFAULT_MODEL,
  DEFAULT_PROMPT,
  DEFAULT_NEGATIVE_PROMPT,
  normalizeStatus,
  extractVideoUrl,
};
