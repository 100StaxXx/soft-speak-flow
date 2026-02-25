export type FunctionInvokeErrorCategory =
  | "network"
  | "http"
  | "auth"
  | "rate_limit"
  | "relay"
  | "unknown";

export interface ParsedFunctionInvokeError {
  name?: string;
  message?: string;
  status?: number;
  code?: string;
  responsePayload?: {
    message?: string;
    error?: string;
    code?: string;
    upstreamStatus?: number;
    upstreamError?: string;
  };
  backendMessage?: string;
  upstreamStatus?: number;
  upstreamError?: string;
  isOffline: boolean;
  category: FunctionInvokeErrorCategory;
}

const NETWORK_ERROR_PATTERNS = [
  "failed to send a request to the edge function",
  "failed to fetch",
  "network",
  "timeout",
  "timed out",
  "econnreset",
  "connection",
  "fetcherror",
  "functionsfetcherror",
];

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getOfflineState(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine === false : false;
}

function getContextResponse(error: unknown): Response | undefined {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return undefined;
  }

  const context = (error as { context?: unknown }).context;
  return context instanceof Response ? context : undefined;
}

function getStatusFromError(error: unknown): number | undefined {
  const contextResponse = getContextResponse(error);
  if (contextResponse) return contextResponse.status;

  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      return status;
    }
  }

  return undefined;
}

function hasNetworkPattern(text?: string): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function classifyFunctionInvokeError(details: {
  name?: string;
  message?: string;
  status?: number;
  backendMessage?: string;
  isOffline: boolean;
}): FunctionInvokeErrorCategory {
  const { name, message, status, backendMessage, isOffline } = details;

  if (isOffline) return "network";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limit";

  const nameLower = (name ?? "").toLowerCase();
  const messageLower = (message ?? "").toLowerCase();
  const backendLower = (backendMessage ?? "").toLowerCase();
  const combined = `${nameLower} ${messageLower} ${backendLower}`;

  if (
    nameLower.includes("functionsrelayerror") ||
    combined.includes("relay error invoking the edge function")
  ) {
    return "relay";
  }

  if (hasNetworkPattern(combined)) return "network";
  if (typeof status === "number" && status >= 400) return "http";
  return "unknown";
}

export async function parseFunctionInvokeError(
  error: unknown,
): Promise<ParsedFunctionInvokeError> {
  const name =
    error && typeof error === "object" ? asString((error as { name?: unknown }).name) : undefined;
  const message =
    error && typeof error === "object"
      ? asString((error as { message?: unknown }).message)
      : error instanceof Error
        ? error.message
        : undefined;
  const code =
    error && typeof error === "object" ? asString((error as { code?: unknown }).code) : undefined;
  const status = getStatusFromError(error);
  const isOffline = getOfflineState();

  let responsePayload: ParsedFunctionInvokeError["responsePayload"];
  const contextResponse = getContextResponse(error);
  if (contextResponse) {
    try {
      const payload = await contextResponse.clone().json();
      if (payload && typeof payload === "object" && !Array.isArray(payload)) {
        const payloadRecord = payload as Record<string, unknown>;
        const payloadMessage = asString(payloadRecord.message);
        const payloadError = asString(payloadRecord.error);
        const payloadCode = asString(payloadRecord.code);
        const payloadUpstreamStatus =
          asNumber(payloadRecord.upstream_status) ?? asNumber(payloadRecord.upstreamStatus);
        const payloadUpstreamError =
          asString(payloadRecord.upstream_error) ?? asString(payloadRecord.upstreamError);

        if (
          payloadMessage ||
          payloadError ||
          payloadCode ||
          payloadUpstreamStatus ||
          payloadUpstreamError
        ) {
          responsePayload = {
            message: payloadMessage,
            error: payloadError,
            code: payloadCode,
            upstreamStatus: payloadUpstreamStatus,
            upstreamError: payloadUpstreamError,
          };
        }
      }
    } catch {
      // Ignore payload parse errors; we still return status/message derived from the original error.
    }
  }

  const backendMessage = responsePayload?.message ?? responsePayload?.error;
  const upstreamStatus = responsePayload?.upstreamStatus;
  const upstreamError = responsePayload?.upstreamError;
  const category = classifyFunctionInvokeError({
    name,
    message,
    status,
    backendMessage,
    isOffline,
  });

  return {
    name,
    message,
    status,
    code,
    responsePayload,
    backendMessage,
    upstreamStatus,
    upstreamError,
    isOffline,
    category,
  };
}

