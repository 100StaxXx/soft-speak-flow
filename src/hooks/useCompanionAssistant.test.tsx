import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
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
  currentUserId: "user-1",
  currentCompanionId: "companion-1",
  legacySubmitMessage: vi.fn().mockResolvedValue(undefined),
  legacyConfirmPendingAction: vi.fn().mockResolvedValue(undefined),
  legacyCancelPendingAction: vi.fn().mockResolvedValue(undefined),
}));

let scopeCounter = 0;

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: mocks.currentUserId },
  }),
}));

vi.mock("@/hooks/useCompanion", () => ({
  useCompanion: () => ({
    companion: { id: mocks.currentCompanionId },
  }),
}));

vi.mock("@/hooks/useCompanionDialogue", () => ({
  useCompanionDialogue: () => ({
    greeting: "You made it back.",
    voiceStyle: "steady",
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
    pendingAction: null,
    isSubmitting: false,
    isResolvingAction: false,
    submitMessage: mocks.legacySubmitMessage,
    confirmPendingAction: mocks.legacyConfirmPendingAction,
    cancelPendingAction: mocks.legacyCancelPendingAction,
    isSpeaking: false,
    speechProvider: "none" as const,
    stopSpeaking: vi.fn(),
    activeThread: null,
    historyThreads: [],
    isLoadingThreads: false,
    hasPersistedActiveThread: false,
    canOpenThreadPicker: false,
    threadHistoryEmptyStateMessage: "Past chats will show up here after at least one real exchange.",
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
import { COMPANION_PENDING_ACTIONS_DISABLED_REASON } from "@/utils/companionChatSetup";

const REOPEN_FAILED_TOAST =
  "I couldn't reopen the last thread, so I started a fresh one.";

const createPendingActionsSetupError = () => ({
  code: "42P01",
  message: 'relation "companion_pending_actions" does not exist',
  details: null,
  hint: null,
});

const getPendingActionsSetupToastId = () =>
  `companion-pending-actions-setup:journeys:${mocks.currentUserId}:${mocks.currentCompanionId}`;

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
    scopeCounter += 1;
    mocks.currentUserId = "user-1";
    mocks.currentCompanionId = `companion-${scopeCounter}`;
    mocks.listThreads.mockResolvedValue([
      {
        sessionId: "persisted-session",
        companionId: mocks.currentCompanionId,
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

    expect(result.current.messages[0]?.content).toBe("What does tomorrow look like?");
    expect(result.current.pendingAction?.id).toBe("action-1");
  });

  it("keeps the reopened thread active when pending actions are unavailable during setup", async () => {
    mocks.loadPendingAction.mockRejectedValue(createPendingActionsSetupError());

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    expect(result.current.messages[0]?.content).toBe("What does tomorrow look like?");
    expect(result.current.pendingAction).toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith(
      COMPANION_PENDING_ACTIONS_DISABLED_REASON,
      { id: getPendingActionsSetupToastId() },
    );
    expect(mocks.toastError).not.toHaveBeenCalledWith(REOPEN_FAILED_TOAST);
  });

  it("falls back to a fresh thread when message hydration fails", async () => {
    mocks.loadThreadMessages.mockRejectedValue(new Error("messages unavailable"));

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(REOPEN_FAILED_TOAST);
    });

    expect(result.current.activeThread?.sessionId).toBe("fresh-session");
    expect(result.current.messages[0]?.content).not.toBe("What does tomorrow look like?");
    expect(result.current.messages[0]?.isSeed).toBe(true);
    expect(mocks.toastError).not.toHaveBeenCalledWith(
      COMPANION_PENDING_ACTIONS_DISABLED_REASON,
      { id: getPendingActionsSetupToastId() },
    );
  });

  it("keeps resumed threads open when pending actions are unavailable during setup", async () => {
    mocks.loadPendingAction.mockRejectedValue(createPendingActionsSetupError());
    mocks.loadThreadMessages.mockImplementation(async (sessionId: string) => (
      sessionId === "resumed-session"
        ? [
            {
              id: "m2",
              sessionId: "resumed-session",
              role: "assistant",
              content: "Need a recap",
              createdAt: "2026-04-18T08:05:00.000Z",
              source: "agent",
            },
          ]
        : [
            {
              id: "m1",
              sessionId: "persisted-session",
              role: "assistant",
              content: "What does tomorrow look like?",
              createdAt: "2026-04-18T08:00:00.000Z",
              source: "agent",
            },
          ]
    ));

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    mocks.toastError.mockClear();

    await act(async () => {
      await result.current.resumeThread("resumed-session");
    });

    expect(result.current.activeThread?.sessionId).toBe("resumed-session");
    expect(result.current.messages[0]?.content).toBe("Need a recap");
    expect(result.current.pendingAction).toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith(
      COMPANION_PENDING_ACTIONS_DISABLED_REASON,
      { id: getPendingActionsSetupToastId() },
    );
    expect(mocks.toastError).not.toHaveBeenCalledWith(REOPEN_FAILED_TOAST);
  });

  it("uses the same scoped pending-actions setup toast id across repeated bootstraps", async () => {
    mocks.loadPendingAction.mockRejectedValue(createPendingActionsSetupError());

    const first = createWrapper();
    const firstRender = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper: first.wrapper },
    );

    await waitFor(() => {
      expect(firstRender.result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    firstRender.unmount();

    const second = createWrapper();
    const secondRender = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper: second.wrapper },
    );

    await waitFor(() => {
      expect(secondRender.result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    expect(mocks.toastError).toHaveBeenNthCalledWith(
      1,
      COMPANION_PENDING_ACTIONS_DISABLED_REASON,
      { id: getPendingActionsSetupToastId() },
    );
    expect(mocks.toastError).toHaveBeenNthCalledWith(
      2,
      COMPANION_PENDING_ACTIONS_DISABLED_REASON,
      { id: getPendingActionsSetupToastId() },
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
      await result.current.submitMessage("What does tomorrow look like?", "text");
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

    expect(result.current.messages.at(-1)?.content).toBe("Tomorrow is pretty light.");
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
    expect(result.current.messages.at(-1)?.content).toBe('Got it — "Gym" added for 3:00 PM.');
  });

  it("submits a pending launch intent only once after a threads-query remount", async () => {
    let resolveThreads: ((threads: Awaited<ReturnType<typeof mocks.listThreads>>) => void) | null = null;
    mocks.listThreads.mockImplementationOnce(() => new Promise((resolve) => {
      resolveThreads = resolve;
    }));

    const launchIntent = {
      id: "launch-intent-1",
      message: "Help me plan tomorrow.",
      starterIntent: "plan_my_day" as const,
      target: "planner" as const,
      briefingContext: null,
    };
    const onLaunchIntentConsumed = vi.fn();
    const { wrapper } = createWrapper();

    const firstRender = renderHook(
      () => useCompanionAssistant({
        surface: "journeys",
        launchIntent,
        onLaunchIntentConsumed,
      }),
      { wrapper },
    );

    expect(mocks.supabaseInvoke).not.toHaveBeenCalled();

    firstRender.unmount();

    renderHook(
      () => useCompanionAssistant({
        surface: "journeys",
        launchIntent,
        onLaunchIntentConsumed,
      }),
      { wrapper },
    );

    await act(async () => {
      resolveThreads?.([
        {
          sessionId: "persisted-session",
          companionId: mocks.currentCompanionId,
          surface: "journeys",
          title: "Current thread",
          previewText: "What does tomorrow look like?",
          createdAt: "2026-04-18T08:00:00.000Z",
          lastMessageAt: "2026-04-18T08:01:00.000Z",
          archivedAt: null,
          messageCount: 2,
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mocks.supabaseInvoke).toHaveBeenCalledTimes(1);
    });

    expect(mocks.supabaseInvoke).toHaveBeenCalledWith(
      "companion-agent",
      expect.objectContaining({
        body: expect.objectContaining({
          message: "Help me plan tomorrow.",
          surface: "journeys",
        }),
      }),
    );
    expect(onLaunchIntentConsumed).toHaveBeenCalledTimes(1);
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-intent-1");
  });

  it("keeps a persistent failed-message marker and retries without duplicating the user bubble", async () => {
    mocks.supabaseInvoke
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({
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

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useCompanionAssistant({ surface: "journeys" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("persisted-session");
    });

    await act(async () => {
      await result.current.submitMessage("What does tomorrow look like?", "text");
    });

    expect(result.current.error).toBe("Cosmiq hit a snag. Try that again.");
    expect(result.current.lastFailedMessage).toEqual({
      text: "What does tomorrow look like?",
      inputMode: "text",
      optimisticMessageId: expect.any(String),
    });
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(result.current.messages.filter((message) =>
      message.content.includes("I lost the thread for a second."),
    )).toHaveLength(0);

    await act(async () => {
      await result.current.retryLastMessage();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.lastFailedMessage).toBeNull();
    expect(result.current.messages.filter((message) => message.role === "user")).toHaveLength(1);
    expect(result.current.messages.at(-1)?.content).toBe("Tomorrow is pretty light.");
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
      await result.current.submitMessage("What does tomorrow look like?", "text");
    });

    expect(mocks.legacySubmitMessage).toHaveBeenCalledWith(
      "What does tomorrow look like?",
      "text",
    );
  });
});
