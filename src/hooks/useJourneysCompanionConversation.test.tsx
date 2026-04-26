import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPANION_PLANNER_OPENER_TEMPLATES,
  getCompanionPlannerOpener,
} from "@/shared/companionPlannerCopy";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  invalidateQueries: vi.fn(),
  trackInteraction: vi.fn(),
  toggleRecording: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
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

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    isRecording: false,
    isAutoStopping: false,
    isSupported: true,
    permissionStatus: "prompt" as const,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
    toggleRecording: mocks.toggleRecording,
    requestPermission: mocks.requestPermission,
  }),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mocks.invoke(...args),
    },
  },
}));

import {
  JOURNEYS_COMPANION_OPENERS,
  useJourneysCompanionConversation,
} from "./useJourneysCompanionConversation";

describe("useJourneysCompanionConversation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with a blank transcript without a hardcoded opener", () => {
    const { result } = renderHook(() => useJourneysCompanionConversation());

    expect(result.current.messages).toEqual([]);
    expect(result.current.greeting).toBe("");
    expect(getCompanionPlannerOpener({ userId: "user-1" })).toBe("");
    expect(COMPANION_PLANNER_OPENER_TEMPLATES).toEqual([]);
    expect(JOURNEYS_COMPANION_OPENERS).toEqual([]);
  });

  it("stays dormant when disabled until the fallback path needs it", async () => {
    const { result } = renderHook(() =>
      useJourneysCompanionConversation({ enabled: false })
    );

    expect(result.current.messages).toEqual([]);

    await act(async () => {
      await result.current.submitMessage("Keep me grounded.", "text");
    });

    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });

  it("preserves hydrated fallback thread state when re-enabled", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useJourneysCompanionConversation({ enabled }),
      {
        initialProps: { enabled: false },
      },
    );

    await act(async () => {
      result.current.hydrateThread({
        sessionId: "fallback-journeys-session",
        messages: [
          {
            id: "journeys-1",
            role: "assistant",
            content: "Let's keep this thread going.",
            createdAt: "2026-04-18T08:00:00.000Z",
          },
          {
            id: "journeys-2",
            role: "user",
            content: "I need a calmer plan.",
            createdAt: "2026-04-18T08:00:10.000Z",
            inputMode: "text",
          },
        ],
      });
    });

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.sessionId).toBe("fallback-journeys-session");
      expect(result.current.messages).toEqual([
        expect.objectContaining({
          id: "journeys-1",
          content: "Let's keep this thread going.",
        }),
        expect.objectContaining({
          id: "journeys-2",
          content: "I need a calmer plan.",
        }),
      ]);
    });
  });

  it("injects an explicit assistant opening into a blank thread", async () => {
    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      result.current.injectAssistantOpening("What's on your mind?");
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]).toMatchObject({
      role: "assistant",
      content: "What's on your mind?",
      isSeed: true,
    });
    expect(result.current.hasRealMessages).toBe(false);
  });

  it("seeds resetThread greeting text without counting it as a real exchange", async () => {
    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      result.current.resetThread({
        sessionId: "fresh-seeded-session",
        greetingText: "Fresh start. What's the move?",
      });
    });

    expect(result.current.sessionId).toBe("fresh-seeded-session");
    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: "assistant",
        content: "Fresh start. What's the move?",
        isSeed: true,
      }),
    ]);
    expect(result.current.hasRealMessages).toBe(false);
  });

  it("clears the transcript when resetThread is called without a greeting", async () => {
    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      result.current.resetThread({
        sessionId: "fresh-seeded-session",
        greetingText: "Fresh start. What's the move?",
      });
    });

    await act(async () => {
      result.current.resetThread({
        sessionId: "fresh-empty-session",
      });
    });

    expect(result.current.sessionId).toBe("fresh-empty-session");
    expect(result.current.messages).toEqual([]);
    expect(result.current.hasRealMessages).toBe(false);
  });

  it("omits seeded assistant openers from the submitted conversation history", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reply: "We can talk it through one step at a time.",
        speechText: "We can talk it through one step at a time.",
        handoffToPlanner: false,
        memoryUpdateApplied: false,
        persistenceReady: true,
        sessionId: "session-seeded-history",
      },
      error: null,
    });

    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      result.current.resetThread({
        sessionId: "fresh-seeded-session",
        greetingText: "Fresh start. What's the move?",
      });
      result.current.setDraftInput("I need a little momentum");
    });

    await act(async () => {
      await result.current.submitTypedMessage();
    });

    expect(mocks.invoke).toHaveBeenCalledWith("companion-chat", {
      body: expect.objectContaining({
        message: "I need a little momentum",
        conversationHistory: [],
      }),
    });
  });

  it("appends a normal assistant reply and tags the request as journeys", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reply: "We can talk it through one step at a time.",
        speechText: "We can talk it through one step at a time.",
        handoffToPlanner: false,
        memoryUpdateApplied: false,
        persistenceReady: true,
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
      expect(result.current.messages).toHaveLength(2);
    });

    expect(mocks.invoke).toHaveBeenCalledWith("companion-chat", {
      body: expect.objectContaining({
        message: "I need a little momentum",
        surface: "journeys",
        companionId: "companion-1",
        inputMode: "text",
      }),
    });
    expect(result.current.messages[1]?.content).toBe("We can talk it through one step at a time.");
    expect(result.current.messages[1]?.speechText).toBe("We can talk it through one step at a time.");
    expect(result.current.pendingPlannerHandoffMessage).toBeNull();
    expect(result.current.threadPersistenceReady).toBe(true);
  });

  it("passes through journeys schedule context when provided", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reply: "Your day has some room in it.",
        speechText: "Your day has some room in it.",
        handoffToPlanner: false,
        memoryUpdateApplied: false,
        persistenceReady: true,
        sessionId: "session-ctx",
      },
      error: null,
    });

    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      await result.current.submitMessage("How does today look?", "text", {
        currentDate: "2026-04-19",
        currentDateTime: "2026-04-19T10:28:00-07:00",
        journeysContext: {
          tasks: [],
          inboxTasks: [],
          activeEpics: [],
          calendarEvents: [],
          scheduleInsights: {
            horizon: "day",
            selectedDate: "2026-04-19",
            summary: "The day is light.",
            dayLoads: [],
            suggestedSlots: [],
            moveSuggestions: [],
          },
          plannerMemory: null,
        },
      });
    });

    expect(mocks.invoke).toHaveBeenCalledWith("companion-chat", {
      body: expect.objectContaining({
        currentDate: "2026-04-19",
        currentDateTime: "2026-04-19T10:28:00-07:00",
        journeysContext: expect.objectContaining({
          scheduleInsights: expect.objectContaining({
            summary: "The day is light.",
          }),
        }),
      }),
    });
  });

  it("holds the transcript in chat mode until planning handoff is requested", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reply: "That sounds like planning work.",
        speechText: "That sounds like planning work.",
        handoffToPlanner: true,
        memoryUpdateApplied: false,
        persistenceReady: true,
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

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0]?.content).toBe("Help me plan tomorrow");
  });

  it("keeps the live reply while marking thread persistence unavailable during rollout", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        reply: "We can still talk this through right here.",
        speechText: "We can still talk this through right here.",
        handoffToPlanner: false,
        memoryUpdateApplied: false,
        persistenceReady: false,
        sessionId: "session-rollout",
      },
      error: null,
    });

    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      await result.current.submitMessage("Keep me grounded.", "text");
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[1]?.content).toBe("We can still talk this through right here.");
    expect(result.current.threadPersistenceReady).toBe(false);
    expect(result.current.threadPersistenceUnavailableReason).toBe(
      "Thread history will be available after the latest backend update.",
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("shows a rollout-aware error when the companion chat function is missing", async () => {
    mocks.invoke.mockResolvedValue({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response("", { status: 404 }),
      },
    });

    const { result } = renderHook(() => useJourneysCompanionConversation());

    await act(async () => {
      await result.current.submitMessage("Are you there?", "text");
    });

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Companion Talk isn't live in this environment yet. Please try again after the backend is updated.",
      );
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]?.content).toContain("Cosmic static.");
  });
});
