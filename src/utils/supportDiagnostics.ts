import type { SupportReportDiagnostics, SupportReportPayload } from "@/types/resilience";

const SENSITIVE_KEY_PATTERN = /(token|authorization|cookie|apikey|api_key|password|secret|session|jwt)/i;

const redactSecretsInString = (value: string): string => {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/=]+/gi, "$1[redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-jwt]")
    .replace(/\bsk-[A-Za-z0-9_-]+\b/g, "[redacted-key]")
    .replace(/([?&](?:token|access_token|refresh_token|apikey|api_key)=)[^&\s]+/gi, "$1[redacted]");
};

const sanitizeUnknown = (value: unknown, keyHint?: string): unknown => {
  if (typeof value === "string") {
    return redactSecretsInString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknown(item));
  }

  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key) || (keyHint && SENSITIVE_KEY_PATTERN.test(keyHint))) {
        sanitized[key] = "[redacted]";
      } else {
        sanitized[key] = sanitizeUnknown(nestedValue, key);
      }
    }

    return sanitized;
  }

  return value;
};

export function sanitizeSupportDiagnostics(diagnostics: SupportReportDiagnostics): SupportReportDiagnostics {
  const safeRoute = redactSecretsInString(diagnostics.route);
  const safeFingerprints = diagnostics.recentErrorFingerprints
    .slice(-20)
    .map((fingerprint) => redactSecretsInString(fingerprint).slice(0, 240));

  return {
    appVersion: redactSecretsInString(diagnostics.appVersion),
    platform: diagnostics.platform,
    route: safeRoute,
    authState: diagnostics.authState,
    connectivity: {
      isOnline: diagnostics.connectivity.isOnline,
      resilienceState: diagnostics.connectivity.resilienceState,
      backendHealth: diagnostics.connectivity.backendHealth,
    },
    queueDepth: Number.isFinite(diagnostics.queueDepth) ? Math.max(0, diagnostics.queueDepth) : 0,
    recentErrorFingerprints: safeFingerprints,
    userAgent: redactSecretsInString(diagnostics.userAgent),
    capturedAt: diagnostics.capturedAt,
  };
}

export function sanitizeSupportReportPayload(payload: SupportReportPayload): SupportReportPayload {
  const sanitizedMeta = sanitizeUnknown({
    category: payload.category,
    summary: payload.summary,
    reproductionSteps: payload.reproductionSteps,
    expectedBehavior: payload.expectedBehavior,
    actualBehavior: payload.actualBehavior,
    consentDiagnostics: payload.consentDiagnostics,
  }) as {
    category: SupportReportPayload["category"];
    summary: string;
    reproductionSteps: string;
    expectedBehavior: string;
    actualBehavior: string;
    consentDiagnostics: boolean;
  };

  return {
    ...payload,
    category: sanitizedMeta.category,
    summary: sanitizedMeta.summary,
    reproductionSteps: sanitizedMeta.reproductionSteps,
    expectedBehavior: sanitizedMeta.expectedBehavior,
    actualBehavior: sanitizedMeta.actualBehavior,
    diagnostics: sanitizeSupportDiagnostics(payload.diagnostics),
  };
}
