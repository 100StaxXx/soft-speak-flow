import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { ResilienceProvider, useResilience } from "./ResilienceContext";

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
const originalFetch = globalThis.fetch;
const originalVisibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");

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
});
