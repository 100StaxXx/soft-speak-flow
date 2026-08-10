import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_CHAT_OPENING_LINES } from "@/shared/companionChatOpeners";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  listThreads: vi.fn(),
  loadThreadMessages: vi.fn(),
  loadPendingAction: vi.fn(),
  archiveThread: vi.fn().mockResolvedValue(undefined),
  generateThreadSessionId: vi.fn(() => "fresh-session"),
  speakCompanionReply: vi.fn().mockResolvedValue("device"),
  stopCompanionSpeech: vi.fn(),
  toggleRecording: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  refreshSession: vi.fn().mockResolvedValue(undefined),
  getSession: vi.fn(),
  supabaseInvoke: vi.fn(),
  invalidateQueries: vi.fn(),
  parseFunctionInvokeError: vi.fn().mockResolvedValue({
    status: 500,
    backendMessage: null,
    isOffline: false,
    category: "http",
  }),
  toUserFacingFunctionError: vi
    .fn()
    .mockReturnValue("Unable to send your message. Please try again."),
  trackInteraction: vi.fn().mockResolvedValue(undefined),
  legacySubmitMessage: vi.fn().mockResolvedValue(undefined),
  legacyConfirmPendingAction: vi.fn().mockResolvedValue(undefined),
  legacyCancelPendingAction: vi.fn().mockResolvedValue(undefined),
  legacyConfirmAllPendingActions: vi.fn().mockResolvedValue(undefined),
  legacyStartTemplateThread: vi.fn(),
  legacyHydrateFromUnifiedState: vi.fn(),
  legacyAdapterOptions: [] as Array<{ enabled?: boolean; surface?: string }>,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    refreshSession: mocks.refreshSession,
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: {
      id: "companion-1",
      companion_name: "Nova",
      cached_creature_name: null,
      spirit_animal: "fox",
    },
  }),
}));

vi.mock("@/hooks/useCompanionDialogue", () => ({
  useCompanionDialogue: () => ({
    greeting: "You made it back.",
    voiceStyle: "steady",
  }),
}));

vi.mock("@/hooks/useAIInteractionTracker", () => ({
  useAIInteractionTracker: () => ({
    trackInteraction: mocks.trackInteraction,
    updatePreferenceWeights: vi.fn(),
    trackEpicOutcome: vi.fn(),
    trackDailyPlanOutcome: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCompanionVoiceSettings", () => ({
  useCompanionVoiceSettings: () => ({
    autoplayVoice: false,
    muteSpokenReplies: false,
  }),
}));

vi.mock("@/hooks/useLegacyCompanionAssistantAdapter", () => ({
  useLegacyCompanionAssistantAdapter: (options: { enabled?: boolean; surface?: string }) => {
    mocks.legacyAdapterOptions.push(options);
    return {
      todayLabel: "Saturday, April 18",
      placeholder: "chat",
      messages: [],
      structuredResponse: null,
      currentDate: "2026-04-18",
      plannerContext: {
        tasks: [],
        inboxTasks: [],
        activeEpics: [],
        calendarEvents: [],
      },
      pendingAction: null,
      pendingActionCount: 0,
      readyPendingActionCount: 0,
      isOpeningThread: false,
      isSubmitting: false,
      isResolvingAction: false,
      submitMessage: mocks.legacySubmitMessage,
      confirmPendingAction: mocks.legacyConfirmPendingAction,
      cancelPendingAction: mocks.legacyCancelPendingAction,
      confirmAllPendingActions: mocks.legacyConfirmAllPendingActions,
      startTemplateThread: mocks.legacyStartTemplateThread,
      hydrateFromUnifiedState: mocks.legacyHydrateFromUnifiedState,
      isSpeaking: false,
      speechProvider: "none" as const,
      stopSpeaking: vi.fn(),
      activeThread: null,
      historyThreads: [],
      isLoadingThreads: false,
      hasPersistedActiveThread: false,
      canOpenThreadPicker: false,
      threadHistoryEmptyStateMessage:
        "Past chats will show up here after at least one real exchange.",
      resumeThread: vi.fn(),
      archiveCurrentThread: vi.fn(),
      canArchiveThread: false,
      archiveDisabledReason: null,
      startNewChat: vi.fn(),
      canStartNewChat: false,
      newChatDisabledReason: null,
    };
  },
}));

vi.mock("@/hooks/useVoiceInput", () => ({
  useVoiceInput: () => ({
    isRecording: false,
    isAutoStopping: false,
    isSupported: true,
    permissionStatus: "granted" as const,
    toggleRecording: mocks.toggleRecording,
    requestPermission: mocks.requestPermission,
  }),
}));

vi.mock("@/services/companionSpeech", () => ({
  speakCompanionReply: mocks.speakCompanionReply,
  stopCompanionSpeech: mocks.stopCompanionSpeech,
}));

vi.mock("@/services/companionChatThreads", () => ({
  buildCompanionThreadPreview: (value: string) => value,
  buildCompanionThreadTitle: (value: string) => value || "New thread",
  generateCompanionThreadSessionId: mocks.generateThreadSessionId,
  getCompanionChatThreadsQueryKey: () => ["companion-chat-threads"],
  listCompanionChatThreads: mocks.listThreads,
  loadCompanionChatThreadMessages: mocks.loadThreadMessages,
  loadCompanionPendingAction: mocks.loadPendingAction,
  readCompanionThreadReceiptProposalId: (
    receipt: { proposalId?: string | null } | null | undefined,
  ) => receipt?.proposalId ?? null,
  setCompanionChatThreadArchived: mocks.archiveThread,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    functions: {
      invoke: mocks.supabaseInvoke,
    },
  },
}));

vi.mock("@/utils/supabaseFunctionErrors", () => ({
  parseFunctionInvokeError: mocks.parseFunctionInvokeError,
  toUserFacingFunctionError: mocks.toUserFacingFunctionError,
}));

import { useCompanionAssistant } from "./useCompanionAssistant";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
};

const createDeferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

