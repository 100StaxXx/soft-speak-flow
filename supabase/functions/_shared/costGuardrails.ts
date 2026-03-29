import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

export const DEFAULT_COST_ALERT_THRESHOLDS = [50, 80, 90, 100] as const;

export type CostCapability =
  | "text"
  | "image"
  | "tts"
  | "music"
  | "transcription"
  | "video";

export type CostProvider = "openai" | "elevenlabs" | "unknown";
export type CostScopeType = "provider" | "feature" | "endpoint";
export type CostEventStatus = "success" | "error" | "blocked";
export type CostAlertType = "threshold" | "anomaly";

type JsonObject = Record<string, unknown>;
type SupabaseClientLike = any;

interface GuardrailScopeKey {
  scopeType: CostScopeType;
  scopeKey: string;
}

interface CostGuardrailConfigRow {
  scope_type: CostScopeType;
  scope_key: string;
  enabled: boolean;
  monthly_budget_usd: number | string | null;
  alert_thresholds: number[] | null;
  metadata: JsonObject | null;
}

interface CostGuardrailStateRow {
  scope_type: CostScopeType;
  scope_key: string;
  period_start: string;
  total_estimated_cost_usd: number | string | null;
  request_count: number | string | null;
  blocked_count: number | string | null;
  last_threshold_percent: number | null;
}

interface ProviderRequestContext {
  provider: CostProvider;
  capability: CostCapability;
  url: string;
  model: string | null;
  requestBody: JsonObject | null;
}

interface ProviderResponseMetrics {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  audioSeconds: number | null;
  imageCount: number | null;
}

export interface CostGuardrailAnomalyInput {
  endpointKey: string;
  estimatedCostUsd: number;
  createdAt: string;
}

export interface CostGuardrailAnomaly {
  endpointKey: string;
  window: "hour" | "day";
  recentSpendUsd: number;
  baselineSpendUsd: number;
  multiplier: number;
  deltaUsd: number;
  message: string;
}

interface CostEventRecord {
  provider: CostProvider | null;
  featureKey: string;
  endpointKey: string;
  userId: string | null;
  requestId: string;
  capability: CostCapability | null;
  model: string | null;
  status: CostEventStatus;
  estimatedCostUsd: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  audioSeconds?: number | null;
  imageCount?: number | null;
  latencyMs?: number | null;
  upstreamStatus?: number | null;
  metadata?: JsonObject;
}

interface CreateCostGuardrailSessionParams {
  supabase: SupabaseClientLike;
  endpointKey: string;
  featureKey: string;
  userId?: string | null;
  requestId?: string;
}

interface EnforceCostGuardrailOptions {
  capabilities?: CostCapability[];
  providers?: CostProvider[];
  metadata?: JsonObject;
}

interface GuardrailBlockDetails {
  reason: string;
  scopeType: CostScopeType;
  scopeKey: string;
}