export function isRetriableFunctionInvokeError(error: unknown): boolean {
  const status = getStatusFromError(error);
  if (status === 408) return true;
  if (typeof status === "number") {
    return status >= 500 && status < 600;
  }

  if (getOfflineState()) return true;

  if (error && typeof error === "object") {
    const name = asString((error as { name?: unknown }).name);
    const message = asString((error as { message?: unknown }).message);
    const combined = `${name ?? ""} ${message ?? ""}`;
    return hasNetworkPattern(combined);
  }

  if (typeof error === "string") {
    return hasNetworkPattern(error);
  }

  return false;
}

function isLikelyTechnicalMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("edge function") ||
    normalized.includes("functionsfetcherror") ||
    normalized.includes("relay error") ||
    normalized.includes("failed to send a request")
  );
}

function extractProviderStatusFromMessage(message?: string): number | undefined {
  if (!message) return undefined;
  const match = message.match(/\b([45]\d{2})\b/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapProviderAudioError(parsed: ParsedFunctionInvokeError): string | null {
  const errorCode = parsed.code ?? parsed.responsePayload?.code;
  const isAudioPipelineError =
    errorCode === "AUDIO_PIPELINE_FAILED" ||
    errorCode === "AUDIO_GENERATION_FAILED";

  if (!isAudioPipelineError) return null;

  const providerStatus =
    extractProviderStatusFromMessage(parsed.upstreamError) ??
    extractProviderStatusFromMessage(parsed.backendMessage) ??
    parsed.upstreamStatus;

  if (providerStatus === 401 || providerStatus === 403) {
    return "Voice generation is temporarily unavailable (provider authentication failed). Please try again shortly.";
  }

  if (providerStatus === 402) {
    return "Voice generation is temporarily unavailable because provider credits are exhausted.";
  }

  if (providerStatus === 429) {
    return "Voice generation is being rate-limited right now. Please wait a minute and try again.";
  }

  if (typeof providerStatus === "number" && providerStatus >= 500) {
    return "Voice generation is temporarily unavailable. Please try again in a moment.";
  }

  if (
    typeof parsed.upstreamError === "string" &&
    parsed.upstreamError.toLowerCase().includes("timed out")
  ) {
    return "Voice generation timed out. Please try again.";
  }

  return null;
}

export function toUserFacingFunctionError(
  parsed: ParsedFunctionInvokeError,
  opts?: { action?: string },
): string {
  const action = opts?.action ?? "complete this action";

  if (parsed.isOffline || parsed.category === "network") {
    return `We couldn't reach the server to ${action}. Check your connection and try again.`;
  }

  if (parsed.category === "auth") {
    return `Your session has expired. Please sign in again and try to ${action}.`;
  }

  if (parsed.category === "rate_limit") {
    return (
      parsed.backendMessage ??
      "You're making requests too quickly. Please wait a moment and try again."
    );
  }

  if (
    parsed.category === "relay" ||
    parsed.status === 408
  ) {
    return "Our servers are temporarily unavailable. Please try again in a moment.";
  }

  const providerAudioError = mapProviderAudioError(parsed);
  if (providerAudioError) {
    return providerAudioError;
  }

  if (typeof parsed.status === "number" && parsed.status >= 500) {
    if (parsed.backendMessage && !isLikelyTechnicalMessage(parsed.backendMessage)) {
      return parsed.backendMessage;
    }
    return "Our servers are temporarily unavailable. Please try again in a moment.";
  }

  if (parsed.category === "http" && parsed.backendMessage && !isLikelyTechnicalMessage(parsed.backendMessage)) {
    return parsed.backendMessage;
  }

  return `Unable to ${action}. Please try again.`;
}
