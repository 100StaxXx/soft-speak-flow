import { describe, expect, it } from "vitest";
import type { SupportReportPayload } from "@/types/resilience";
import { sanitizeSupportReportPayload } from "@/utils/supportDiagnostics";

const basePayload: SupportReportPayload = {
  correlationId: "corr-123",
  category: "sync",
  summary: "Request fails with bearer token",
  reproductionSteps: "Use Bearer abc123def456 in headers",
  expectedBehavior: "Should sync",
  actualBehavior: "Failed",
  consentDiagnostics: true,
  diagnostics: {
    appVersion: "1.2.3",
    platform: "web",
    route: "/help?access_token=abc123",
    authState: "authenticated",
    connectivity: {
      isOnline: true,
      resilienceState: "degraded",
      backendHealth: "degraded",
    },
    queueDepth: 2,
    recentErrorFingerprints: [
      "Authorization: Bearer topsecret",
      "jwt eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def",
    ],
    userAgent: "Mozilla/5.0",
    capturedAt: "2026-02-25T20:00:00.000Z",
  },
};

describe("sanitizeSupportReportPayload", () => {
  it("redacts token-like data from route and fingerprints", () => {
    const sanitized = sanitizeSupportReportPayload(basePayload);

    expect(sanitized.diagnostics.route).toContain("access_token=[redacted]");
    expect(sanitized.diagnostics.recentErrorFingerprints[0]).toContain("Bearer [redacted]");
    expect(sanitized.diagnostics.recentErrorFingerprints[1]).toContain("[redacted-jwt]");
  });

  it("caps fingerprint list to the latest 20 entries", () => {
    const payload = {
      ...basePayload,
      diagnostics: {
        ...basePayload.diagnostics,
        recentErrorFingerprints: Array.from({ length: 30 }, (_, index) => `error ${index}`),
      },
    };

    const sanitized = sanitizeSupportReportPayload(payload);

    expect(sanitized.diagnostics.recentErrorFingerprints).toHaveLength(20);
    expect(sanitized.diagnostics.recentErrorFingerprints[0]).toBe("error 10");
  });
});
