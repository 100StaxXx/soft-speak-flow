import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fromMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  loggerDebugMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: mocks.fromMock,
  },
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    debug: mocks.loggerDebugMock,
    error: mocks.loggerErrorMock,
  },
}));

import { useCompanionCareSignals } from "./useCompanionCareSignals";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe("useCompanionCareSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: mocks.maybeSingleMock,
    };

    mocks.fromMock.mockReturnValue(builder);
    mocks.maybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("falls back quietly when care signals hit a transient network error", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "TypeError: Load failed" },
    });

    const { result } = renderHook(() => useCompanionCareSignals(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mocks.maybeSingleMock).toHaveBeenCalledTimes(1);
    expect(mocks.loggerDebugMock).toHaveBeenCalledWith(
      "Care signals temporarily unavailable",
      { error: "TypeError: Load failed" },
    );
    expect(mocks.loggerErrorMock).not.toHaveBeenCalled();
    expect(result.current.care.careSignals).toEqual({
      consistency: 0.5,
      responsiveness: 0.5,
      balance: 0.5,
      intent: 0.5,
      recovery: 0.5,
    });
    expect(result.current.care.dialogueTone).toBe("neutral");
  });

  it("still reports non-network care signal errors", async () => {
    mocks.maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied", code: "42501" },
    });

    const { result } = renderHook(() => useCompanionCareSignals(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mocks.maybeSingleMock).toHaveBeenCalledTimes(1);
    expect(mocks.loggerErrorMock).toHaveBeenCalledWith(
      "Failed to fetch care signals:",
      { error: "permission denied" },
    );
    expect(mocks.loggerDebugMock).not.toHaveBeenCalled();
  });
});
