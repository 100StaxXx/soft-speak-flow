import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  agentSurfaceEnabled: true,
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
  toUserFacingFunctionError: vi.fn().mockReturnValue(
    "Unable to send your message. Please try again.",
  ),
  trackInteraction: vi.fn().mockResolvedValue(undefined),
  legacySubmitMessage: vi.fn().mockResolvedValue(undefined),
  legacyConfirmPendingAction: vi.fn().mockResolvedValue(undefined),
  legacyCancelPendingAction: vi.fn().mockResolvedValue(undefined),
  legacyConfirmSuggestedQuest: vi.fn().mockResolvedValue(undefined),
  legacyConfirmAllPendingActions: vi.fn().mockResolvedValue(undefined),
  legacyStartTemplateThread: vi.fn(),
  legacyHydrateFromUnifiedState: vi.fn(),
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
    companion: { id: "companion-1" },
  }),
}));

vi.mock("@/hooks/useCompanionDialogue", () => ({
  useCompanionDialogue: () => ({
    greeting: "You made it back.",
    voiceStyle: "steady",
  }),
}));

vi.mock("@/config/companionAgentRollout", () => ({
  isCompanionAgentSurfaceEnabled: () => mocks.agentSurfaceEnabled,
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
  useLegacyCompanionAssistantAdapter: () => ({
    todayLabel: "Saturday, April 18",
    placeholder: "Talk to Cosmiq",
    messages: [],
    structuredResponse: null,
    pendingAction: null,
    savedSuggestionProposalIds: mocks.legacySavedSuggestionProposalIds,
    pendingSuggestionProposalId: mocks.legacyPendingSuggestionProposalId,
    pendingActionCount: 0,
    readyPendingActionCount: 0,
    isSubmitting: false,
    isResolvingAction: false,
    submitMessage: mocks.legacySubmitMessage,
    confirmPendingAction: mocks.legacyConfirmPendingAction,
    cancelPendingAction: mocks.legacyCancelPendingAction,
    confirmSuggestedQuest: mocks.legacyConfirmSuggestedQuest,
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
  }),
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
    mocks.agentSurfaceEnabled = true;
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
    mocks.supabaseInvoke.mockResolvedValue({
      data: {
        reply: "Tomorrow is pretty light.",
        mode: "schedule_read",
        intent: "check_calendar",
        confidence: 0.93,
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
  });

  it("hydrates the latest persisted thread and pending action", async () => {
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
    expect(result.current.pendingAction?.id).toBe("action-1");
  });

  it("restores persisted planner cards and saved suggestions after a full reload", async () => {
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
        content: "I drafted a focused day for you.",
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

    expect(result.current.structuredResponse?.planDay?.suggestedQuests)
      .toHaveLength(2);
    expect(result.current.savedSuggestionProposalIds).toEqual([
      "proposal-plan-1",
    ]);
    expect(
      result.current.messages.some((message) =>
        message.content === "I drafted a focused day for you." &&
        Boolean(message.structuredResponse?.planDay)
      ),
    ).toBe(true);
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
              blocksDrafting: true,
            },
            proposedActions: Array.from({ length: 9 }, (_, index) => ({
              type: "quest.create",
              title: index === 0
                ? "Draft launch email"
                : `Suggestion ${index + 1}`,
              confidence: 0.72,
            })),
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
    expect(result.current.proposedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "quest.create",
        title: "Draft launch email",
      }),
    ]));
    expect(result.current.placeholder).toBe("Answer Cosmiq's follow-up.");
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
    window.addEventListener("companion-plan-my-day-ai-answered", answeredListener);

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
          activeProposedActions: [
            expect.objectContaining({
              type: "quest.create",
              title: "Draft launch email",
            }),
            expect.objectContaining({ title: "Suggestion 2" }),
            expect.objectContaining({ title: "Suggestion 3" }),
            expect.objectContaining({ title: "Suggestion 4" }),
            expect.objectContaining({ title: "Suggestion 5" }),
            expect.objectContaining({ title: "Suggestion 6" }),
            expect.objectContaining({ title: "Suggestion 7" }),
            expect.objectContaining({ title: "Suggestion 8" }),
          ],
        }),
      }),
    );
    expect(answeredListener).toHaveBeenCalledTimes(1);
    window.removeEventListener("companion-plan-my-day-ai-answered", answeredListener);
  });

  it("preserves saved and pending suggestion ids in legacy fallback mode", async () => {
    mocks.legacySavedSuggestionProposalIds = ["proposal-plan-1"];
    mocks.legacyPendingSuggestionProposalId = "proposal-plan-2";
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

    await waitFor(() => {
      expect(result.current.savedSuggestionProposalIds).toEqual([
        "proposal-plan-1",
      ]);
    });

    expect(result.current.pendingSuggestionProposalId).toBe(
      "proposal-plan-2",
    );
  });

  it("hydrates the legacy adapter from the current agent thread before switching fallback modes", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "I drafted a focused day for you.",
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
              ],
            },
          },
        },
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
            content: "I drafted a focused day for you.",
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

  it("tags typed upcoming schedule reads with the upcoming starter intent", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
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

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "What do I have coming up?",
          turnOrigin: "composer",
          starterIntent: "upcoming_start",
        }),
      }),
    );
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        modifications: expect.objectContaining({
          starterIntent: "upcoming_start",
        }),
      }),
    );
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

  it("sends selected proposed action context with draft requests", async () => {
    const selectedProposedAction = {
      type: "quest.create",
      title: "Draft launch email",
      normalizedPayload: {
        title: "Draft launch email",
        date: "2026-04-18",
      },
    };

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
        "Draft this: Draft launch email",
        "text",
        {
          turnOrigin: "proposed_action",
          selectedProposedAction,
          selectedProposedActionIntent: "draft",
        },
      );
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Draft this: Draft launch email",
          turnOrigin: "proposed_action",
          selectedProposedAction,
          selectedProposedActionIntent: "draft",
        }),
      }),
    );
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        modifications: expect.objectContaining({
          selectedProposedActionType: "quest.create",
          selectedProposedActionIntent: "draft",
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
        message.content.includes("lost the thread")
      ),
    ).toBe(false);
  });

  it("logs parsed companion-agent HTTP failures with safe diagnostic metadata", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(
      () => {},
    );
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(
      () => {},
    );
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
    const consoleError = vi.spyOn(console, "error").mockImplementation(
      () => {},
    );
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

  it("confirms the active pending action through the deterministic executor path", async () => {
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
    window.addEventListener("companion-plan-my-day-action-saved", savedListener);

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
        inputText: 'Add "Gym" for 2026-04-18 at 15:00.',
        detectedIntent: "task_create",
        userAction: "accepted",
        modifications: expect.objectContaining({
          actionId: "action-1",
          confirmationMode: "confirm",
          surface: "journeys",
        }),
      }),
    );
    expect(savedListener).toHaveBeenCalledTimes(1);
    window.removeEventListener("companion-plan-my-day-action-saved", savedListener);
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

  it("primes empty quest_capture launchers with a synthetic backend turn and no user echo", async () => {
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply: "Glacireon's ready. What quest are we capturing?",
        mode: "ask_followup",
        intent: "schedule_task",
        confidence: 0.9,
        threadState: {
          threadId: "fresh-session",
          sessionId: "fresh-session",
          openaiConversationId: "conv_q",
          lastOpenAIResponseId: "resp_q",
          hasPendingAction: false,
        },
        followUp: {
          question: "What quest do you want to capture?",
          expectedAnswerType: "free_text",
          options: [],
          blocksDrafting: true,
        },
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-quest-1",
            message: "",
            starterIntent: "quest_capture",
            target: "planner",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
        "companion-agent",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "quest",
            starterIntent: "quest_capture",
            turnOrigin: "launcher",
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(
        result.current.messages.some((message) =>
          message.role === "assistant" &&
          message.content.includes("What quest are we capturing?")
        ),
      ).toBe(true);
    });

    expect(
      result.current.messages.some((message) =>
        message.role === "user" && message.content === "quest"
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

    expect(mocks.archiveThread).toHaveBeenCalledWith(
      "persisted-session",
      true,
    );
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

    expect(mocks.archiveThread).toHaveBeenCalledWith(
      "persisted-session",
      true,
    );

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
      result.current.messages.some((message) =>
        message.content === "This old thread should not reopen."
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
      result.current.messages.some((message) =>
        message.content === "This old thread should not reopen."
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

  it("keeps unified thread history dormant when the legacy fallback is active from the start", async () => {
    mocks.agentSurfaceEnabled = false;

    const { wrapper } = createWrapper();
    renderHook(() => useCompanionAssistant({ surface: "journeys" }), {
      wrapper,
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.listThreads).not.toHaveBeenCalled();
  });

  it("runs launch intents through the legacy fallback without waiting on unified thread bootstrap", async () => {
    mocks.agentSurfaceEnabled = false;

    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-fallback-1",
            message: "Plan my day",
            starterIntent: "plan_day",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.legacyStartTemplateThread).toHaveBeenCalled();
      expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
        "Plan my day",
        "text",
        { starterIntent: "plan_day", turnOrigin: "launcher" },
      );
    });
    expect(mocks.listThreads).not.toHaveBeenCalled();
  });

  it("starts free-talk launcher templates in legacy fallback without submitting the opener", async () => {
    mocks.agentSurfaceEnabled = false;
    const consumed = vi.fn();

    const { wrapper } = createWrapper();
    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-free-talk-fallback-1",
            message: "What's good, buddy?",
            starterIntent: "free_talk_start",
            target: "conversation",
          },
          onLaunchIntentConsumed: consumed,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.legacyStartTemplateThread).toHaveBeenCalledWith({
        greetingText: "What's good, buddy?",
        visibleAssistantOpening: true,
      });
    });
    expect(mocks.legacySubmitMessage).not.toHaveBeenCalled();
    expect(consumed).toHaveBeenCalledWith("launch-free-talk-fallback-1");
    expect(mocks.listThreads).not.toHaveBeenCalled();
  });

  it("keeps planner context after confirming one suggestion so another can be prepared", async () => {
    mocks.supabaseInvoke
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        data: {
          reply:
            "I pulled that suggestion into a confirmable action. Review it and confirm if it fits.",
          mode: "pending_confirmation",
          intent: "schedule_task",
          confidence: 0.82,
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
          pendingAction: {
            id: "action-prepare-1",
            status: "pending",
            intent: "schedule_task",
            actionType: "task_create",
            proposalId: "proposal-plan-1",
            summary: 'Create a quest for "Outline launch checklist".',
            confirmationMessage: "Want me to lock that in?",
            normalizedPayload: {
              title: "Outline launch checklist",
            },
            affectedEntities: null,
            expiresAt: "2026-04-18T20:00:00.000Z",
            createdAt: "2026-04-18T08:10:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_123",
            hasPendingAction: true,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          reply: 'Got it — "Outline launch checklist" added for 2026-04-18.',
          mode: "receipt",
          intent: "schedule_task",
          confidence: 1,
          receipt: {
            actionId: "action-prepare-1",
            status: "executed",
            message:
              'Got it — "Outline launch checklist" added for 2026-04-18.',
            summary: 'Create a quest for "Outline launch checklist".',
            createdAt: "2026-04-18T08:11:00.000Z",
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
      })
      .mockResolvedValueOnce({
        data: {
          reply:
            "I pulled that suggestion into a confirmable action. Review it and confirm if it fits.",
          mode: "pending_confirmation",
          intent: "schedule_task",
          confidence: 0.82,
          pendingAction: {
            id: "action-prepare-2",
            status: "pending",
            intent: "schedule_task",
            actionType: "task_create",
            proposalId: "proposal-plan-2",
            summary: 'Create a quest for "Review analytics notes".',
            confirmationMessage: "Want me to lock that in?",
            normalizedPayload: {
              title: "Review analytics notes",
            },
            affectedEntities: null,
            expiresAt: "2026-04-18T20:20:00.000Z",
            createdAt: "2026-04-18T08:20:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_125",
            hasPendingAction: true,
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

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-plan-1");
    });

    expect(result.current.pendingSuggestionProposalId).toBe(
      "proposal-plan-1",
    );

    expect(mocks.supabaseInvoke).toHaveBeenNthCalledWith(
      2,
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "persisted-session",
          message: "Plan my day",
          turnOrigin: "proposed_action",
          starterIntent: "plan_day",
          selectedProposalId: "proposal-plan-1",
        }),
      }),
    );
    expect(mocks.trackInteraction).toHaveBeenCalledWith(
      expect.objectContaining({
        interactionType: "companion_agent_suggestion_prepare",
        inputText: "Plan my day",
        detectedIntent: "schedule_task",
        userAction: "accepted",
        modifications: expect.objectContaining({
          proposalId: "proposal-plan-1",
          turnOrigin: "proposed_action",
          starterIntent: "plan_day",
          surface: "journeys",
        }),
      }),
    );

    await act(async () => {
      await result.current.confirmPendingAction();
    });

    expect(result.current.pendingAction).toBeNull();
    expect(result.current.pendingSuggestionProposalId).toBeNull();
    expect(result.current.savedSuggestionProposalIds).toEqual([
      "proposal-plan-1",
    ]);
    expect(result.current.structuredResponse?.planDay?.suggestedQuests)
      .toHaveLength(2);

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-plan-2");
    });

    expect(result.current.pendingSuggestionProposalId).toBe(
      "proposal-plan-2",
    );

    expect(mocks.supabaseInvoke).toHaveBeenNthCalledWith(
      4,
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          sessionId: "persisted-session",
          message: "Plan my day",
          starterIntent: "plan_day",
          selectedProposalId: "proposal-plan-2",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-prepare-2");
  });

  it("keeps the pending suggestion id when the prepare response omits proposalId", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "I drafted a focused day for you.",
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
              ],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply:
          "I pulled that suggestion into a confirmable action. Review it and confirm if it fits.",
        mode: "pending_confirmation",
        intent: "schedule_task",
        confidence: 0.82,
        pendingAction: {
          id: "action-prepare-1",
          status: "pending",
          intent: "schedule_task",
          actionType: "task_create",
          summary: 'Create a quest for "Outline launch checklist".',
          confirmationMessage: "Want me to lock that in?",
          normalizedPayload: {
            title: "Outline launch checklist",
          },
          affectedEntities: null,
          expiresAt: "2026-04-18T20:00:00.000Z",
          createdAt: "2026-04-18T08:10:00.000Z",
        },
        threadState: {
          threadId: "persisted-session",
          sessionId: "persisted-session",
          openaiConversationId: "conv_123",
          lastOpenAIResponseId: "resp_123",
          hasPendingAction: true,
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
      expect(
        result.current.structuredResponse?.planDay?.suggestedQuests[0]
          ?.proposalId,
      )
        .toBe("proposal-plan-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-plan-1");
    });

    expect(result.current.pendingSuggestionProposalId).toBe(
      "proposal-plan-1",
    );
    expect(result.current.pendingAction?.id).toBe("action-prepare-1");
  });

  it("recovers tomorrow-bridge suggestions after reload without needing a fresh user turn", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Tomorrow should start with a cleaner reset move.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "reflect",
          structuredResponse: {
            intent: {
              intentType: "conversation",
              timeHorizon: "short_term",
              isRecurring: false,
              shouldCreateQuest: false,
              shouldPromptCampaign: false,
            },
            reflectionBridge: {
              message: "Tomorrow should start with a cleaner reset move.",
              carryForward: "Keep launch pressure contained.",
              tomorrowSummary: "light",
              firstAction: {
                suggestionId: "tomorrow-1",
                proposalId: "proposal-tomorrow-1",
                title: "Adjust Course launch",
                type: "must",
                estimatedDuration: "20 min",
                estimatedDurationMinutes: 20,
                source: "campaign",
                reason:
                  "The honest first move tomorrow is resetting the campaign before adding more work.",
              },
              tomorrowSchedule: [],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply:
          "I pulled that tomorrow move into a confirmable action. Review it and confirm if it fits.",
        mode: "pending_confirmation",
        intent: "schedule_task",
        confidence: 0.82,
        pendingAction: {
          id: "action-tomorrow-1",
          status: "pending",
          intent: "schedule_task",
          actionType: "campaign_update",
          proposalId: "proposal-tomorrow-1",
          summary: 'Adjust "Course launch".',
          confirmationMessage: "Want me to lock that in?",
          normalizedPayload: {
            title: "Adjust Course launch",
          },
          affectedEntities: null,
          expiresAt: "2026-04-18T20:20:00.000Z",
          createdAt: "2026-04-18T08:20:00.000Z",
        },
        threadState: {
          threadId: "persisted-session",
          sessionId: "persisted-session",
          openaiConversationId: "conv_123",
          lastOpenAIResponseId: "resp_125",
          hasPendingAction: true,
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
      expect(
        result.current.structuredResponse?.reflectionBridge?.firstAction
          ?.proposalId,
      )
        .toBe("proposal-tomorrow-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-tomorrow-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Prepare me for tomorrow",
          starterIntent: "briefing_followup",
          selectedProposalId: "proposal-tomorrow-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-tomorrow-1");
  });

  it("recovers what-matters suggestions after reload and keeps them saved after confirmation", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "The honest next move is to reset the campaign first.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "explore",
          structuredResponse: {
            intent: {
              intentType: "quest",
              timeHorizon: "today",
              isRecurring: false,
              shouldCreateQuest: false,
              shouldPromptCampaign: false,
            },
            priorityOverview: {
              title: "What Matters",
              message: "The honest next move is to reset the campaign first.",
              campaignPressure:
                "Campaign pressure: Course launch is stalled. Reset the plan before adding more work.",
              topPriorities: [
                {
                  suggestionId: "priority-1",
                  proposalId: "proposal-priority-1",
                  title: "Adjust Course launch",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason:
                    "The campaign has slipped repeatedly, so the honest next move is to reset it before adding more work.",
                },
              ],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke
      .mockResolvedValueOnce({
        data: {
          reply:
            "I pulled that priority move into a confirmable action. Review it and confirm if it fits.",
          mode: "pending_confirmation",
          intent: "schedule_task",
          confidence: 0.82,
          pendingAction: {
            id: "action-priority-1",
            status: "pending",
            intent: "schedule_task",
            actionType: "campaign_update",
            proposalId: "proposal-priority-1",
            summary: 'Adjust "Course launch".',
            confirmationMessage: "Want me to lock that in?",
            normalizedPayload: {
              title: "Adjust Course launch",
            },
            affectedEntities: null,
            expiresAt: "2026-04-18T20:20:00.000Z",
            createdAt: "2026-04-18T08:20:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_125",
            hasPendingAction: true,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          reply: 'Got it — "Course launch" was adjusted.',
          mode: "receipt",
          intent: "update_existing_plan",
          confidence: 1,
          receipt: {
            actionId: "action-priority-1",
            status: "executed",
            proposalId: "proposal-priority-1",
            message: 'Got it — "Course launch" was adjusted.',
            summary: 'Adjust "Course launch".',
            createdAt: "2026-04-18T08:22:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_126",
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
      expect(
        result.current.structuredResponse?.priorityOverview?.topPriorities[0]
          ?.proposalId,
      )
        .toBe("proposal-priority-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-priority-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "What matters most?",
          starterIntent: "what_matters",
          selectedProposalId: "proposal-priority-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-priority-1");

    await act(async () => {
      await result.current.confirmPendingAction();
    });

    expect(result.current.savedSuggestionProposalIds).toEqual([
      "proposal-priority-1",
    ]);
  });

  it("recovers make-room suggestions after reload with the right starter intent", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Here is what I would protect first so we can make room.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "explore",
          structuredResponse: {
            intent: {
              intentType: "quest",
              timeHorizon: "today",
              isRecurring: false,
              shouldCreateQuest: false,
              shouldPromptCampaign: false,
            },
            priorityOverview: {
              title: "Make Room",
              message:
                "Here is what I would protect first so we can make room.",
              campaignPressure: null,
              topPriorities: [
                {
                  suggestionId: "make-room-1",
                  proposalId: "proposal-make-room-1",
                  title: "Adjust Course launch",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason:
                    "Resetting this campaign is the cleanest way to free up the rest of the week.",
                },
              ],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply:
          "I pulled that make-room move into a confirmable action. Review it and confirm if it fits.",
        mode: "pending_confirmation",
        intent: "schedule_task",
        confidence: 0.82,
        pendingAction: {
          id: "action-make-room-1",
          status: "pending",
          intent: "schedule_task",
          actionType: "campaign_update",
          proposalId: "proposal-make-room-1",
          summary: 'Adjust "Course launch".',
          confirmationMessage: "Want me to lock that in?",
          normalizedPayload: {
            title: "Adjust Course launch",
          },
          affectedEntities: null,
          expiresAt: "2026-04-18T20:20:00.000Z",
          createdAt: "2026-04-18T08:20:00.000Z",
        },
        threadState: {
          threadId: "persisted-session",
          sessionId: "persisted-session",
          openaiConversationId: "conv_123",
          lastOpenAIResponseId: "resp_125",
          hasPendingAction: true,
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
      expect(result.current.structuredResponse?.priorityOverview?.title)
        .toBe("Make Room");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-make-room-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Make room",
          starterIntent: "make_room",
          selectedProposalId: "proposal-make-room-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-make-room-1");
  });

  it("recovers advance-campaign suggestions after reload and keeps them saved after confirmation", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Course launch needs a cleaner next move.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "goal_setting",
          structuredResponse: {
            intent: {
              intentType: "campaign",
              timeHorizon: "short_term",
              isRecurring: false,
              shouldCreateQuest: false,
              shouldPromptCampaign: false,
            },
            campaignMomentum: {
              message: "Course launch needs a cleaner next move.",
              campaignId: "campaign-1",
              campaignTitle: "Course launch",
              status: "stalled",
              interventionLevel: "reset",
              statusReason:
                "The current launch move is still too large to start cleanly.",
              healthSnapshot: {
                overdueQuestCount: 2,
                protectedTodayCount: 0,
                recentCompletedQuestCount: 1,
                daysWithoutMomentum: 7,
                activeCampaignCount: 4,
              },
              pressureSignals: [
                "Repeated slip on the launch move.",
              ],
              nextStep: {
                suggestionId: "campaign-1",
                proposalId: "proposal-campaign-1",
                title: "Adjust Course launch",
                type: "must",
                estimatedDuration: "20 min",
                estimatedDurationMinutes: 20,
                source: "campaign",
                reason:
                  "Resetting the plan is the honest next move before adding more work.",
              },
              supportActions: [],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke
      .mockResolvedValueOnce({
        data: {
          reply:
            "I pulled that campaign move into a confirmable action. Review it and confirm if it fits.",
          mode: "pending_confirmation",
          intent: "schedule_task",
          confidence: 0.82,
          pendingAction: {
            id: "action-campaign-1",
            status: "pending",
            intent: "schedule_task",
            actionType: "campaign_update",
            proposalId: "proposal-campaign-1",
            summary: 'Adjust "Course launch".',
            confirmationMessage: "Want me to lock that in?",
            normalizedPayload: {
              title: "Adjust Course launch",
            },
            affectedEntities: null,
            expiresAt: "2026-04-18T20:20:00.000Z",
            createdAt: "2026-04-18T08:20:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_125",
            hasPendingAction: true,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          reply: 'Got it — "Course launch" was adjusted.',
          mode: "receipt",
          intent: "update_existing_plan",
          confidence: 1,
          receipt: {
            actionId: "action-campaign-1",
            status: "executed",
            proposalId: "proposal-campaign-1",
            message: 'Got it — "Course launch" was adjusted.',
            summary: 'Adjust "Course launch".',
            createdAt: "2026-04-18T08:22:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_126",
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
      expect(
        result.current.structuredResponse?.campaignMomentum?.nextStep
          ?.proposalId,
      )
        .toBe("proposal-campaign-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-campaign-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Advance my campaign",
          starterIntent: "advance_campaign_start",
          selectedProposalId: "proposal-campaign-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-campaign-1");

    await act(async () => {
      await result.current.confirmPendingAction();
    });

    expect(result.current.savedSuggestionProposalIds).toEqual([
      "proposal-campaign-1",
    ]);
  });

  it("recovers weekly-plan suggestions after reload and keeps them saved after confirmation", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Protect the launch path this week before adding more work.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "plan_week",
          structuredResponse: {
            intent: {
              intentType: "quest",
              timeHorizon: "short_term",
              isRecurring: false,
              shouldCreateQuest: false,
              shouldPromptCampaign: false,
            },
            weeklyPlan: {
              message:
                "Protect the launch path this week before adding more work.",
              weeklyTheme: "Protect the launch path first.",
              focusCampaignTitle: "Course launch",
              focusCampaignStatus: "stalled",
              focusCampaignInterventionLevel: "reset",
              focusCampaignReason:
                "The campaign has slipped repeatedly without a protected reset move.",
              focusCampaignHealth: {
                overdueQuestCount: 2,
                protectedTodayCount: 0,
                recentCompletedQuestCount: 1,
                daysWithoutMomentum: 7,
                activeCampaignCount: 4,
              },
              topPriorities: [
                {
                  suggestionId: "weekly-1",
                  proposalId: "proposal-weekly-1",
                  title: "Adjust Course launch",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason:
                    "Resetting the campaign this week is the clearest way to stop the slip.",
                },
              ],
              busyDays: [],
              openDays: ["Wednesday"],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke
      .mockResolvedValueOnce({
        data: {
          reply:
            "I pulled that weekly priority into a confirmable action. Review it and confirm if it fits.",
          mode: "pending_confirmation",
          intent: "schedule_task",
          confidence: 0.82,
          pendingAction: {
            id: "action-weekly-1",
            status: "pending",
            intent: "schedule_task",
            actionType: "campaign_update",
            proposalId: "proposal-weekly-1",
            summary: 'Adjust "Course launch".',
            confirmationMessage: "Want me to lock that in?",
            normalizedPayload: {
              title: "Adjust Course launch",
            },
            affectedEntities: null,
            expiresAt: "2026-04-18T20:20:00.000Z",
            createdAt: "2026-04-18T08:20:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_125",
            hasPendingAction: true,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          reply: 'Got it — "Course launch" was adjusted.',
          mode: "receipt",
          intent: "update_existing_plan",
          confidence: 1,
          receipt: {
            actionId: "action-weekly-1",
            status: "executed",
            proposalId: "proposal-weekly-1",
            message: 'Got it — "Course launch" was adjusted.',
            summary: 'Adjust "Course launch".',
            createdAt: "2026-04-18T08:22:00.000Z",
          },
          threadState: {
            threadId: "persisted-session",
            sessionId: "persisted-session",
            openaiConversationId: "conv_123",
            lastOpenAIResponseId: "resp_126",
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
      expect(
        result.current.structuredResponse?.weeklyPlan?.topPriorities[0]
          ?.proposalId,
      )
        .toBe("proposal-weekly-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-weekly-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Plan my week",
          starterIntent: "plan_week",
          selectedProposalId: "proposal-weekly-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-weekly-1");

    await act(async () => {
      await result.current.confirmPendingAction();
    });

    expect(result.current.savedSuggestionProposalIds).toEqual([
      "proposal-weekly-1",
    ]);
  });

  it("recovers coming-up suggestions after reload with the right starter intent", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "You have one clean move before your next event.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "check_calendar",
          structuredResponse: {
            intent: {
              intentType: "conversation",
              timeHorizon: "today",
              isRecurring: false,
              shouldCreateQuest: false,
              shouldPromptCampaign: false,
            },
            comingUp: {
              message: "You have one clean move before your next event.",
              nextEvent: {
                id: "event-1",
                title: "Call",
                label: "Call at 2:00 PM",
                startsAt: "2026-04-18T21:00:00.000Z",
                endsAt: "2026-04-18T21:30:00.000Z",
                isAllDay: false,
                source: "calendar",
              },
              nextBestAction: {
                suggestionId: "coming-up-1",
                proposalId: "proposal-coming-up-1",
                title: "Adjust Course launch",
                type: "must",
                estimatedDuration: "20 min",
                estimatedDurationMinutes: 20,
                source: "campaign",
                reason:
                  "This fits before the call and is the clearest move to reduce campaign pressure.",
              },
              remainingToday: [],
              tomorrowSummary: "light",
              missedItems: [],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply:
          "I pulled that before-the-call move into a confirmable action. Review it and confirm if it fits.",
        mode: "pending_confirmation",
        intent: "schedule_task",
        confidence: 0.82,
        pendingAction: {
          id: "action-coming-up-1",
          status: "pending",
          intent: "schedule_task",
          actionType: "campaign_update",
          proposalId: "proposal-coming-up-1",
          summary: 'Adjust "Course launch".',
          confirmationMessage: "Want me to lock that in?",
          normalizedPayload: {
            title: "Adjust Course launch",
          },
          affectedEntities: null,
          expiresAt: "2026-04-18T20:20:00.000Z",
          createdAt: "2026-04-18T08:20:00.000Z",
        },
        threadState: {
          threadId: "persisted-session",
          sessionId: "persisted-session",
          openaiConversationId: "conv_123",
          lastOpenAIResponseId: "resp_125",
          hasPendingAction: true,
        },
        error: null,
      },
      error: null,
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(
        result.current.structuredResponse?.comingUp?.nextBestAction?.proposalId,
      )
        .toBe("proposal-coming-up-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-coming-up-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "What do I have coming up?",
          starterIntent: "upcoming_start",
          selectedProposalId: "proposal-coming-up-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-coming-up-1");
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

    expect(result.current.structuredResponse?.planDay?.suggestedQuests)
      .toHaveLength(2);
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
    expect(result.current.structuredResponse?.planDay?.suggestedQuests)
      .toHaveLength(2);
    expect(
      result.current.messages.some((message) =>
        message.content === "I drafted a focused day for you." &&
        Boolean(message.structuredResponse?.planDay)
      ),
    ).toBe(true);
  });
});
