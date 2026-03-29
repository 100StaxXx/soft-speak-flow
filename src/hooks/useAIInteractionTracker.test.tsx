import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  getSession: vi.fn(),
  from: vi.fn(),
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
});
