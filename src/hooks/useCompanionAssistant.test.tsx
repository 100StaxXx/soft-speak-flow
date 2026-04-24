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
