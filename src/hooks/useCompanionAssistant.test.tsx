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
  speakCompanionReply: vi.fn().mockResolvedValue("device"),
  stopCompanionSpeech: vi.fn(),
  toggleRecording: vi.fn(),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  supabaseInvoke: vi.fn(),
  invalidateQueries: vi.fn(),
  parseFunctionInvokeError: vi.fn().mockResolvedValue({
    status: 500,
    backendMessage: null,
  }),
  trackInteraction: vi.fn().mockResolvedValue(undefined),
  legacySubmitMessage: vi.fn().mockResolvedValue(undefined),
  legacyConfirmPendingAction: vi.fn().mockResolvedValue(undefined),
  legacyCancelPendingAction: vi.fn().mockResolvedValue(undefined),
  legacyConfirmSuggestedQuest: vi.fn().mockResolvedValue(undefined),
  legacyConfirmAllPendingActions: vi.fn().mockResolvedValue(undefined),
  legacySetPlanningMode: vi.fn(),
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
    planningMode: "balanced" as const,
    setPlanningMode: mocks.legacySetPlanningMode,
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
  generateCompanionThreadSessionId: () => "fresh-session",
  getCompanionChatThreadsQueryKey: () => ["companion-chat-threads"],
  listCompanionChatThreads: mocks.listThreads,
  loadCompanionChatThreadMessages: mocks.loadThreadMessages,
  loadCompanionPendingAction: mocks.loadPendingAction,
  readCompanionThreadReceiptProposalId: (receipt: { proposalId?: string | null } | null | undefined) =>
    receipt?.proposalId ?? null,
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
            message: 'Got it — "Outline launch checklist" added for 2026-04-18.',
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

    expect(result.current.structuredResponse?.planDay?.suggestedQuests).toHaveLength(2);
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
      await result.current.submitMessage("Adjust my day", "text", {
        starterIntent: "adjust_today",
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
            content: "Adjust my day",
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
          planningMode: "balanced",
        }),
      }),
    );
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
          planningMode: "balanced",
        }),
      }),
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
          planningMode: "balanced",
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

  it("passes the selected day mode through to companion-agent requests", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    act(() => {
      result.current.setPlanningMode("recovery");
    });

    await waitFor(() => {
      expect(result.current.planningMode).toBe("recovery");
    });

    await act(async () => {
      await result.current.submitMessage("Adjust my day", "text");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Adjust my day",
          planningMode: "recovery",
        }),
      }),
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
          }),
        }),
      );
    });
  });

  it("applies launcher planning modes before submitting the starter intent", async () => {
    const { wrapper } = createWrapper();

    renderHook(
      () =>
        useCompanionAssistant({
          surface: "journeys",
          launchIntent: {
            id: "launch-recovery-1",
            message: "I'm low energy today",
            starterIntent: "low_energy_adjust",
            planningMode: "recovery",
          },
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
        "companion-agent",
        expect.objectContaining({
          body: expect.objectContaining({
            message: "I'm low energy today",
            starterIntent: "low_energy_adjust",
            planningMode: "recovery",
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
        { starterIntent: "plan_day" },
      );
    });
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
          starterIntent: "plan_day",
          planningMode: "balanced",
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
          starterIntent: "plan_day",
          planningMode: "balanced",
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
    expect(result.current.structuredResponse?.planDay?.suggestedQuests).toHaveLength(2);

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
          planningMode: "balanced",
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
      expect(result.current.structuredResponse?.planDay?.suggestedQuests[0]?.proposalId)
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
      expect(result.current.structuredResponse?.reflectionBridge?.firstAction?.proposalId)
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
      expect(result.current.structuredResponse?.priorityOverview?.topPriorities[0]?.proposalId)
        .toBe("proposal-priority-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-priority-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "What matters most today?",
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
          message: "Help me make room for what matters.",
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
      expect(result.current.structuredResponse?.campaignMomentum?.nextStep?.proposalId)
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

  it("recovers right-now suggestions after reload with the right starter intent", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "You have a clean 20-minute window right now.",
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
            rightNow: {
              message: "You have a clean 20-minute window right now.",
              currentWindow: "Next 20 minutes",
              recommendedAction: {
                suggestionId: "right-now-1",
                proposalId: "proposal-right-now-1",
                title: "Adjust Course launch",
                type: "must",
                estimatedDuration: "20 min",
                estimatedDurationMinutes: 20,
                source: "campaign",
                reason:
                  "The cleanest use of this gap is resetting the slipping campaign before the next block.",
              },
              fallbackAction: null,
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke.mockResolvedValueOnce({
      data: {
        reply:
          "I pulled that right-now move into a confirmable action. Review it and confirm if it fits.",
        mode: "pending_confirmation",
        intent: "schedule_task",
        confidence: 0.82,
        pendingAction: {
          id: "action-right-now-1",
          status: "pending",
          intent: "schedule_task",
          actionType: "campaign_update",
          proposalId: "proposal-right-now-1",
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
      expect(result.current.structuredResponse?.rightNow?.recommendedAction?.proposalId)
        .toBe("proposal-right-now-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-right-now-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "What should I do right now?",
          starterIntent: "right_now_start",
          selectedProposalId: "proposal-right-now-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-right-now-1");
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
      expect(result.current.structuredResponse?.weeklyPlan?.topPriorities[0]?.proposalId)
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
      expect(result.current.structuredResponse?.comingUp?.nextBestAction?.proposalId)
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

  it("recovers adjust-day suggestions after reload and keeps them saved after confirmation", async () => {
    mocks.loadThreadMessages.mockResolvedValue([
      {
        id: "m1",
        sessionId: "persisted-session",
        role: "assistant",
        content: "Keep the launch reset, move the rest, and trim one thing.",
        createdAt: "2026-04-18T08:00:01.000Z",
        source: "agent",
        metadata: {
          mode: "schedule_read",
          intent: "update_existing_plan",
          structuredResponse: {
            intent: {
              intentType: "quest",
              timeHorizon: "today",
              isRecurring: false,
              shouldCreateQuest: false,
              shouldPromptCampaign: false,
            },
            dayAdjust: {
              message: "Keep the launch reset, move the rest, and trim one thing.",
              keep: [
                {
                  suggestionId: "adjust-1",
                  proposalId: "proposal-adjust-1",
                  title: "Adjust Course launch",
                  type: "must",
                  estimatedDuration: "20 min",
                  estimatedDurationMinutes: 20,
                  source: "campaign",
                  reason:
                    "This reset move should stay protected even if the rest of the day shifts.",
                },
              ],
              move: [],
              dropOrShrink: [],
            },
          },
        },
      },
    ]);
    mocks.supabaseInvoke
      .mockResolvedValueOnce({
        data: {
          reply:
            "I pulled that adjustment into a confirmable action. Review it and confirm if it fits.",
          mode: "pending_confirmation",
          intent: "schedule_task",
          confidence: 0.82,
          pendingAction: {
            id: "action-adjust-1",
            status: "pending",
            intent: "schedule_task",
            actionType: "campaign_update",
            proposalId: "proposal-adjust-1",
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
            actionId: "action-adjust-1",
            status: "executed",
            proposalId: "proposal-adjust-1",
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
      expect(result.current.structuredResponse?.dayAdjust?.keep[0]?.proposalId)
        .toBe("proposal-adjust-1");
    });

    await act(async () => {
      await result.current.confirmSuggestedQuest("proposal-adjust-1");
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Adjust my day",
          starterIntent: "adjust_today",
          selectedProposalId: "proposal-adjust-1",
        }),
      }),
    );
    expect(result.current.pendingAction?.id).toBe("action-adjust-1");

    await act(async () => {
      await result.current.confirmPendingAction();
    });

    expect(result.current.savedSuggestionProposalIds).toEqual([
      "proposal-adjust-1",
    ]);
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

    expect(result.current.structuredResponse?.planDay?.suggestedQuests).toHaveLength(2);
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
    expect(result.current.structuredResponse?.planDay?.suggestedQuests).toHaveLength(2);
    expect(
      result.current.messages.some((message) =>
        message.content === "I drafted a focused day for you." &&
        Boolean(message.structuredResponse?.planDay)
      ),
    ).toBe(true);
  });
});