describe("useCompanionAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.legacyAdapterOptions = [];
    mocks.refreshSession.mockResolvedValue(undefined);
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token",
          user: { id: "user-1" },
        },
      },
      error: null,
    });
    mocks.generateThreadSessionId.mockReturnValue("fresh-session");
    mocks.listThreads.mockResolvedValue([
      {
        sessionId: "persisted-session",
        companionId: "companion-1",
        surface: "journeys",
        title: "Current thread",
        previewText: "What does tomorrow look like?",
        createdAt: "2026-04-18T08:00:00.000Z",
        lastMessageAt: "2026-04-18T08:01:00.000Z",
        archivedAt: null,
        messageCount: 2,
      },
    ]);
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "What does tomorrow look like?",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "agent",
      },
    ]);
    mocks.loadPendingAction.mockResolvedValue(null);
    mocks.supabaseInvoke.mockImplementation(async (functionName, options) => {
      if (functionName === "companion-chat-opener") {
        return {
          data: {
            sessionId: "fresh-session",
            reply: "Fresh read: today has a little shape to it.",
            speechText: "Fresh read: today has a little shape to it.",
            createdAt: "2026-04-18T08:03:00.000Z",
            persistenceReady: true,
            thread: {
              sessionId: "fresh-session",
              companionId: "companion-1",
              surface: "companion",
              title: "Fresh read: today has a little shape to it.",
              previewText: "Fresh read: today has a little shape to it.",
              createdAt: "2026-04-18T08:03:00.000Z",
              lastMessageAt: "2026-04-18T08:03:00.000Z",
              archivedAt: null,
              messageCount: 1,
            },
          },
          error: null,
        };
      }

      if (functionName === "companion-chat") {
        return {
          data: {
            reply: "Direct chat reply.",
            speechText: "Direct chat reply.",
            handoffToPlanner: false,
            memoryUpdateApplied: false,
            persistenceReady: true,
            sessionId: options?.body?.sessionId ?? "persisted-session",
          },
          error: null,
        };
      }

      return {
        data: {
          reply: "Tomorrow is pretty light.",
          mode: "schedule_read",
          intent: "check_calendar",
          confidence: 0.93,
          threadState: {
            threadId: options?.body?.sessionId ?? "persisted-session",
            sessionId: options?.body?.sessionId ?? "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_123",
            hasPendingAction: false,
          },
        },
        error: null,
      };
    });
  });

  it("hydrates the latest persisted thread and pending action", async () => {
    mocks.loadPendingAction.mockResolvedValue({
      id: "action-1",
      status: "pending",
      intent: "update_existing_plan",
      actionType: "task_update",
      summary: 'Move "Gym" to 2026-04-18 at 15:00.',
      confirmationMessage: 'Want me to move "Gym" to 2026-04-18 at 15:00?',
      normalizedPayload: {},
      affectedEntities: null,
      expiresAt: "2026-04-18T20:00:00.000Z",
      createdAt: "2026-04-18T08:02:00.000Z",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    expect(result.current.messages[0]?.content).toBe(
      "What does tomorrow look like?",
    );
    expect(result.current.pendingAction?.id).toBe("action-1");
  });

  it("restores persisted planner cards after a full reload", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "user",
        content: "Plan my day",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "agent",
      },
      {
        id: "m2",
        sessionId: "persisted-session",
        role: "assistant",
        content: "I prepared a focused day for you.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "plan_day",
          structuredResponse: {
            intent: {
              intentType: "quest",
              timeHorizon: "today",
              isRecurring: false,
              shouldCreateQuest: true,
              shouldPromptCampaign: false,
            },
            planDay: {
              message: "I prepared a focused day for you.",
              dayAssessment: "balanced",
              suggestedQuests: [
                {
                  suggestionId: "plan-1",
                  proposalId: "proposal-plan-1",
                  title: "Outline launch checklist",
                  type: "must",
                  estimatedDuration: "45 min",
                  estimatedDurationMinutes: 45,
                  source: "campaign",
                  reason: "It keeps launch moving.",
                },
                {
                  suggestionId: "plan-2",
                  proposalId: "proposal-plan-2",
                  title: "Review analytics notes",
                  type: "should",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "optimization",
                  reason: "It helps you tighten tomorrow's decisions.",
                },
              ],
            },
          },
        },
      },
    ]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    expect(
      result.current.structuredResponse?.planDay?.suggestedQuests,
    ).toHaveLength(2);
    expect(
      result.current.messages.some(
        (message) =>
          message.content === "I prepared a focused day for you." &&
          Boolean(message.structuredResponse?.planDay),
      ),
    ).toBe(true);

    mocks.supabaseInvoke.mockClear();
    await act(async () => {
      await result.current.submitMessage("schedule gym at 5", "text");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledTimes(1);
    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-chat",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "schedule gym at 5",
          currentDate: "2026-04-18",
          journeysContext: expect.objectContaining({
            tasks: [],
            inboxTasks: [],
            activeEpics: [],
            calendarEvents: [],
          }),
        }),
      }),
    );
    expect(
      mocks.supabaseInvoke.mock.calls.some(
        ([functionName]) => functionName === "companion-agent",
      ),
    ).toBe(false);
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
  });

  it("restores the latest persisted agent follow-up decision", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "user",
        content: "Plan my day",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "agent",
      },
      {
        id: "m2",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Do you want today to lean progress or recovery?",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "clarify",
          intent: "plan_day",
          agentDecision: {
            understandingState: "needs_followup",
            followUp: {
              question: "Do you want today to lean progress or recovery?",
              reason: "Your calendar has room for either shape.",
              expectedAnswerType: "choice",
              options: ["Progress", "Recovery"],
            },
            assumptions: ["Calendar blocks are fixed."],
            evidenceIds: ["task-1"],
          },
        },
      },
    ]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    expect(result.current.understandingState).toBe("needs_followup");
    expect(result.current.activeFollowUp?.question).toBe(
      "Do you want today to lean progress or recovery?",
    );
    expect(result.current.activeFollowUp?.options).toEqual([
      "Progress",
      "Recovery",
    ]);
    expect(result.current.placeholder).toBe("Answer Nova's follow-up.");
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        understandingState: "needs_followup",
        followUp: expect.objectContaining({
          expectedAnswerType: "choice",
        }),
        assumptions: ["Calendar blocks are fixed."],
        evidenceIds: ["task-1"],
      }),
    );

    const answeredListener = vi.fn();
    window.addEventListener(
      "companion-plan-my-day-ai-answered",
      answeredListener,
    );

    await act(async () => {
      await result.current.submitMessage("Progress", "text");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Progress",
          activeFollowUp: expect.objectContaining({
            question: "Do you want today to lean progress or recovery?",
            expectedAnswerType: "choice",
          }),
        }),
      }),
    );
    expect(answeredListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(
      "companion-plan-my-day-ai-answered",
      answeredListener,
    );
  });

  it("hydrates the legacy adapter from the current agent thread before switching fallback modes", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Let's sort the day from here.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
      },
    ]);
    mocks.supabaseInvoke.mockRejectedValueOnce(new Error("agent unavailable"));
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      status: 404,
      backendMessage: null,
      name: "FunctionsHttpError",
      message: "Function not found",
      responsePayload: {
        code: "function_not_found",
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text", {
        starterIntent: "plan_day",
      });
    });

    expect(mocks.legacyHydrateFromUnifiedState).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "persisted-session",
        messages: expect.arrayContaining([
          expect.objectContaining({
            id: "m1",
            content: "Let's sort the day from here.",
            role: "assistant",
            source: "agent",
          }),
          expect.objectContaining({
            content: "Plan my day",
            role: "user",
            source: "agent",
            inputMode: "text",
          }),
        ]),
      }),
    );
  });

  it("submits unified turns through companion-agent and appends the reply", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage(
        "What does tomorrow look like?",
        "text",
      );
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "persisted-session",
          message: "What does tomorrow look like?",
          surface: "journeys",
        }),
      }),
    );

    expect(result.current.messages.at(-1)?.content).toBe(
      "Tomorrow is pretty light.",
    );
    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([name]) => name,
    );
    expect(invokedFunctionNames).not.toContain("companion-chat");
    expect(invokedFunctionNames).not.toContain("companion-planner-chat");
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_agent",
        inputText: "What does tomorrow look like?",
        detectedIntent: "check_calendar",
        userAction: "accepted",
        modifications: expect.objectContaining({
          surface: "journeys",
          starterIntent: null,
        }),
      }),
    );
  });

  it("routes casual unified chat through companion-chat instead of companion-agent", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });

    await act(async () => {
      await result.current.submitMessage("Not much. How are you?", "text");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-chat",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "fresh-session",
          message: "Not much. How are you?",
          surface: "companion",
        }),
      }),
    );
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: "Direct chat reply.",
        role: "assistant",
        source: "chat",
      }),
    );
    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([name]) => name,
    );
    expect(invokedFunctionNames).not.toContain("companion-agent");
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_chat",
        inputText: "Not much. How are you?",
        detectedIntent: "conversation",
      }),
    );
  });

  it("clears submit state after the assistant bubble is appended without waiting for tracking", async () => {
    const tracking = createDeferred<void>();
    mocks.trackInteraction.mockImplementationOnce(() => tracking.promise);
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });

    await act(async () => {
      const submitted = await result.current.submitMessage(
        "Not much. How are you?",
        "text",
      );
      expect(submitted).toBe(true);
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.messages.at(-1)).toEqual(
      expect.objectContaining({
        content: "Direct chat reply.",
        role: "assistant",
        source: "chat",
      }),
    );
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_chat",
        inputText: "Not much. How are you?",
      }),
    );

    tracking.resolve();
  });

  it("does not refresh global auth state before submit when an active token exists", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });

    await act(async () => {
      const submitted = await result.current.submitMessage(
        "Not much. How are you?",
        "text",
      );
      expect(submitted).toBe(true);
    });

    expect(mocks.refreshSession).not.toHaveBeenCalled();
    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-chat",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Not much. How are you?",
        }),
      }),
    );
  });

  it("keeps external info questions with date language in direct Companion chat", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });
    expect(result.current.activeThread?.sessionId).toBe("fresh-session");

    await act(async () => {
      await result.current.submitMessage(
        "What's the weather gonna be like this weekend",
        "text",
      );
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-chat",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "fresh-session",
          message: "What's the weather gonna be like this weekend",
          surface: "companion",
        }),
      }),
    );
    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([name]) => name,
    );
    expect(invokedFunctionNames).not.toContain("companion-agent");
    expect(result.current.structuredResponse).toBeNull();
    expect(result.current.pendingAction).toBeNull();
  });

  it("keeps the typed Companion chat turn visible when session refresh cannot recover a token", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });

    let submitted: boolean | undefined;
    await act(async () => {
      submitted = await result.current.submitMessage("Not much. How are you?");
    });

    expect(submitted).toBe(false);
    expect(mocks.supabaseInvoke).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Your session has expired. Please sign in again and try to talk with your companion.",
    );
    expect(
      result.current.messages.some(
        (message) => message.content === "Not much. How are you?",
      ),
    ).toBe(true);
    expect(result.current.isSubmitting).toBe(false);
  });

  it("submits explicit Companion write requests through companion-agent without legacy endpoints", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });
    expect(result.current.activeThread?.sessionId).toBe("fresh-session");

    await act(async () => {
      await result.current.submitMessage(
        "Create a quest to reflect tomorrow",
        "text",
      );
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "fresh-session",
          message: "Create a quest to reflect tomorrow",
          surface: "companion",
        }),
      }),
    );
    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([name]) => name,
    );
    expect(invokedFunctionNames).not.toContain("companion-chat");
    expect(invokedFunctionNames).not.toContain("companion-planner-chat");
    expect(invokedFunctionNames).not.toContain("companion-chat-opener");
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
  });

  it("starts a local companion opener on every closed-to-open cycle", async () => {
    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useCompanionAssistant({
          surface: "companion",
          conversationEnabled: enabled,
        }),
      {
        wrapper,
        initialProps: { enabled: false },
      },
    );

    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-chat-opener",
      expect.anything(),
    );

    rerender({ enabled: true });
    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });
    expect(result.current.messages).toHaveLength(1);

    rerender({ enabled: false });
    rerender({ enabled: true });
    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });
    expect(result.current.messages).toHaveLength(1);
    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-chat-opener",
      expect.anything(),
    );
  });

  it("does not request a Supabase opener when starting companion chat", async () => {
    const localOpening = COMPANION_CHAT_OPENING_LINES[0];
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    try {
      await waitFor(() => {
        expect(
          result.current.messages.map((message) => message.content),
        ).toEqual([localOpening]);
      });

      expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
        "companion-chat-opener",
        expect.anything(),
      );
    } finally {
      randomSpy.mockRestore();
    }
  });

  it("keeps the local opener when the user sends quickly", async () => {
    mocks.supabaseInvoke.mockImplementation((functionName, options) => {
      if (functionName === "companion-chat") {
        return Promise.resolve({
          data: {
            reply: "Direct chat reply.",
            speechText: "Direct chat reply.",
            handoffToPlanner: false,
            memoryUpdateApplied: false,
            persistenceReady: true,
            sessionId: options?.body?.sessionId ?? "fresh-session",
          },
          error: null,
        });
      }

      return Promise.resolve({
        data: {
          reply: "Reply",
          mode: "conversation",
          intent: "unknown",
          confidence: 0.9,
          threadState: {
            threadId: options?.body?.sessionId ?? "fresh-session",
            sessionId: options?.body?.sessionId ?? "fresh-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_123",
            hasPendingAction: false,
          },
        },
        error: null,
      });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });
    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-chat-opener",
      expect.anything(),
    );
    expect(result.current.canSubmitMessage).toBe(true);

    await act(async () => {
      const submitted = await result.current.submitMessage("Can we talk?");
      expect(submitted).toBe(true);
    });

    expect(result.current.activeThread?.sessionId).toBe("fresh-session");
    expect(result.current.messages.map((message) => message.content)).toEqual(
      expect.arrayContaining(["Can we talk?", "Direct chat reply."]),
    );
    expect(
      mocks.supabaseInvoke.mock.calls.some(
        ([functionName]) => functionName === "companion-chat-opener",
      ),
    ).toBe(false);
  });

  it("uses the local opener path when starting a new companion chat", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });

    await act(async () => {
      await result.current.startNewChat();
    });

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });
    expect(result.current.messages).toHaveLength(1);
    expect(mocks.archiveThread).not.toHaveBeenCalled();
    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-chat-opener",
      expect.anything(),
    );
  });

  it("keeps the local companion opener without surfacing opener internals", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    mocks.supabaseInvoke.mockImplementation(async (functionName) => {
      return {
        data: {
          reply: "Reply",
          mode: "conversation",
          intent: "unknown",
          confidence: 0.9,
          threadState: {
            threadId: "fresh-session",
            sessionId: "fresh-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_123",
            hasPendingAction: false,
          },
        },
        error: null,
      };
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });

    expect(COMPANION_CHAT_OPENING_LINES).toContain(
      result.current.messages[0]?.content,
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(result.current.canSubmitMessage).toBe(true);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      "Generated companion opener unavailable; using local opener.",
      expect.anything(),
    );

    await act(async () => {
      const submitted = await result.current.submitMessage("Can we talk?");
      expect(submitted).toBe(true);
    });

    expect(
      mocks.supabaseInvoke.mock.calls.some(
        ([functionName]) => functionName === "companion-chat",
      ),
    ).toBe(true);
    expect(
      mocks.supabaseInvoke.mock.calls.some(
        ([functionName]) => functionName === "companion-agent",
      ),
    ).toBe(false);
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it("keeps the local opener usable when chat reply persistence is not ready", async () => {
    mocks.supabaseInvoke.mockImplementation(async (functionName) => {
      if (functionName === "companion-chat") {
        return {
          data: {
            reply: "Direct chat reply.",
            speechText: "Direct chat reply.",
            handoffToPlanner: false,
            memoryUpdateApplied: false,
            persistenceReady: false,
            sessionId: "fresh-session",
          },
          error: null,
        };
      }

      return {
        data: {
          reply: "Reply",
          mode: "conversation",
          intent: "unknown",
          confidence: 0.9,
          threadState: {
            threadId: "fresh-session",
            sessionId: "fresh-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_123",
            hasPendingAction: false,
          },
        },
        error: null,
      };
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(COMPANION_CHAT_OPENING_LINES).toContain(
        result.current.messages[0]?.content,
      );
    });

    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(result.current.canSubmitMessage).toBe(true);

    await act(async () => {
      const submitted = await result.current.submitMessage("Can we talk?");
      expect(submitted).toBe(true);
    });

    expect(
      mocks.supabaseInvoke.mock.calls.some(
        ([functionName]) => functionName === "companion-chat",
      ),
    ).toBe(true);
    expect(
      mocks.supabaseInvoke.mock.calls.some(
        ([functionName]) => functionName === "companion-agent",
      ),
    ).toBe(false);
  });

  it("keeps conversational Journeys replies conversational", async () => {
    mocks.supabaseInvoke.mockImplementation(async (functionName, options) => {
      return {
        data: {
          reply: "That sounds like a clean thing to put on the board.",
          mode: "conversation",
          intent: "unknown",
          confidence: 0.9,
          understandingState: "enough_to_discuss",
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_123",
            hasPendingAction: false,
          },
        },
        error: null,
      };
    });
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage(
        "Review launch notes tomorrow",
        "text",
      );
    });

    await waitFor(() => {
      expect(result.current.messages.at(-1)?.content).toBe(
        "That sounds like a clean thing to put on the board.",
      );
    });
    expect(result.current.messages.at(-1)?.content).toBe(
      "That sounds like a clean thing to put on the board.",
    );
  });

  it("marks typed composer submissions with the composer turn origin", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    act(() => {
      result.current.setDraftInput("Can we talk through today?");
    });

    await act(async () => {
      await result.current.submitTypedMessage();
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Can we talk through today?",
          turnOrigin: "composer",
        }),
      }),
    );
  });

  it("routes typed Journeys upcoming schedule reads through the local planner context on demand", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });
    expect(mocks.legacyAdapterOptions.at(-1)).toEqual(
      expect.objectContaining({
        enabled: true,
        surface: "journeys",
      }),
    );

    act(() => {
      result.current.setDraftInput("What do I have coming up?");
    });

    await act(async () => {
      await result.current.submitTypedMessage();
    });

    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-agent",
      expect.anything(),
    );
    expect(mocks.legacyHydrateFromUnifiedState).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "persisted-session",
      }),
    );
    expect(mocks.legacyStartTemplateThread).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
        "What do I have coming up?",
        "text",
        expect.objectContaining({
          starterIntent: "upcoming_start",
        }),
      );
    });
    expect(mocks.legacyAdapterOptions.at(-1)).toEqual(
      expect.objectContaining({
        enabled: true,
        surface: "journeys",
      }),
    );
  });

  it("sends the default selected date to local Journeys upcoming reads", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          defaultSelectedDate: "2026-02-13",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    act(() => {
      result.current.setDraftInput("What do I have coming up?");
    });

    await act(async () => {
      await result.current.submitTypedMessage();
    });

    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-agent",
      expect.anything(),
    );
    await waitFor(() => {
      expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
        "What do I have coming up?",
        "text",
        expect.objectContaining({
          starterIntent: "upcoming_start",
          selectedDate: "2026-02-13",
        }),
      );
    });
  });

  it("marks follow-up option submissions with the follow-up turn origin", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage("Recovery", "text", {
        turnOrigin: "follow_up_option",
      });
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Recovery",
          turnOrigin: "follow_up_option",
        }),
      }),
    );
  });

  it("shows user-facing function errors without adding a synthetic assistant turn", async () => {
    const networkError = Object.assign(
      new Error("Failed to send a request to the Edge Function"),
      { name: "FunctionsFetchError" },
    );
    mocks.supabaseInvoke.mockRejectedValueOnce(networkError);
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      name: "FunctionsFetchError",
      message: "Failed to send a request to the Edge Function",
      status: undefined,
      backendMessage: null,
      isOffline: false,
      category: "network",
    });
    mocks.toUserFacingFunctionError.mockReturnValueOnce(
      "We couldn't reach the server to send your message. Check your connection and try again.",
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    let submitted: boolean | undefined;
    await act(async () => {
      submitted = await result.current.submitMessage("Plan my day", "text");
    });

    expect(submitted).toBe(false);
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
    expect(mocks.toUserFacingFunctionError).toHaveBeenCalledWith(
      expect.objectContaining({ category: "network" }),
      { action: "send your message" },
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "We couldn't reach the server to send your message. Check your connection and try again.",
    );
    expect(
      result.current.messages.some((message) =>
        message.content.includes("lost the thread"),
      ),
    ).toBe(false);
  });

  it("logs parsed companion-agent HTTP failures with safe diagnostic metadata", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const httpError = Object.assign(
      new Error("Edge Function returned a non-2xx status code"),
      { name: "FunctionsHttpError" },
    );
    mocks.supabaseInvoke.mockRejectedValueOnce(httpError);
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      status: 503,
      code: "ABUSE_CHECK_FAILED",
      requestId: "req-companion-agent-1",
      responsePayload: {
        code: "ABUSE_CHECK_FAILED",
        error: "Request could not be processed right now",
        requestId: "req-companion-agent-1",
      },
      backendMessage: "Request could not be processed right now",
      isOffline: false,
      category: "http",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text");
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to submit companion agent message:",
      expect.objectContaining({
        status: 503,
        code: "ABUSE_CHECK_FAILED",
        requestId: "req-companion-agent-1",
        category: "http",
        surface: "journeys",
        sessionId: "persisted-session",
        fallbackToLegacy: false,
      }),
    );

    consoleError.mockRestore();
  });

  it("shows a companion-agent setup message for backend setup failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.supabaseInvoke.mockRejectedValueOnce(
      Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        name: "FunctionsHttpError",
      }),
    );
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      status: 503,
      code: "ABUSE_CHECK_FAILED",
      responsePayload: {
        code: "ABUSE_CHECK_FAILED",
        error: "Request could not be processed right now",
      },
      backendMessage: "Request could not be processed right now",
      isOffline: false,
      category: "http",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    let submitted: boolean | undefined;
    await act(async () => {
      submitted = await result.current.submitMessage("Plan my day", "text");
    });

    expect(submitted).toBe(false);
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Companion Agent is still being set up here. Please try again after the latest backend update.",
    );
    consoleError.mockRestore();
  });

  it("shows a setup message for namespaced companion-agent schema mismatch failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mocks.supabaseInvoke.mockRejectedValueOnce(
      Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        name: "FunctionsHttpError",
      }),
    );
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      status: 500,
      code: "COMPANION_AGENT_FAILED",
      requestId: "f67d4e8d-5794-42b0-86ed-fc8643136b6a",
      stage: "agent_run",
      failureReason: "context_load.schema_mismatch",
      responsePayload: {
        code: "COMPANION_AGENT_FAILED",
        error: "Companion agent hit a snag. Please try again.",
        requestId: "f67d4e8d-5794-42b0-86ed-fc8643136b6a",
        stage: "agent_run",
        failureReason: "context_load.schema_mismatch",
      },
      backendMessage: "Companion agent hit a snag. Please try again.",
      isOffline: false,
      category: "http",
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    let submitted: boolean | undefined;
    await act(async () => {
      submitted = await result.current.submitMessage("Plan my day", "text");
    });

    expect(submitted).toBe(false);
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Companion Agent is still being set up here. Please try again after the latest backend update.",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to submit companion agent message:",
      expect.objectContaining({
        code: "COMPANION_AGENT_FAILED",
        failureReason: "context_load.schema_mismatch",
        fallbackToLegacy: false,
      }),
    );
    consoleError.mockRestore();
  });

  it("uses the local upcoming digest for launcher upcoming reads", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    let submitted: boolean | undefined;
    await act(async () => {
      submitted = await result.current.submitMessage(
        "What do I have coming up?",
        "text",
        { starterIntent: "upcoming_start", turnOrigin: "launcher" },
      );
    });

    expect(submitted).toBe(true);
    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-agent",
      expect.anything(),
    );
    await waitFor(() => {
      expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
        "What do I have coming up?",
        "text",
        expect.objectContaining({
          starterIntent: "upcoming_start",
          turnOrigin: "launcher",
        }),
      );
    });
    expect(mocks.legacyStartTemplateThread).toHaveBeenCalledWith({
      greetingText: null,
    });
    expect(mocks.legacyHydrateFromUnifiedState).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      "Companion agent hit a snag. Please try again.",
    );
  });

  it("handles launcher upcoming reads without waiting for thread hydration", async () => {
    mocks.listThreads.mockImplementation(
      () => new Promise(() => undefined),
    );
    const consumed = vi.fn();
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-upcoming-1",
            message: "What do I have coming up?",
            starterIntent: "upcoming_start",
            target: "planner",
          },
          onLaunchIntentConsumed: consumed,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
        "What do I have coming up?",
        "text",
        expect.objectContaining({
          starterIntent: "upcoming_start",
          turnOrigin: "launcher",
        }),
      );
    });
    expect(mocks.legacyStartTemplateThread).toHaveBeenCalledWith({
      greetingText: null,
    });
    expect(mocks.supabaseInvoke).not.toHaveBeenCalledWith(
      "companion-agent",
      expect.anything(),
    );
    expect(consumed).toHaveBeenCalledWith("launch-upcoming-1");
  });

  it("confirms the active pending action through the deterministic executor path", async () => {
    mocks.loadPendingAction.mockResolvedValue({
      id: "action-1",
      status: "pending",
      intent: "update_existing_plan",
      actionType: "task_update",
      summary: 'Move "Gym" to 2026-04-18 at 15:00.',
      confirmationMessage: 'Want me to move "Gym" to 2026-04-18 at 15:00?',
      normalizedPayload: {},
      affectedEntities: null,
      expiresAt: "2026-04-18T20:00:00.000Z",
      createdAt: "2026-04-18T08:02:00.000Z",
    });
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply: 'Got it — "Gym" added for 3:00 PM.',
        mode: "receipt",
        intent: "schedule_task",
        confidence: 1,
        receipt: {
          actionId: "action-1",
          status: "executed",
          message: 'Got it — "Gym" added for 3:00 PM.',
          summary: 'Add "Gym" for 2026-04-18 at 15:00.',
          createdAt: "2026-04-18T08:04:00.000Z",
        },
        threadState: {
          threadId: "persisted-session",
          sessionId: "persisted-session",
          openaiConversationId: "conv_123",
          lastOpenAIResponseId: "resp_124",
          hasPendingAction: false,
        },
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.pendingAction?.id).toBe("action-1");
    });

    const savedListener = vi.fn();
    window.addEventListener(
      "companion-plan-my-day-action-saved",
      savedListener,
    );

    await act(async () => {
      await result.current.confirmPendingAction();
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent-action",
      expect.objectContaining({
        body: {
          sessionId: "persisted-session",
          actionId: "action-1",
          action: "confirm",
        },
      }),
    );
    expect(result.current.pendingAction).toBeNull();
    expect(result.current.messages.at(-1)?.content).toBe(
      'Got it — "Gym" added for 3:00 PM.',
    );
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_agent_confirmation",
        inputText: 'Move "Gym" to 2026-04-18 at 15:00.',
        detectedIntent: "task_update",
        userAction: "accepted",
        modifications: expect.objectContaining({
          actionId: "action-1",
          confirmationMode: "confirm",
          surface: "journeys",
        }),
      }),
    );
    expect(savedListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(
      "companion-plan-my-day-action-saved",
      savedListener,
    );
  });

  it("tracks cancelled pending actions as rejected companion-agent decisions", async () => {
    mocks.loadPendingAction.mockResolvedValue({
      id: "action-2",
      status: "pending",
      intent: "schedule_task",
      actionType: "task_update",
      summary: 'Move "Gym" to 2026-04-19 at 15:00.',
      confirmationMessage: 'Want me to move "Gym" to tomorrow at 3:00 PM?',
      normalizedPayload: {},
      affectedEntities: null,
      expiresAt: "2026-04-18T20:00:00.000Z",
      createdAt: "2026-04-18T08:02:00.000Z",
    });
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply: "Okay, I left that alone.",
        mode: "receipt",
        intent: "update_existing_plan",
        confidence: 1,
        receipt: {
          actionId: "action-2",
          status: "cancelled",
          message: "Okay, I left that alone.",
          summary: 'Move "Gym" to 2026-04-19 at 15:00.',
          createdAt: "2026-04-18T08:04:00.000Z",
        },
        threadState: {
          threadId: "persisted-session",
          sessionId: "persisted-session",
          openaiConversationId: "conv_123",
          lastOpenAIResponseId: "resp_124",
          hasPendingAction: false,
        },
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.pendingAction?.id).toBe("action-2");
    });

    await act(async () => {
      await result.current.cancelPendingAction();
    });

    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_agent_confirmation",
        inputText: 'Move "Gym" to 2026-04-19 at 15:00.',
        detectedIntent: "task_update",
        userAction: "rejected",
        modifications: expect.objectContaining({
          actionId: "action-2",
          confirmationMode: "cancel",
          surface: "journeys",
        }),
      }),
    );
  });

  it("falls back to the legacy adapter when the agent endpoint is unavailable", async () => {
    mocks.supabaseInvoke.mockRejectedValueOnce(new Error("agent unavailable"));
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      status: 404,
      backendMessage: null,
      name: "FunctionsHttpError",
      message: "Function not found",
      responsePayload: {
        code: "function_not_found",
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage(
        "What does tomorrow look like?",
        "text",
      );
    });

    expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
      "What does tomorrow look like?",
      "text",
      undefined,
    );
  });

  it("preserves starter intent when falling back to the legacy adapter", async () => {
    mocks.supabaseInvoke.mockRejectedValueOnce(new Error("agent unavailable"));
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      status: 404,
      backendMessage: null,
      name: "FunctionsHttpError",
      message: "Function not found",
      responsePayload: {
        code: "function_not_found",
      },
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text", {
        starterIntent: "plan_day",
      });
    });

    expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
      "Plan my day",
      "text",
      { starterIntent: "plan_day" },
    );
  });

  it("passes launcher starter intents through to companion-agent requests", async () => {
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-1",
            message: "Plan my day",
            starterIntent: "plan_day",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
        "companion-agent",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "Plan my day",
            starterIntent: "plan_day",
            turnOrigin: "launcher",
          }),
        }),
      );
    });
  });

  it("uses the default selected date for launcher planner intents", async () => {
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          defaultSelectedDate: "2026-02-13",
          launchIntent: {
            id: "launch-selected-date-1",
            message: "Plan my day",
            starterIntent: "plan_day",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
        "companion-agent",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "Plan my day",
            starterIntent: "plan_day",
            selectedDate: "2026-02-13",
            turnOrigin: "launcher",
          }),
        }),
      );
    });
  });

  it("sends plan-day snapshot context to the conversational agent", async () => {
    const consumed = vi.fn();
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-snapshot-plan-1",
            message: "Plan my day",
            starterIntent: "plan_day",
            target: "planner",
            selectedDate: "2026-02-13",
            briefingContext: {
              content:
                "Friday, February 13 looks light: 2 open quests, both already timed, with about 1h planned.",
              dataSnapshot: {
                selectedDate: "2026-02-13",
                openQuestCount: 2,
                plannerInsightStatement:
                  "You have a manageable list and the important pieces are timed.",
              },
            },
          },
          onLaunchIntentConsumed: consumed,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(consumed).toHaveBeenCalledWith("launch-snapshot-plan-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Plan my day",
          starterIntent: "plan_day",
          turnOrigin: "launcher",
          selectedDate: "2026-02-13",
          briefingContext: expect.objectContaining({
            dataSnapshot: expect.objectContaining({ openQuestCount: 2 }),
          }),
        }),
      }),
    );
    expect(result.current.activeThread?.sessionId).toBe("fresh-session");
    expect(result.current.messages.some((message) => message.content === "Plan my day")).toBe(true);

    mocks.supabaseInvoke.mockClear();
    await act(async () => {
      await result.current.submitMessage("Make it lighter", "text");
    });

    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([functionName]) => functionName,
    );
    expect(invokedFunctionNames).toEqual(["companion-agent"]);
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
    expect(result.current.pendingAction).toBeNull();
  });

  it("opens free-talk launcher templates as companion-authored visible openers", async () => {
    const consumed = vi.fn();
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-free-talk-1",
            message: "What's good, buddy?",
            starterIntent: "free_talk_start",
            target: "conversation",
          },
          onLaunchIntentConsumed: consumed,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(consumed).toHaveBeenCalledWith("launch-free-talk-1");
    });

    expect(mocks.supabaseInvoke).not.toHaveBeenCalled();
    expect(result.current.activeThread?.sessionId).toBe("fresh-session");
    expect(result.current.messages).toEqual([
      expect.objectContaining({
        role: "assistant",
        content: "What's good, buddy?",
        source: "agent",
      }),
    ]);
    expect(result.current.messages[0]?.isSeed).toBeUndefined();

    await waitFor(() => {
      expect(mocks.archiveThread).toHaveBeenCalledWith(
        "persisted-session",
        true,
      );
    });
  });

  it("keeps plan-day briefing context on follow-up replies", async () => {
    const briefingContext = {
      content:
        "Friday, February 13 looks steady: 4 open quests, 2 timed and 2 anytime, with about 2h planned.",
      focus: "Keep the day realistic.",
      actionPrompt: "Preserve timed quests and avoid overload.",
      dataSnapshot: {
        selectedDate: "2026-02-13",
        openQuestCount: 4,
      },
    };

    mocks.supabaseInvoke
      .mockResolvedValueOnce({
        data: {
          reply: "How much energy do you have for this plan?",
          mode: "clarify",
          intent: "plan_day",
          confidence: 0.75,
          understandingState: "needs_followup",
          followUp: {
            question: "How much energy do you have for this plan?",
            reason: null,
            expectedAnswerType: "choice",
            options: ["Low", "Medium", "High"],
            metadata: {
              questionId: "details",
              selectedDate: "2026-02-13",
              briefingContext,
            },
          },
          assumptions: [],
          evidenceIds: [],
          threadState: {
            threadId: "fresh-session",
            sessionId: "fresh-session",
            openaiConversationId: null,
            lastOpenAIResponseId: null,
            hasPendingAction: false,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          reply: "Here is the lighter plan.",
          mode: "schedule_read",
          intent: "plan_day",
          confidence: 0.8,
          understandingState: "ready_to_propose",
          assumptions: [],
          evidenceIds: [],
          threadState: {
            threadId: "fresh-session",
            sessionId: "fresh-session",
            openaiConversationId: null,
            lastOpenAIResponseId: null,
            hasPendingAction: false,
          },
        },
        error: null,
      });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage(
        "Plan my day for Friday, February 13",
        "text",
        {
          starterIntent: "plan_day",
          selectedDate: "2026-02-13",
          briefingContext,
        },
      );
    });

    await waitFor(() => {
      expect(result.current.activeFollowUp?.question).toBe(
        "How much energy do you have for this plan?",
      );
    });

    await act(async () => {
      await result.current.submitMessage("Low", "text", {
        turnOrigin: "follow_up_option",
      });
    });

    expect(mocks.supabaseInvoke).toHaveBeenLastCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Low",
          selectedDate: "2026-02-13",
          briefingContext,
        }),
      }),
    );
  });

  it("defers persisted bootstrap while a launcher template intent is pending", async () => {
    mocks.supabaseInvoke.mockImplementation(async (_functionName, options) => {
      const sessionId = options?.body?.sessionId ?? "missing-session";

      return {
        data: {
          reply: "I drafted a focused day for you.",
          mode: "schedule_read",
          intent: "plan_day",
          confidence: 0.93,
          threadState: {
            threadId: sessionId,
            sessionId,
            openaiConversationId: "conv_fresh",
            lastOpenAIResponseId: "resp_fresh",
            hasPendingAction: false,
          },
        },
        error: null,
      };
    });

    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-skip-bootstrap-1",
            message: "Plan my day",
            starterIntent: "plan_day",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
        "companion-agent",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "Plan my day",
            sessionId: "fresh-session",
            starterIntent: "plan_day",
          }),
        }),
      );
    });

    expect(mocks.archiveThread).toHaveBeenCalledWith("persisted-session", true);
    expect(mocks.loadThreadMessages).not.toHaveBeenCalled();
  });

  it("keeps launcher template turns on a fresh thread when persisted hydration resolves late", async () => {
    let resolveHydration: (
      messages: Awaited<ReturnType<typeof mocks.loadThreadMessages>>,
    ) => void = () => {};

    mocks.loadThreadMessages.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveHydration = resolve;
      }),
    );
    mocks.supabaseInvoke.mockImplementation(async (_functionName, options) => {
      const sessionId = options?.body?.sessionId ?? "missing-session";

      return {
        data: {
          reply: "I drafted a focused day for you.",
          mode: "schedule_read",
          intent: "plan_day",
          confidence: 0.93,
          threadState: {
            threadId: sessionId,
            sessionId,
            openaiConversationId: "conv_fresh",
            lastOpenAIResponseId: "resp_fresh",
            hasPendingAction: false,
          },
        },
        error: null,
      };
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-fresh-thread-1",
            message: "Plan my day",
            starterIntent: "plan_day",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
        "companion-agent",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "Plan my day",
            sessionId: "fresh-session",
            starterIntent: "plan_day",
          }),
        }),
      );
    });

    expect(mocks.archiveThread).toHaveBeenCalledWith("persisted-session", true);

    await act(async () => {
      resolveHydration([
        {
          id: "late-m1",
          sessionId: "persisted-session",
          role: "assistant",
          content: "This old thread should not reopen.",
          createdAt: "2026-04-18T08:00:00.000Z",
          source: "agent",
        },
      ]);
    });

    expect(result.current.activeThread?.sessionId).toBe("fresh-session");
    expect(
      result.current.messages.some(
        (message) => message.content === "This old thread should not reopen.",
      ),
    ).toBe(false);
  });

  it("starts a unified template thread locally before archival finishes", async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    let nextSessionId: string | undefined;
    act(() => {
      nextSessionId = result.current.startTemplateThread({
        greetingText: null,
      });
    });

    expect(nextSessionId).toBe("fresh-session");
    expect(result.current.activeThread?.sessionId).toBe("fresh-session");
    expect(result.current.messages).toEqual([]);

    await waitFor(() => {
      expect(mocks.archiveThread).toHaveBeenCalledWith(
        "persisted-session",
        true,
      );
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["companion-chat-threads"],
    });
  });

  it("keeps direct template threads fresh when persisted hydration resolves late", async () => {
    let resolveHydration: (
      messages: Awaited<ReturnType<typeof mocks.loadThreadMessages>>,
    ) => void = () => {};

    mocks.loadThreadMessages.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveHydration = resolve;
      }),
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.loadThreadMessages).toHaveBeenCalledWith(
        "persisted-session",
        "journeys",
      );
    });

    act(() => {
      result.current.startTemplateThread({ greetingText: null });
    });

    await act(async () => {
      resolveHydration([
        {
          id: "late-m1",
          sessionId: "persisted-session",
          role: "assistant",
          content: "This old thread should not reopen.",
          createdAt: "2026-04-18T08:00:00.000Z",
          source: "agent",
        },
      ]);
    });

    expect(result.current.activeThread?.sessionId).toBe("fresh-session");
    expect(
      result.current.messages.some(
        (message) => message.content === "This old thread should not reopen.",
      ),
    ).toBe(false);
  });

  it("consumes launcher intents when starting the fresh thread fails", async () => {
    const consumed = vi.fn();
    const archiveError = Object.assign(
      new Error("Failed to send a request to the Edge Function"),
      { name: "FunctionsFetchError" },
    );
    mocks.archiveThread.mockRejectedValueOnce(archiveError);
    mocks.parseFunctionInvokeError.mockResolvedValueOnce({
      name: "FunctionsFetchError",
      message: "Failed to send a request to the Edge Function",
      status: undefined,
      backendMessage: null,
      isOffline: false,
      category: "network",
    });
    mocks.toUserFacingFunctionError.mockReturnValueOnce(
      "We couldn't reach the server to start this chat. Check your connection and try again.",
    );

    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-archive-fails-1",
            message: "Plan my day",
            starterIntent: "plan_day",
          },
          onLaunchIntentConsumed: consumed,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(consumed).toHaveBeenCalledWith("launch-archive-fails-1");
    });

    expect(mocks.supabaseInvoke).not.toHaveBeenCalled();
    expect(mocks.toUserFacingFunctionError).toHaveBeenCalledWith(
      expect.objectContaining({ category: "network" }),
      { action: "start this chat" },
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "We couldn't reach the server to start this chat. Check your connection and try again.",
    );
  });

  it("submits low-energy launcher intents without explicit intensity overrides", async () => {
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-recovery-1",
            message: "I'm low energy",
            starterIntent: "low_energy_adjust",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
        "companion-agent",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "I'm low energy",
            starterIntent: "low_energy_adjust",
          }),
        }),
      );
    });
  });

  it("restores cached planner state when switching back to a thread in the same session", async () => {
    mocks.loadThreadMessages.mockImplementation(async (sessionId: string) => {
      if (sessionId === "archived-session") {
        return [
          {
            id: "archived-1",
            sessionId: "archived-session",
            role: "assistant",
            content: "Let's pick up yesterday's plan.",
            createdAt: "2026-04-17T08:00:00.000Z",
            source: "agent",
          },
        ];
      }

      return [
        {
          id: "m1",
          sessionId: "persisted-session",
          role: "assistant",
          content: "What does tomorrow look like?",
          createdAt: "2026-04-18T08:00:00.000Z",
          source: "agent",
        },
      ];
    });

    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply: "I drafted a focused day for you.",
        mode: "schedule_read",
        intent: "plan_day",
        confidence: 0.91,
        structuredResponse: {
          intent: {
            intentType: "quest",
            timeHorizon: "today",
            isRecurring: false,
            shouldCreateQuest: true,
            shouldPromptCampaign: false,
          },
          planDay: {
            message: "I drafted a focused day for you.",
            dayAssessment: "balanced",
            suggestedQuests: [
              {
                suggestionId: "plan-1",
                proposalId: "proposal-plan-1",
                title: "Outline launch checklist",
                type: "must",
                estimatedDuration: "45 min",
                estimatedDurationMinutes: 45,
                source: "campaign",
                reason: "It keeps launch moving.",
              },
              {
                suggestionId: "plan-2",
                proposalId: "proposal-plan-2",
                title: "Review analytics notes",
                type: "should",
                estimatedDuration: "20 min",
                estimatedDurationMinutes: 20,
                source: "optimization",
                reason: "It helps you tighten tomorrow's decisions.",
              },
            ],
          },
        },
        threadState: {
          threadId: "persisted-session",
          sessionId: "persisted-session",
          openaiConversationId: "conv_123",
          lastOpenAIResponseId: "resp_123",
          hasPendingAction: false,
        },
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage("Plan my day", "text", {
        starterIntent: "plan_day",
      });
    });

    expect(
      result.current.structuredResponse?.planDay?.suggestedQuests,
    ).toHaveLength(2);
    expect(result.current.messages.at(-1)?.content).toBe(
      "I drafted a focused day for you.",
    );

    await act(async () => {
      await result.current.resumeThread("archived-session");
    });

    expect(result.current.activeThread?.sessionId).toBe("archived-session");
    expect(result.current.structuredResponse).toBeNull();
    expect(result.current.messages.at(-1)?.content).toBe(
      "Let's pick up yesterday's plan.",
    );

    await act(async () => {
      await result.current.resumeThread("persisted-session");
    });

    expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    expect(
      result.current.structuredResponse?.planDay?.suggestedQuests,
    ).toHaveLength(2);
    expect(
      result.current.messages.some(
        (message) =>
          message.content === "I drafted a focused day for you." &&
          Boolean(message.structuredResponse?.planDay),
      ),
    ).toBe(true);
  });
});
