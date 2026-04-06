import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupportReportPayload } from "@/types/resilience";

const mocks = vi.hoisted(() => ({
  trackResilienceEventMock: vi.fn(),
  useOfflineQueueMock: vi.fn(() => ({
    pendingCount: 0,
    syncStatus: "idle" as const,
    lastSyncError: null,
    receipts: [],
    queueAction: vi.fn(),
    queueTaskAction: vi.fn(),
    retryAction: vi.fn(),
    retryAllFailed: vi.fn(),
    discardAction: vi.fn(),
    triggerSync: vi.fn(),
  })),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useOfflineQueue", () => ({
  useOfflineQueue: () => mocks.useOfflineQueueMock(),
}));

vi.mock("@/utils/resilienceTelemetry", () => ({
  trackResilienceEvent: (...args: unknown[]) => mocks.trackResilienceEventMock(...args),
}));

vi.mock("@/utils/supportReport", () => ({
  submitSupportReport: vi.fn(),
}));

vi.mock("@/utils/supportDiagnostics", () => ({
  sanitizeSupportReportPayload: <T,>(payload: T) => payload,
}));

import { submitSupportReport } from "@/utils/supportReport";
import { ResilienceProvider, useResilience } from "./ResilienceContext";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
const originalFetch = globalThis.fetch;
const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");
const mockedSubmitSupportReport = vi.mocked(submitSupportReport);

const createSupportPayload = (overrides: Partial<SupportReportPayload> = {}): SupportReportPayload => ({
  correlationId: "corr-123",
  category: "feedback",
  summary: "A place to share ideas from settings would help.",
  reproductionSteps: "",
  expectedBehavior: "",
  actualBehavior: "",
  consentDiagnostics: true,
  diagnostics: {
    appVersion: "test",
    platform: "web",
    route: "/support/report",
    authState: "authenticated",
    connectivity: {
      isOnline: true,
      resilienceState: "healthy",
      backendHealth: "healthy",
    },
    queueDepth: 0,
    recentErrorFingerprints: [],
    userAgent: "vitest",
    capturedAt: "2026-04-05T18:23:12.000Z",
  },
  ...overrides,
});

const setOnline = (online: boolean) => {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
};

const createWrapper = () => ({ children }: { children: React.ReactNode }) => (
  <ResilienceProvider>{children}</ResilienceProvider>
);

describe("ResilienceProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedSubmitSupportReport.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalOnlineDescriptor) {
      Object.defineProperty(window.navigator, "onLine", originalOnlineDescriptor);
    }
    if (originalVisibilityStateDescriptor) {
      Object.defineProperty(document, "visibilityState", originalVisibilityStateDescriptor);
    }
    globalThis.fetch = originalFetch;
  });

  it("sets shouldQueueWrites when the browser is offline", () => {
    setOnline(false);
    globalThis.fetch = vi.fn();

    const { result } = renderHook(() => useResilience(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toBe("offline");
    expect(result.current.shouldQueueWrites).toBe(true);
  });

  it("keeps shouldQueueWrites false during outage while the browser stays online", async () => {
    vi.useFakeTimers();
    setOnline(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("failed to fetch"));

    const { result } = renderHook(() => useResilience(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(60_000);
      await Promise.resolve();
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(result.current.state).toBe("outage");
    expect(result.current.shouldQueueWrites).toBe(false);
  });

  it("queues feedback reports while offline", async () => {
    setOnline(false);
    globalThis.fetch = vi.fn();

    const queueAction = vi.fn();
    mocks.useOfflineQueueMock.mockReturnValue({
      pendingCount: 0,
      syncStatus: "idle",
      lastSyncError: null,
      receipts: [],
      queueAction,
      queueTaskAction: vi.fn(),
      retryAction: vi.fn(),
      retryAllFailed: vi.fn(),
      discardAction: vi.fn(),
      triggerSync: vi.fn(),
    });

    const { result } = renderHook(() => useResilience(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const response = await result.current.reportIssue(createSupportPayload());
      expect(response).toEqual({ queued: true, submitted: false });
    });

    expect(queueAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actionKind: "SUPPORT_REPORT",
        entityType: "support_report",
        payload: expect.objectContaining({
          category: "feedback",
        }),
      }),
    );
    expect(mockedSubmitSupportReport).not.toHaveBeenCalled();
  });

  it("submits feedback reports immediately when online", async () => {
    setOnline(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    mockedSubmitSupportReport.mockResolvedValue(undefined);

    const { result } = renderHook(() => useResilience(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      const response = await result.current.reportIssue(createSupportPayload());
      expect(response).toEqual({ queued: false, submitted: true });
    });

    expect(mockedSubmitSupportReport).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "feedback",
      }),
    );
  });
});