function getEnv(name: string): string | null {
  return Deno.env.get(name) ?? null;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function truthyEnv(name: string): boolean {
  const raw = (getEnv(name) ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function toInt(value: unknown): number | null {
  const parsed = parseNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function getCurrentCostPeriodStart(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function normalizeThresholds(candidate: unknown): number[] {
  if (!Array.isArray(candidate)) {
    return [...DEFAULT_COST_ALERT_THRESHOLDS];
  }

  const parsed = candidate
    .map((item) => parseNumber(item, Number.NaN))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.min(100, Math.max(1, Math.round(item))));

  const thresholds = unique(parsed).sort((a, b) => a - b);
  return thresholds.length > 0 ? thresholds : [...DEFAULT_COST_ALERT_THRESHOLDS];
}

export function computeCrossedThresholds(params: {
  previousPercent: number;
  nextPercent: number;
  thresholds?: number[];
}): number[] {
  const thresholds = normalizeThresholds(params.thresholds);
  const previous = Math.max(0, params.previousPercent);
  const next = Math.max(0, params.nextPercent);
  if (next <= previous) return [];
  return thresholds.filter((threshold) => previous < threshold && next >= threshold);
}

function getEndpointKillSwitches(): Set<string> {
  const raw = getEnv("COST_KILL_SWITCH_ENDPOINTS") ?? "";
  return new Set(
    raw
      .split(",")
      .map((item) => normalizeKey(item))
      .filter(Boolean),
  );
}

function resolveEnvBlock(endpointKey: string, capabilities: CostCapability[]): GuardrailBlockDetails | null {
  if (truthyEnv("COST_KILL_SWITCH_ALL")) {
    return {
      reason: "Global cost kill switch is enabled",
      scopeType: "endpoint",
      scopeKey: endpointKey,
    };
  }

  if (getEndpointKillSwitches().has(normalizeKey(endpointKey))) {
    return {
      reason: `Endpoint kill switch is enabled for ${endpointKey}`,
      scopeType: "endpoint",
      scopeKey: endpointKey,
    };
  }

  const capabilityEnvMap: Record<CostCapability, string> = {
    text: "COST_KILL_SWITCH_TEXT",
    image: "COST_KILL_SWITCH_IMAGE",
    tts: "COST_KILL_SWITCH_TTS",
    music: "COST_KILL_SWITCH_MUSIC",
    transcription: "COST_KILL_SWITCH_TRANSCRIPTION",
    video: "COST_KILL_SWITCH_VIDEO",
  };

  for (const capability of capabilities) {
    const envName = capabilityEnvMap[capability];
    if (truthyEnv(envName)) {
      return {
        reason: `Capability kill switch is enabled for ${capability}`,
        scopeType: "endpoint",
        scopeKey: endpointKey,
      };
    }
  }

  return null;
}

export class CostGuardrailBlockedError extends Error {
  readonly code = "COST_GUARDRAIL_BLOCKED";
  readonly status = 503;
  readonly scopeType: CostScopeType;
  readonly scopeKey: string;

  constructor(message: string, scope: GuardrailScopeKey) {
    super(message);
    this.name = "CostGuardrailBlockedError";
    this.scopeType = scope.scopeType;
    this.scopeKey = scope.scopeKey;
  }
}

export function isCostGuardrailBlockedError(error: unknown): error is CostGuardrailBlockedError {
  return error instanceof CostGuardrailBlockedError;
}

export function buildCostGuardrailBlockedResponse(
  error: CostGuardrailBlockedError,
  corsHeaders: HeadersInit,
): Response {
  return new Response(
    JSON.stringify({
      error: error.message,
      code: error.code,
      scope_type: error.scopeType,
      scope_key: error.scopeKey,
    }),
    {
      status: error.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    },
  );
}

function readFormDataValue(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

async function parseRequestBody(body: BodyInit | null | undefined): Promise<JsonObject | null> {
  if (!body) return null;

  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === "object" ? parsed as JsonObject : null;
    } catch {
      return null;
    }
  }

  if (body instanceof FormData) {
    const parsed: JsonObject = {};
    for (const [key, value] of body.entries()) {
      if (typeof value === "string") {
        parsed[key] = value;
      } else {
        parsed[key] = {
          name: value.name,
          type: value.type,
          size: value.size,
        };
      }
    }
    return parsed;
  }

  if (body instanceof URLSearchParams) {
    return Object.fromEntries(body.entries());
  }

  return null;
}

function resolveOpenAIModel(rawModel: unknown, capability: CostCapability): string | null {
  const raw = typeof rawModel === "string" ? rawModel.trim() : "";
  if (!raw) {
    if (capability === "image") {
      return getEnv("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
    }
    return getEnv("OPENAI_TEXT_MODEL") ?? "gpt-4o-mini";
  }

  const lower = raw.toLowerCase();
  if (capability === "image") {
    if (lower.startsWith("google/") || lower.startsWith("gemini")) {
      return getEnv("OPENAI_IMAGE_MODEL") ?? "gpt-image-1";
    }
    return raw;
  }

  if (lower.startsWith("google/") || lower.startsWith("gemini")) {
    return getEnv("OPENAI_TEXT_MODEL") ?? "gpt-4o-mini";
  }

  return raw;
}

function resolveCapabilityFromOpenAIRequest(pathname: string, body: JsonObject | null): CostCapability | null {
  if (pathname.includes("/audio/transcriptions")) return "transcription";
  if (pathname.includes("/audio/speech")) return "tts";
  if (pathname.includes("/images/generations")) return "image";
  if (pathname.includes("/videos")) return "video";
  if (!pathname.includes("/chat/completions") && !pathname.includes("/responses")) return null;

  const modalities = body?.modalities;
  const wantsImage =
    Array.isArray(modalities) &&
    modalities.some((modality) => typeof modality === "string" && modality.toLowerCase() === "image");

  const model = typeof body?.model === "string" ? body.model.toLowerCase() : "";
  const hasImageSize = typeof body?.image_size === "string" && body.image_size.length > 0;

  if (wantsImage || hasImageSize || model.includes("image")) {
    return "image";
  }

  return "text";
}

function resolveCapabilityFromElevenLabsRequest(pathname: string): CostCapability | null {
  if (pathname.includes("/v1/text-to-speech/")) return "tts";
  if (pathname.includes("/v1/music")) return "music";
  if (pathname.includes("/v1/video")) return "video";
  return null;
}

async function resolveProviderRequestContext(
  input: string | URL,
  init?: RequestInit,
): Promise<ProviderRequestContext | null> {
  const url = new URL(String(input));
  const hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.toLowerCase();
  const requestBody = await parseRequestBody(init?.body);

  if (hostname === "api.openai.com") {
    const capability = resolveCapabilityFromOpenAIRequest(pathname, requestBody);
    if (!capability) return null;
    return {
      provider: "openai",
      capability,
      url: url.toString(),
      model: resolveOpenAIModel(requestBody?.model, capability),
      requestBody,
    };
  }

  if (hostname === "api.elevenlabs.io") {
    const capability = resolveCapabilityFromElevenLabsRequest(pathname);
    if (!capability) return null;
    return {
      provider: "elevenlabs",
      capability,
      url: url.toString(),
      model: typeof requestBody?.model_id === "string" ? requestBody.model_id : null,
      requestBody,
    };
  }

  return null;
}

async function extractResponseMetrics(
  response: Response,
  providerContext: ProviderRequestContext,
): Promise<ProviderResponseMetrics> {
  const metrics: ProviderResponseMetrics = {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    audioSeconds: null,
    imageCount: null,
  };

  const contentType = response.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    if (providerContext.provider === "elevenlabs" && providerContext.capability === "music") {
      metrics.audioSeconds = parseNumber(providerContext.requestBody?.duration_seconds, 0) || null;
    }
    return metrics;
  }

  try {
    const payload = await response.clone().json() as JsonObject;
    const usage = payload.usage && typeof payload.usage === "object" ? payload.usage as JsonObject : null;
    metrics.inputTokens = toInt(usage?.prompt_tokens ?? usage?.input_tokens);
    metrics.outputTokens = toInt(usage?.completion_tokens ?? usage?.output_tokens);
    metrics.totalTokens = toInt(usage?.total_tokens);
    metrics.audioSeconds = parseNumber(payload.duration, 0) || null;

    const dataImages = Array.isArray(payload.data) ? payload.data.length : 0;
    const messageImages = Array.isArray(
      (payload.choices as JsonObject[] | undefined)?.[0]?.message &&
      typeof (payload.choices as JsonObject[] | undefined)?.[0]?.message === "object"
        ? ((payload.choices as JsonObject[])[0].message as JsonObject).images
        : null,
    )
      ? (((payload.choices as JsonObject[])[0].message as JsonObject).images as unknown[]).length
      : 0;
    metrics.imageCount = dataImages || messageImages || null;
  } catch {
    // Non-blocking: some providers return binary or truncated content-types.
  }

  return metrics;
}

function estimateOpenAICost(
  capability: CostCapability,
  model: string | null,
  requestBody: JsonObject | null,
  metrics: ProviderResponseMetrics,
): number {
  if (capability === "text") {
    const inputTokens = metrics.inputTokens ?? 0;
    const outputTokens = metrics.outputTokens ?? 0;
    const modelName = (model ?? "").toLowerCase();
    const isLargeModel = modelName.includes("gpt-5") || modelName.includes("gpt-4o");
    const inputRate = isLargeModel ? 0.005 : 0.001;
    const outputRate = isLargeModel ? 0.015 : 0.002;
    return roundUsd((inputTokens / 1000) * inputRate + (outputTokens / 1000) * outputRate);
  }

  if (capability === "image") {
    const size = typeof requestBody?.image_size === "string" ? requestBody.image_size : "1024x1024";
    const imageCount =
      metrics.imageCount ??
      (parseNumber(requestBody?.n, 0) || 1);
    const unitCost = size === "1536x1024" ? 0.08 : 0.05;
    return roundUsd(imageCount * unitCost);
  }

  if (capability === "transcription") {
    const seconds = metrics.audioSeconds ?? 0;
    return roundUsd((seconds / 60) * 0.006);
  }

  if (capability === "tts") {
    const textLength = typeof requestBody?.input === "string"
      ? requestBody.input.length
      : typeof requestBody?.text === "string"
        ? requestBody.text.length
        : 0;
    return roundUsd((textLength / 1000) * 0.02);
  }

  if (capability === "video") {
    return roundUsd(parseNumber(requestBody?.duration_seconds, 0) * 0.1);
  }

  return 0;
}

function estimateElevenLabsCost(
  capability: CostCapability,
  requestBody: JsonObject | null,
  metrics: ProviderResponseMetrics,
): number {
  if (capability === "tts") {
    const textLength = typeof requestBody?.text === "string" ? requestBody.text.length : 0;
    return roundUsd((textLength / 1000) * 0.3);
  }

  if (capability === "music") {
    const seconds = parseNumber(requestBody?.duration_seconds, metrics.audioSeconds ?? 0);
    return roundUsd(seconds * 0.025);
  }

  if (capability === "video") {
    return roundUsd(parseNumber(requestBody?.duration_seconds, 0) * 0.12);
  }

  return 0;
}

function estimateProviderRequestCost(
  providerContext: ProviderRequestContext,
  metrics: ProviderResponseMetrics,
  responseOk: boolean,
): number {
  if (!responseOk) return 0;

  if (providerContext.provider === "openai") {
    return estimateOpenAICost(
      providerContext.capability,
      providerContext.model,
      providerContext.requestBody,
      metrics,
    );
  }

  if (providerContext.provider === "elevenlabs") {
    return estimateElevenLabsCost(providerContext.capability, providerContext.requestBody, metrics);
  }

  return 0;
}

async function loadConfigRows(
  supabase: SupabaseClientLike,
  scopeType: CostScopeType,
  scopeKeys: string[],
): Promise<CostGuardrailConfigRow[]> {
  if (scopeKeys.length === 0) return [];
  const { data, error } = await supabase
    .from("cost_guardrail_config")
    .select("scope_type, scope_key, enabled, monthly_budget_usd, alert_thresholds, metadata")
    .eq("scope_type", scopeType)
    .in("scope_key", scopeKeys);

  if (error) throw error;
  return (data ?? []) as CostGuardrailConfigRow[];
}

async function loadStateRows(
  supabase: SupabaseClientLike,
  scopeType: CostScopeType,
  scopeKeys: string[],
  periodStart: string,
): Promise<CostGuardrailStateRow[]> {
  if (scopeKeys.length === 0) return [];
  const { data, error } = await supabase
    .from("cost_guardrail_state")
    .select("scope_type, scope_key, period_start, total_estimated_cost_usd, request_count, blocked_count, last_threshold_percent")
    .eq("scope_type", scopeType)
    .eq("period_start", periodStart)
    .in("scope_key", scopeKeys);

  if (error) throw error;
  return (data ?? []) as CostGuardrailStateRow[];
}

async function insertCostEvent(
  supabase: SupabaseClientLike,
  periodStart: string,
  event: CostEventRecord,
): Promise<void> {
  const payload = {
    provider: event.provider,
    feature_key: event.featureKey,
    endpoint_key: event.endpointKey,
    user_id: event.userId,
    request_id: event.requestId,
    period_start: periodStart,
    capability: event.capability,
    model: event.model,
    status: event.status,
    estimated_cost_usd: roundUsd(event.estimatedCostUsd),
    input_tokens: event.inputTokens ?? null,
    output_tokens: event.outputTokens ?? null,
    total_tokens: event.totalTokens ?? null,
    audio_seconds: event.audioSeconds ?? null,
    image_count: event.imageCount ?? null,
    latency_ms: event.latencyMs ?? null,
    upstream_status: event.upstreamStatus ?? null,
    metadata: event.metadata ?? {},
  };

  const { error } = await supabase.from("cost_events").insert(payload);
  if (error) throw error;
}

async function upsertStateRow(
  supabase: SupabaseClientLike,
  row: CostGuardrailStateRow,
): Promise<void> {
  const { error } = await supabase
    .from("cost_guardrail_state")
    .upsert({
      scope_type: row.scope_type,
      scope_key: row.scope_key,
      period_start: row.period_start,
      total_estimated_cost_usd: roundUsd(parseNumber(row.total_estimated_cost_usd)),
      request_count: Math.max(0, Math.round(parseNumber(row.request_count))),
      blocked_count: Math.max(0, Math.round(parseNumber(row.blocked_count))),
      last_threshold_percent: row.last_threshold_percent,
    }, {
      onConflict: "scope_type,scope_key,period_start",
    });

  if (error) throw error;
}

async function sendAlertWebhook(
  rowId: string,
  payload: JsonObject,
  supabase: SupabaseClientLike,
): Promise<void> {
  const webhookUrl = getEnv("COST_ALERT_WEBHOOK_URL");
  const webhookToken = getEnv("COST_ALERT_WEBHOOK_BEARER_TOKEN");

  if (!webhookUrl) {
    await supabase
      .from("cost_alert_events")
      .update({
        delivery_status: "skipped",
        delivery_attempted_at: new Date().toISOString(),
      })
      .eq("id", rowId);
    return;
  }

  let deliveryStatus = "delivered";
  let deliveryResponseStatus: number | null = null;

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    deliveryResponseStatus = response.status;
    if (!response.ok) {
      deliveryStatus = "failed";
    }
  } catch {
    deliveryStatus = "failed";
  }

  await supabase
    .from("cost_alert_events")
    .update({
      delivery_status: deliveryStatus,
      delivery_attempted_at: new Date().toISOString(),
      delivery_response_status: deliveryResponseStatus,
    })
    .eq("id", rowId);
}

export async function emitCostAlert(params: {
  supabase: SupabaseClientLike;
  periodStart: string;
  scopeType: CostScopeType;
  scopeKey: string;
  alertType: CostAlertType;
  currentEstimatedCostUsd: number;
  message: string;
  dedupeKey: string;
  thresholdPercent?: number | null;
  metadata?: JsonObject;
}): Promise<boolean> {
  const { data, error } = await params.supabase
    .from("cost_alert_events")
    .insert({
      period_start: params.periodStart,
      scope_type: params.scopeType,
      scope_key: params.scopeKey,
      alert_type: params.alertType,
      threshold_percent: params.thresholdPercent ?? null,
      message: params.message,
      current_estimated_cost_usd: roundUsd(params.currentEstimatedCostUsd),
      dedupe_key: params.dedupeKey,
      metadata: params.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return false;
    throw error;
  }

  const rowId = typeof data?.id === "string" ? data.id : null;
  if (!rowId) return true;

  await sendAlertWebhook(rowId, {
    alert_type: params.alertType,
    scope_type: params.scopeType,
    scope_key: params.scopeKey,
    threshold_percent: params.thresholdPercent ?? null,
    current_estimated_cost_usd: roundUsd(params.currentEstimatedCostUsd),
    period_start: params.periodStart,
    message: params.message,
    metadata: params.metadata ?? {},
  }, params.supabase);

  return true;
}

export function detectCostAnomalies(
  events: CostGuardrailAnomalyInput[],
  now = new Date(),
): CostGuardrailAnomaly[] {
  const endpointEvents = new Map<string, CostGuardrailAnomalyInput[]>();
  for (const event of events) {
    if (!event.endpointKey || event.estimatedCostUsd <= 0) continue;
    const key = normalizeKey(event.endpointKey);
    const list = endpointEvents.get(key) ?? [];
    list.push(event);
    endpointEvents.set(key, list);
  }

  const nowMs = now.getTime();
  const oneHourAgo = nowMs - 60 * 60 * 1000;
  const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = nowMs - 14 * 24 * 60 * 60 * 1000;
  const anomalies: CostGuardrailAnomaly[] = [];

  for (const [endpointKey, endpointRows] of endpointEvents.entries()) {
    let lastHourSpend = 0;
    let trailingSevenDaysSpend = 0;
    let lastDaySpend = 0;
    let trailingFourteenDaysSpend = 0;

    for (const row of endpointRows) {
      const createdAtMs = new Date(row.createdAt).getTime();
      if (!Number.isFinite(createdAtMs)) continue;

      if (createdAtMs >= oneHourAgo) {
        lastHourSpend += row.estimatedCostUsd;
      } else if (createdAtMs >= sevenDaysAgo) {
        trailingSevenDaysSpend += row.estimatedCostUsd;
      }

      if (createdAtMs >= oneDayAgo) {
        lastDaySpend += row.estimatedCostUsd;
      } else if (createdAtMs >= fourteenDaysAgo) {
        trailingFourteenDaysSpend += row.estimatedCostUsd;
      }
    }

    const trailingHourlyAverage = trailingSevenDaysSpend / (7 * 24 - 1);
    const trailingDailyAverage = trailingFourteenDaysSpend / 13;

    if (
      lastHourSpend > 0 &&
      trailingHourlyAverage > 0 &&
      lastHourSpend >= trailingHourlyAverage * 3 &&
      lastHourSpend - trailingHourlyAverage >= 3
    ) {
      anomalies.push({
        endpointKey,
        window: "hour",
        recentSpendUsd: roundUsd(lastHourSpend),
        baselineSpendUsd: roundUsd(trailingHourlyAverage),
        multiplier: Math.round((lastHourSpend / trailingHourlyAverage) * 100) / 100,
        deltaUsd: roundUsd(lastHourSpend - trailingHourlyAverage),
        message:
          `Last 1h spend for ${endpointKey} is ${roundUsd(lastHourSpend)} USD ` +
          `vs ${roundUsd(trailingHourlyAverage)} USD trailing hourly average.`,
      });
    }

    if (
      lastDaySpend > 0 &&
      trailingDailyAverage > 0 &&
      lastDaySpend >= trailingDailyAverage * 2 &&
      lastDaySpend - trailingDailyAverage >= 10
    ) {
      anomalies.push({
        endpointKey,
        window: "day",
        recentSpendUsd: roundUsd(lastDaySpend),
        baselineSpendUsd: roundUsd(trailingDailyAverage),
        multiplier: Math.round((lastDaySpend / trailingDailyAverage) * 100) / 100,
        deltaUsd: roundUsd(lastDaySpend - trailingDailyAverage),
        message:
          `Last 24h spend for ${endpointKey} is ${roundUsd(lastDaySpend)} USD ` +
          `vs ${roundUsd(trailingDailyAverage)} USD trailing daily average.`,
      });
    }
  }

  return anomalies.sort((a, b) => b.deltaUsd - a.deltaUsd);
}

export function createCostGuardrailSupabaseClient(): SupabaseClientLike {
  const supabaseUrl = getEnv("SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service-role configuration missing for cost guardrails");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export function createCostGuardrailSession(params: CreateCostGuardrailSessionParams) {
  const endpointKey = normalizeKey(params.endpointKey);
  const featureKey = normalizeKey(params.featureKey);
  const requestId = params.requestId ?? crypto.randomUUID();
  const periodStart = getCurrentCostPeriodStart();
  const configCache = new Map<string, CostGuardrailConfigRow | null>();
  const stateCache = new Map<string, CostGuardrailStateRow | null>();

  const cacheKeyForScope = (scope: GuardrailScopeKey) => `${scope.scopeType}:${scope.scopeKey}`;

  const ensureScopeRowsLoaded = async (scopes: GuardrailScopeKey[]) => {
    const byType: Record<CostScopeType, string[]> = {
      provider: [],
      feature: [],
      endpoint: [],
    };

    for (const scope of scopes) {
      const cacheKey = cacheKeyForScope(scope);
      if (configCache.has(cacheKey) && stateCache.has(cacheKey)) continue;
      byType[scope.scopeType].push(scope.scopeKey);
    }

    await Promise.all((["provider", "feature", "endpoint"] as CostScopeType[]).map(async (scopeType) => {
      const scopeKeys = unique(byType[scopeType]);
      if (scopeKeys.length === 0) return;

      const [configRows, stateRows] = await Promise.all([
        loadConfigRows(params.supabase, scopeType, scopeKeys),
        loadStateRows(params.supabase, scopeType, scopeKeys, periodStart),
      ]);

      for (const scopeKey of scopeKeys) {
        const cacheKey = `${scopeType}:${scopeKey}`;
        configCache.set(
          cacheKey,
          configRows.find((row) => normalizeKey(row.scope_key) === scopeKey) ?? null,
        );
        stateCache.set(
          cacheKey,
          stateRows.find((row) => normalizeKey(row.scope_key) === scopeKey) ?? null,
        );
      }
    }));
  };

  const scopesForEvent = (providers: CostProvider[]): GuardrailScopeKey[] => {
    const scopes: GuardrailScopeKey[] = [
      { scopeType: "endpoint", scopeKey: endpointKey },
      { scopeType: "feature", scopeKey: featureKey },
    ];

    for (const provider of providers) {
      if (provider && provider !== "unknown") {
        scopes.push({ scopeType: "provider", scopeKey: provider });
      }
    }

    return scopes;
  };

  const recordEvent = async (event: CostEventRecord, providers: CostProvider[]) => {
    try {
      await insertCostEvent(params.supabase, periodStart, event);

      const scopes = scopesForEvent(providers);
      await ensureScopeRowsLoaded(scopes);

      for (const scope of scopes) {
        const cacheKey = cacheKeyForScope(scope);
        const configRow = configCache.get(cacheKey);
        const previousState = stateCache.get(cacheKey);
        const previousTotal = parseNumber(previousState?.total_estimated_cost_usd);
        const previousPercent = configRow?.monthly_budget_usd
          ? (previousTotal / parseNumber(configRow.monthly_budget_usd)) * 100
          : 0;

        const nextState: CostGuardrailStateRow = {
          scope_type: scope.scopeType,
          scope_key: scope.scopeKey,
          period_start: periodStart,
          total_estimated_cost_usd: previousTotal + (event.status === "success" ? event.estimatedCostUsd : 0),
          request_count: parseNumber(previousState?.request_count) + (event.status === "blocked" ? 0 : 1),
          blocked_count: parseNumber(previousState?.blocked_count) + (event.status === "blocked" ? 1 : 0),
          last_threshold_percent: previousState?.last_threshold_percent ?? null,
        };

        const budget = parseNumber(configRow?.monthly_budget_usd, 0);
        const nextPercent = budget > 0
          ? (parseNumber(nextState.total_estimated_cost_usd) / budget) * 100
          : 0;
        const crossedThresholds = event.status === "success" && budget > 0
          ? computeCrossedThresholds({
            previousPercent,
            nextPercent,
            thresholds: configRow?.alert_thresholds ?? undefined,
          })
          : [];

        if (crossedThresholds.length > 0) {
          nextState.last_threshold_percent = Math.max(
            nextState.last_threshold_percent ?? 0,
            crossedThresholds[crossedThresholds.length - 1],
          );
        }

        await upsertStateRow(params.supabase, nextState);
        stateCache.set(cacheKey, nextState);

        for (const threshold of crossedThresholds) {
          await emitCostAlert({
            supabase: params.supabase,
            periodStart,
            scopeType: scope.scopeType,
            scopeKey: scope.scopeKey,
            alertType: "threshold",
            thresholdPercent: threshold,
            currentEstimatedCostUsd: parseNumber(nextState.total_estimated_cost_usd),
            message:
              `${scope.scopeType}:${scope.scopeKey} reached ${threshold}% of its ` +
              `${budget.toFixed(2)} USD monthly budget.`,
            dedupeKey: `${periodStart}:threshold:${scope.scopeType}:${scope.scopeKey}:${threshold}`,
            metadata: {
              endpoint_key: endpointKey,
              feature_key: featureKey,
              request_id: requestId,
            },
          });
        }
      }
    } catch (error) {
      console.error("[cost-guardrails] Failed to persist cost telemetry", error);
    }
  };

  const enforceAccess = async (options: EnforceCostGuardrailOptions = {}) => {
    const capabilities = unique(options.capabilities ?? []);
    const providers = unique(
      (options.providers ?? []).map((provider) => provider ?? "unknown"),
    );

    const envBlock = resolveEnvBlock(endpointKey, capabilities);
    if (envBlock) {
      await recordEvent({
        provider: providers[0] && providers[0] !== "unknown" ? providers[0] : null,
        featureKey,
        endpointKey,
        userId: params.userId ?? null,
        requestId,
        capability: capabilities[0] ?? null,
        model: null,
        status: "blocked",
        estimatedCostUsd: 0,
        upstreamStatus: 503,
        metadata: {
          blocked_by: "env_kill_switch",
          reason: envBlock.reason,
          ...options.metadata,
        },
      }, providers);
      throw new CostGuardrailBlockedError(envBlock.reason, envBlock);
    }

    const scopes = scopesForEvent(providers);
    await ensureScopeRowsLoaded(scopes);

    for (const scope of scopes) {
      const cacheKey = cacheKeyForScope(scope);
      const configRow = configCache.get(cacheKey);
      if (!configRow) continue;

      if (configRow.enabled === false) {
        const reason = `${scope.scopeType}:${scope.scopeKey} is disabled by runtime guardrail config`;
        await recordEvent({
          provider: providers[0] && providers[0] !== "unknown" ? providers[0] : null,
          featureKey,
          endpointKey,
          userId: params.userId ?? null,
          requestId,
          capability: capabilities[0] ?? null,
          model: null,
          status: "blocked",
          estimatedCostUsd: 0,
          upstreamStatus: 503,
          metadata: {
            blocked_by: "runtime_config",
            reason,
            ...options.metadata,
          },
        }, providers);
        throw new CostGuardrailBlockedError(reason, scope);
      }

      const budget = parseNumber(configRow.monthly_budget_usd, 0);
      const currentTotal = parseNumber(stateCache.get(cacheKey)?.total_estimated_cost_usd, 0);
      if (budget > 0 && currentTotal >= budget) {
        const reason = `${scope.scopeType}:${scope.scopeKey} has exhausted its monthly budget`;
        await recordEvent({
          provider: providers[0] && providers[0] !== "unknown" ? providers[0] : null,
          featureKey,
          endpointKey,
          userId: params.userId ?? null,
          requestId,
          capability: capabilities[0] ?? null,
          model: null,
          status: "blocked",
          estimatedCostUsd: 0,
          upstreamStatus: 503,
          metadata: {
            blocked_by: "budget_limit",
            reason,
            monthly_budget_usd: budget,
            current_estimated_cost_usd: roundUsd(currentTotal),
            ...options.metadata,
          },
        }, providers);
        throw new CostGuardrailBlockedError(reason, scope);
      }
    }
  };

  const wrapFetch = (baseFetch: typeof fetch): typeof fetch => {
    return (async (input: string | URL | Request, init?: RequestInit) => {
      if (input instanceof Request) {
        return baseFetch(input, init);
      }

      const providerContext = await resolveProviderRequestContext(input, init);
      if (!providerContext) {
        return baseFetch(input, init);
      }

      await enforceAccess({
        capabilities: [providerContext.capability],
        providers: [providerContext.provider],
        metadata: {
          provider_url: providerContext.url,
        },
      });

      const startedAt = Date.now();
      try {
        const response = await baseFetch(input, init);
        const metrics = await extractResponseMetrics(response, providerContext);
        const estimatedCostUsd = estimateProviderRequestCost(providerContext, metrics, response.ok);

        await recordEvent({
          provider: providerContext.provider,
          featureKey,
          endpointKey,
          userId: params.userId ?? null,
          requestId,
          capability: providerContext.capability,
          model: providerContext.model,
          status: response.ok ? "success" : "error",
          estimatedCostUsd,
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          totalTokens: metrics.totalTokens,
          audioSeconds: metrics.audioSeconds,
          imageCount: metrics.imageCount,
          latencyMs: Date.now() - startedAt,
          upstreamStatus: response.status,
          metadata: {
            provider_url: providerContext.url,
          },
        }, [providerContext.provider]);

        return response;
      } catch (error) {
        await recordEvent({
          provider: providerContext.provider,
          featureKey,
          endpointKey,
          userId: params.userId ?? null,
          requestId,
          capability: providerContext.capability,
          model: providerContext.model,
          status: "error",
          estimatedCostUsd: 0,
          latencyMs: Date.now() - startedAt,
          metadata: {
            provider_url: providerContext.url,
            error: error instanceof Error ? error.message : String(error),
          },
        }, [providerContext.provider]);

        throw error;
      }
    }) as typeof fetch;
  };

  return {
    endpointKey,
    featureKey,
    requestId,
    enforceAccess,
    wrapFetch,
  };
}
