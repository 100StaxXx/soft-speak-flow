import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_CHAT_OPENING_LINES } from "@/shared/companionChatOpeners";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";

const PERSONALIZED_QUEST_CAPTURE_OPENING =
  "Nova's ready. What quest are we capturing?";

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
  legacyConfirmSuggestedQuest: vi.fn().mockResolvedValue(undefined),
  legacyConfirmAllPendingActions: vi.fn().mockResolvedValue(undefined),
  legacyStartTemplateThread: vi.fn(),
  legacyStartQuestCaptureThread: vi.fn(),
  legacyHydrateFromUnifiedState: vi.fn(),
  legacyAdapterOptions: [] as Array<{ enabled?: boolean; surface?: string }>,
  legacySavedSuggestionProposalIds: [] as string[],
  legacyPendingSuggestionProposalId: null as string | null,
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
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
  useLegacyCompanionAssistantAdapter: (options: {
    enabled?: boolean;
    surface?: string;
  }) => {
    mocks.legacyAdapterOptions.push(options);
    return {
      todayLabel: "Saturday, April 18",
      placeholder: "Talk to Nova",
      messages: [],
      structuredResponse: null,
      pendingAction: null,
      savedSuggestionProposalIds: mocks.legacySavedSuggestionProposalIds,
      pendingSuggestionProposalId: mocks.legacyPendingSuggestionProposalId,
      pendingActionCount: 0,
      readyPendingActionCount: 0,
      isOpeningThread: false,
      isSubmitting: false,
      isResolvingAction: false,
      submitMessage: mocks.legacySubmitMessage,
      confirmPendingAction: mocks.legacyConfirmPendingAction,
      cancelPendingAction: mocks.legacyCancelPendingAction,
      confirmSuggestedQuest: mocks.legacyConfirmSuggestedQuest,
      confirmAllPendingActions: mocks.legacyConfirmAllPendingActions,
      startTemplateThread: mocks.legacyStartTemplateThread,
      startQuestCaptureThread: mocks.legacyStartQuestCaptureThread,
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

describe("useCompanionAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.legacyAdapterOptions = [];
    mocks.legacySavedSuggestionProposalIds = [];
    mocks.legacyPendingSuggestionProposalId = null;
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

  it("hydrates persisted chat text without restoring old pending actions", async () => {
    mocks.loadPendingAction.mockResolvedValue({
      id: "action-1",
      status: "pending",
      intent: "schedule_task",
      actionType: "task_create",
      summary: 'Add "Gym" for 2026-04-18 at 15:00.',
      confirmationMessage: 'Want me to add "Gym" for 2026-04-18 at 15:00?',
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
    expect(result.current).not.toHaveProperty("pendingAction");
  });

  it("strips persisted planner cards and saved suggestions after a full reload", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "user",
        content: "Help me think through today",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "agent",
      },
      {
        id: "m2",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Legacy planner card reply.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "legacy_planner",
          structuredResponse: {
            intent: {
              intentType: "quest",
              timeHorizon: "today",
              isRecurring: false,
              shouldCreateQuest: true,
              shouldPromptCampaign: false,
            },
            planDay: {
              message: "Legacy planner card reply.",
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
      {
        id: "m3",
        sessionId: "persisted-session",
        role: "user",
        content: "Confirm",
        createdAt: "2026-04-18T08:02:00.000Z",
        source: "agent",
      },
      {
        id: "m4",
        sessionId: "persisted-session",
        role: "assistant",
        content: 'Got it — "Outline launch checklist" added for 2026-04-18.',
        createdAt: "2026-04-18T08:02:01.000Z",
        source: "agent",
        metadata: {
          mode: "receipt",
          receipt: {
            actionId: "action-prepare-1",
            status: "executed",
            proposalId: "proposal-plan-1",
            message:
              'Got it — "Outline launch checklist" added for 2026-04-18.',
            summary: 'Create a quest for "Outline launch checklist".',
            createdAt: "2026-04-18T08:02:01.000Z",
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

    expect(result.current).not.toHaveProperty("structuredResponse");
    expect(result.current).not.toHaveProperty("savedSuggestionProposalIds");
    expect(
      result.current.messages.some(
        (message) =>
          message.content === "Legacy planner card reply." &&
          Object.prototype.hasOwnProperty.call(message, "structuredResponse"),
      ),
    ).toBe(false);
  });

  it("submits journeys chatbot turns through companion-chat and appends the reply", async () => {
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
      "companion-chat",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "persisted-session",
          message: "What does tomorrow look like?",
          surface: "journeys",
        }),
      }),
    );

    expect(result.current.messages.at(-1)?.content).toBe("Direct chat reply.");
    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([name]) => name,
    );
    expect(invokedFunctionNames).not.toContain("companion-agent");
    expect(invokedFunctionNames).not.toContain("companion-planner-chat");
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "journeys_companion_chat",
        inputText: "What does tomorrow look like?",
        detectedIntent: "conversation",
        userAction: "accepted",
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
      expect(result.current.messages[0]?.content).toBe(
        "Fresh read: today has a little shape to it.",
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

  it("routes weather questions with weekend language through companion-chat", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe(
        "Fresh read: today has a little shape to it.",
      );
    });

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
          message: "What's the weather gonna be like this weekend",
          surface: "companion",
        }),
      }),
    );
    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([name]) => name,
    );
    expect(invokedFunctionNames).not.toContain("companion-agent");
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_chat",
        inputText: "What's the weather gonna be like this weekend",
        detectedIntent: "conversation",
      }),
    );
  });

  it("submits companion chat surface turns through companion-chat without legacy endpoints", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.messages[0]?.content).toBe(
        "Fresh read: today has a little shape to it.",
      );
    });
    expect(result.current.activeThread?.sessionId).toBe("fresh-session");

    await act(async () => {
      await result.current.submitMessage("Can we talk through today?", "text");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-chat",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "fresh-session",
          message: "Can we talk through today?",
          surface: "companion",
        }),
      }),
    );
    const invokedFunctionNames = mocks.supabaseInvoke.mock.calls.map(
      ([name]) => name,
    );
    expect(invokedFunctionNames).not.toContain("companion-agent");
    expect(invokedFunctionNames).not.toContain("companion-planner-chat");
    expect(invokedFunctionNames).toContain("companion-chat-opener");
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
  });

  it("starts a generated companion opener on every closed-to-open cycle", async () => {
    let openerCount = 0;
    mocks.supabaseInvoke.mockImplementation(async (functionName, options) => {
      if (functionName === "companion-chat-opener") {
        openerCount += 1;
        return {
          data: {
            sessionId: `fresh-session-${openerCount}`,
            reply: `Fresh opener ${openerCount}`,
            speechText: `Fresh opener ${openerCount}`,
            createdAt: `2026-04-18T08:0${openerCount}:00.000Z`,
            persistenceReady: true,
            thread: {
              sessionId: `fresh-session-${openerCount}`,
              companionId: "companion-1",
              surface: "companion",
              title: `Fresh opener ${openerCount}`,
              previewText: `Fresh opener ${openerCount}`,
              createdAt: `2026-04-18T08:0${openerCount}:00.000Z`,
              lastMessageAt: `2026-04-18T08:0${openerCount}:00.000Z`,
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
            threadId: options?.body?.sessionId,
            sessionId: options?.body?.sessionId,
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_123",
            hasPendingAction: false,
          },
        },
        error: null,
      };
    });

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
      expect(result.current.activeThread?.sessionId).toBe("fresh-session-1");
    });
    expect(result.current.messages[0]?.content).toBe("Fresh opener 1");

    rerender({ enabled: false });
    rerender({ enabled: true });
    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("fresh-session-2");
    });
    expect(result.current.messages[0]?.content).toBe("Fresh opener 2");
    expect(
      mocks.supabaseInvoke.mock.calls.filter(
        ([functionName]) => functionName === "companion-chat-opener",
      ),
    ).toHaveLength(2);
  });

  it("uses the generated opener path when starting a new companion chat", async () => {
    let openerCount = 0;
    mocks.supabaseInvoke.mockImplementation(async (functionName) => {
      if (functionName === "companion-chat-opener") {
        openerCount += 1;
        return {
          data: {
            sessionId: `fresh-session-${openerCount}`,
            reply: `Fresh opener ${openerCount}`,
            speechText: `Fresh opener ${openerCount}`,
            createdAt: `2026-04-18T08:1${openerCount}:00.000Z`,
            persistenceReady: true,
            thread: {
              sessionId: `fresh-session-${openerCount}`,
              companionId: "companion-1",
              surface: "companion",
              title: `Fresh opener ${openerCount}`,
              previewText: `Fresh opener ${openerCount}`,
              createdAt: `2026-04-18T08:1${openerCount}:00.000Z`,
              lastMessageAt: `2026-04-18T08:1${openerCount}:00.000Z`,
              archivedAt: null,
              messageCount: 1,
            },
          },
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "companion" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("fresh-session-1");
    });

    await act(async () => {
      await result.current.startNewChat();
    });

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("fresh-session-2");
    });
    expect(result.current.messages[0]?.content).toBe("Fresh opener 2");
    expect(mocks.archiveThread).not.toHaveBeenCalled();
    expect(
      mocks.supabaseInvoke.mock.calls.filter(
        ([functionName]) => functionName === "companion-chat-opener",
      ),
    ).toHaveLength(2);
  });

  it("falls back to a local companion opener without surfacing opener internals", async () => {
    mocks.supabaseInvoke.mockImplementation(async (functionName) => {
      if (functionName === "companion-chat-opener") {
        return {
          data: null,
          error: new Error("opener unavailable"),
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

    expect(COMPANION_CHAT_OPENING_LINES).toContain(
      result.current.messages[0]?.content,
    );
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

  it("keeps the generated opener usable when opener persistence is not ready", async () => {
    mocks.supabaseInvoke.mockImplementation(async (functionName) => {
      if (functionName === "companion-chat-opener") {
        return {
          data: {
            sessionId: "fresh-session",
            reply: "Fresh opener without storage.",
            speechText: "Fresh opener without storage.",
            createdAt: "2026-04-18T08:03:00.000Z",
            persistenceReady: false,
            thread: {
              sessionId: "fresh-session",
              companionId: "companion-1",
              surface: "companion",
              title: "Fresh opener without storage.",
              previewText: "Fresh opener without storage.",
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
      expect(result.current.messages[0]?.content).toBe(
        "Fresh opener without storage.",
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
      { action: "talk with your companion" },
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

  it("consumes companion chat launcher intents even when archive cleanup fails", async () => {
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
            message: "What's the vibe",
            starterIntent: "free_talk_start",
            target: "conversation",
          },
          onLaunchIntentConsumed: consumed,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(consumed).toHaveBeenCalledWith("launch-archive-fails-1");
    });

    expect(mocks.supabaseInvoke).not.toHaveBeenCalled();
    expect(mocks.toUserFacingFunctionError).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
