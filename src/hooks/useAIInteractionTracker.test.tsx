import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
  parseFunctionInvokeError: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
    auth: {
      getSession: (...args: unknown[]) => mocks.getSession(...args),
    },
    from: (...args: unknown[]) => mocks.from(...args),
  },
}));

vi.mock("@/utils/supabaseFunctionErrors", () => ({
  parseFunctionInvokeError: (...args: unknown[]) => mocks.parseFunctionInvokeError(...args),
}));

import { useAIInteractionTracker } from "./useAIInteractionTracker";

describe("useAIInteractionTracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
        },
      },
    });
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
    mocks.parseFunctionInvokeError.mockResolvedValue({
      isOffline: false,
      category: "unknown",
      name: undefined,
      message: undefined,
      backendMessage: undefined,
      responsePayload: undefined,
    });
    mocks.from.mockImplementation(() => {
      throw new Error("Direct table access is not expected in this test");
    });
  });

  it("tracks interactions through the server function", async () => {
    const { result } = renderHook(() => useAIInteractionTracker());

    await act(async () => {
      await result.current.trackInteraction({
        interactionType: "chat",
        inputText: "Help me plan",
        userAction: "accepted",
      });
    });

    expect(mocks.invoke).toHaveBeenCalledWith("record-ai-interaction", {
      body: expect.objectContaining({
        action: "track_interaction",
        interactionType: "chat",
        inputText: "Help me plan",
        userAction: "accepted",
      }),
    });
  });

  it("tracks daily plan outcomes through the server function", async () => {
    const { result } = renderHook(() => useAIInteractionTracker());

    await act(async () => {
      await result.current.trackDailyPlanOutcome("task-1", "completed", {
        category: "focus",
        difficulty: "medium",
      });
    });

    expect(mocks.invoke).toHaveBeenCalledWith("record-ai-interaction", {
      body: expect.objectContaining({
        action: "track_daily_plan_outcome",
        outcome: "completed",
      }),
    });
  });

  it("silences recoverable tracking fetch errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
        context: {},
      },
    });
    mocks.parseFunctionInvokeError.mockResolvedValue({
      isOffline: false,
      category: "network",
      name: "FunctionsFetchError",
      message: "Failed to send a request to the Edge Function",
      backendMessage: null,
      responsePayload: undefined,
    });

    const { result } = renderHook(() => useAIInteractionTracker());

    await act(async () => {
      await result.current.trackInteraction({
        interactionType: "chat",
        inputText: "Help me plan",
        userAction: "accepted",
      });
    });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
