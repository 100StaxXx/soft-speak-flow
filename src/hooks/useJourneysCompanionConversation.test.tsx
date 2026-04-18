import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  trackInteraction: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: { id: "companion-1" },
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackInteraction: mocks.trackInteraction,
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

import {
  JOURNEYS_COMPANION_OPENER,
  useJourneysCompanionConversation,
} from "./useJourneysCompanionConversation";

describe("useJourneysCompanionConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with the seeded opener message", () => {
    const { result } = renderHook(() => useJourneysCompanionConversation());

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe(JOURNEYS_COMPANION_OPENER);
  });

  it("appends a normal assistant reply and tags the request as journeys", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reply: "We can talk it through one step at a time.",
        speechText: "We can talk it through one step at a time.",
        handoffToPlanner: false,
        memoryUpdateApplied: false,
        sessionId: "session-2",
      },
      error: null,
    });

    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      result.current.setDraftInput("I need a little momentum");
    });

    await act(async () => {
      await result.current.submitTypedMessage();
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(3);
    });

    expect(mocks.invoke).toHaveBeenCalledWith("companion-chat", {
      body: expect.objectContaining({
        message: "I need a little momentum",
        surface: "journeys",
        companionId: "companion-1",
        inputMode: "text",
      }),
    });
    expect(result.current.messages[2]?.content).toBe("We can talk it through one step at a time.");
    expect(result.current.pendingPlannerHandoffMessage).toBeNull();
  });

  it("holds the transcript in chat mode until planning handoff is requested", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reply: "That sounds like planning work.",
        speechText: "That sounds like planning work.",
        handoffToPlanner: true,
        memoryUpdateApplied: false,
        sessionId: "session-3",
      },
      error: null,
    });

    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      result.current.setDraftInput("Help me plan tomorrow");
    });

    await act(async () => {
      await result.current.submitTypedMessage();
    });

    await waitFor(() => {
      expect(result.current.pendingPlannerHandoffMessage).toBe("Help me plan tomorrow");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]?.content).toBe("Help me plan tomorrow");
  });
});
