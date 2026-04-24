import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";
import { useJourneysCompanionThreads } from "./useJourneysCompanionThreads";

const mocks = vi.hoisted(() => ({
  generatedSessionIds: ["fresh-session-1", "fresh-session-2", "fresh-session-3"] as string[],
  listCompanionChatThreads: vi.fn(),
  loadCompanionChatThreadMessages: vi.fn(),
  setCompanionChatThreadArchived: vi.fn().mockResolvedValue(undefined),
  toastError: vi.fn(),
  resetConversationThread: vi.fn(),
  hydrateConversationThread: vi.fn(),
  resetPlannerThread: vi.fn(),
  hydratePlannerThread: vi.fn(),
}));

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/services/companionChatThreads", () => ({
  buildCompanionThreadPreview: (value: string) => value || "No messages yet.",
  buildCompanionThreadTitle: (value: string) => value || "New thread",
  generateCompanionThreadSessionId: () => mocks.generatedSessionIds.shift() ?? "fallback-session",
  getCompanionChatThreadsQueryKey: (userId: string | null | undefined, companionId: string | null | undefined, surface: string) => [
    "companion-chat-threads",
    userId ?? "anon",
    companionId ?? "none",
    surface,
  ],
  listCompanionChatThreads: (...args: unknown[]) => mocks.listCompanionChatThreads(...args),
  loadCompanionChatThreadMessages: (...args: unknown[]) => mocks.loadCompanionChatThreadMessages(...args),
  setCompanionChatThreadArchived: (...args: unknown[]) => mocks.setCompanionChatThreadArchived(...args),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const renderJourneysThreads = (overrides?: Partial<Parameters<typeof useJourneysCompanionThreads>[0]>) =>
  renderHook(
    () =>
      useJourneysCompanionThreads({
        enabled: true,
        userId: "user-1",
        companionId: "companion-1",
        messages: [],
        persistenceReady: true,
        persistenceUnavailableReason: null,
        hasPendingPlannerWork: false,
        isBusy: false,
        conversation: {
          sessionId: null,
          resetThread: mocks.resetConversationThread,
          hydrateThread: mocks.hydrateConversationThread,
        },
        planner: {
          sessionId: null,
          resetThread: mocks.resetPlannerThread,
          hydrateThread: mocks.hydratePlannerThread,
        },
        ...overrides,
      }),
    { wrapper: createWrapper() },
  );

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

describe("useJourneysCompanionThreads", () => {
  const seededFreshThreadGreeting = getCompanionPlannerOpener({ userId: "user-1" });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generatedSessionIds = ["fresh-session-1", "fresh-session-2", "fresh-session-3"];
    const threadRows = [
      {
        sessionId: "active-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Current thread",
        previewText: "Let's plan today.",
        createdAt: "2026-04-18T08:00:00.000Z",
        lastMessageAt: "2026-04-18T08:05:00.000Z",
        archivedAt: null,
        messageCount: 2,
      },
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Old thread",
        previewText: "We can pick this back up.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
        messageCount: 4,
      },
      {
        sessionId: "seed-only-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Too short",
        previewText: "Not enough history yet.",
        createdAt: "2026-04-16T08:00:00.000Z",
        lastMessageAt: "2026-04-16T08:01:00.000Z",
        archivedAt: "2026-04-16T08:10:00.000Z",
        messageCount: 1,
      },
    ];
    mocks.listCompanionChatThreads.mockImplementation(async () => threadRows);
    mocks.setCompanionChatThreadArchived.mockImplementation(async (sessionId: string, archived: boolean) => {
      const thread = threadRows.find((entry) => entry.sessionId === sessionId);
      if (thread) {
        thread.archivedAt = archived ? "2026-04-19T09:00:00.000Z" : null;
      }
    });
    mocks.loadCompanionChatThreadMessages.mockImplementation(async (sessionId: string) => {
      if (sessionId === "archived-session-1") {
        return [
          {
            id: "archived-chat-1",
            sessionId,
            role: "assistant" as const,
            content: "Welcome back.",
            createdAt: "2026-04-17T08:00:00.000Z",
            source: "chat" as const,
          },
          {
            id: "archived-plan-1",
            sessionId,
            role: "assistant" as const,
            content: "Let's shape the week.",
            createdAt: "2026-04-17T08:02:00.000Z",
            source: "plan" as const,
          },
        ];
      }

      return [
        {
          id: "active-chat-1",
          sessionId,
          role: "assistant" as const,
          content: "Let's plan today.",
          createdAt: "2026-04-18T08:00:00.000Z",
          source: "chat" as const,
        },
        {
          id: "active-plan-1",
          sessionId,
          role: "assistant" as const,
          content: "You have room this afternoon.",
          createdAt: "2026-04-18T08:03:00.000Z",
          source: "plan" as const,
        },
      ];
    });
  });

  it("loads the latest active persisted thread and only exposes eligible past chats", async () => {
    const { result } = renderJourneysThreads();

    await waitFor(() => {
      expect(mocks.hydrateConversationThread).toHaveBeenCalledWith({
        sessionId: "active-session-1",
        messages: [
          expect.objectContaining({
            id: "active-chat-1",
            content: "Let's plan today.",
          }),
        ],
      });
    });

    expect(mocks.hydratePlannerThread).toHaveBeenCalledWith({
      sessionId: "active-session-1",
      messages: [
        expect.objectContaining({
          id: "active-plan-1",
          content: "You have room this afternoon.",
        }),
      ],
    });
    expect(result.current.activeThread?.sessionId).toBe("active-session-1");
    expect(result.current.hasPersistedActiveThread).toBe(true);
    expect(result.current.canStartNewChat).toBe(true);
    expect(result.current.newChatDisabledReason).toBeNull();
    expect(result.current.historyThreads).toEqual([
      expect.objectContaining({
        sessionId: "archived-session-1",
      }),
    ]);
  });

  it("hydrates agent-originated planner turns into the planner thread when structured output exists", async () => {
    mocks.loadCompanionChatThreadMessages.mockResolvedValue([
      {
        id: "active-chat-1",
        sessionId: "active-session-1",
        role: "assistant" as const,
        content: "Let's plan today.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat" as const,
      },
      {
        id: "active-agent-plan-1",
        sessionId: "active-session-1",
        role: "assistant" as const,
        content: "I drafted a focused day for you.",
        createdAt: "2026-04-18T08:03:00.000Z",
        source: "agent" as const,
        structuredResponse: {
          intent: {
            intentType: "quest" as const,
            timeHorizon: "today" as const,
            isRecurring: false,
            shouldCreateQuest: true,
            shouldPromptCampaign: false,
          },
          planDay: {
            message: "I drafted a focused day for you.",
            dayAssessment: "balanced" as const,
            suggestedQuests: [],
          },
        },
      },
    ]);

    renderJourneysThreads();

    await waitFor(() => {
      expect(mocks.hydratePlannerThread).toHaveBeenCalledWith({
        sessionId: "active-session-1",
        messages: [
          expect.objectContaining({
            id: "active-agent-plan-1",
            content: "I drafted a focused day for you.",
            structuredResponse: expect.objectContaining({
              planDay: expect.objectContaining({
                message: "I drafted a focused day for you.",
              }),
            }),
          }),
        ],
      });
    });
  });

  it("preserves externally hydrated thread state when the fallback thread manager wakes up", async () => {
    const { result, rerender } = renderHook(
      (props: {
        enabled: boolean;
        messages: Array<{
          role: "assistant" | "user";
          content: string;
          createdAt: string;
          source: "chat" | "plan";
          isSeed?: boolean;
        }>;
        sessionId: string | null;
      }) =>
        useJourneysCompanionThreads({
          enabled: props.enabled,
          userId: "user-1",
          companionId: "companion-1",
          messages: props.messages,
          persistenceReady: true,
          persistenceUnavailableReason: null,
          hasPendingPlannerWork: false,
          isBusy: false,
          conversation: {
            sessionId: props.sessionId,
            resetThread: mocks.resetConversationThread,
            hydrateThread: mocks.hydrateConversationThread,
          },
          planner: {
            sessionId: props.sessionId,
            resetThread: mocks.resetPlannerThread,
            hydrateThread: mocks.hydratePlannerThread,
          },
        }),
      {
        initialProps: {
          enabled: false,
          sessionId: "fallback-session-1",
          messages: [
            {
              role: "assistant" as const,
              content: "We already have a hydrated fallback thread.",
              createdAt: "2026-04-18T08:00:00.000Z",
              source: "chat" as const,
            },
          ],
        },
        wrapper: createWrapper(),
      },
    );

    rerender({
      enabled: true,
      sessionId: "fallback-session-1",
      messages: [
        {
          role: "assistant" as const,
          content: "We already have a hydrated fallback thread.",
          createdAt: "2026-04-18T08:00:00.000Z",
          source: "chat" as const,
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("fallback-session-1");
    });

    expect(mocks.resetConversationThread).not.toHaveBeenCalled();
    expect(mocks.resetPlannerThread).not.toHaveBeenCalled();
    expect(mocks.hydrateConversationThread).not.toHaveBeenCalled();
    expect(mocks.hydratePlannerThread).not.toHaveBeenCalled();
  });

  it("seeds a fresh local thread when no persisted active thread exists", async () => {
    mocks.listCompanionChatThreads.mockResolvedValue([
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Old thread",
        previewText: "We can pick this back up.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
        messageCount: 4,
      },
    ]);

    const { result } = renderJourneysThreads();

    await waitFor(() => {
      expect(mocks.listCompanionChatThreads).toHaveBeenCalled();
    });

    expect(mocks.hydrateConversationThread).not.toHaveBeenCalled();
    expect(result.current.activeThread?.sessionId).toBe("fresh-session-1");
    expect(result.current.activeThread?.title).toBe("New thread");
    expect(result.current.activeThread?.previewText).toBe("No messages yet.");
    await waitFor(() => {
      expect(mocks.resetConversationThread).toHaveBeenLastCalledWith({
        sessionId: "fresh-session-1",
        greetingText: seededFreshThreadGreeting,
      });
    });
  });

  it("does not archive when the thread is still blank", async () => {
    mocks.listCompanionChatThreads.mockResolvedValue([
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Old thread",
        previewText: "We can pick this back up.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
        messageCount: 4,
      },
    ]);

    const { result } = renderJourneysThreads({
      messages: [],
    });

    await waitFor(() => {
      expect(result.current.canArchiveThread).toBe(false);
    });

    await act(async () => {
      await result.current.archiveCurrentThread();
    });

    expect(result.current.archiveDisabledReason).toBe(
      "Start the conversation before archiving this thread.",
    );
    expect(mocks.setCompanionChatThreadArchived).not.toHaveBeenCalled();
    expect(mocks.resetConversationThread).not.toHaveBeenCalledWith({
      sessionId: "fresh-session-2",
    });
  });

  it("disables thread controls when persistence is unavailable for the session", async () => {
    const { result } = renderJourneysThreads({
      persistenceReady: false,
      persistenceUnavailableReason: "Thread history will be available after the latest backend update.",
      messages: [
        {
          role: "user",
          content: "Stay with me here.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.canOpenThreadPicker).toBe(false);
    });

    expect(result.current.canArchiveThread).toBe(false);
    expect(result.current.threadHistoryEmptyStateMessage).toBe(
      "Past chats will show up after the latest backend update.",
    );
  });

  it("falls back to a local thread when thread history storage is not set up yet", async () => {
    mocks.listCompanionChatThreads.mockRejectedValueOnce({
      code: "42P01",
      message: "relation \"companion_chat_threads\" does not exist",
      details: null,
      hint: null,
    });

    const { result } = renderJourneysThreads({
      messages: [
        {
          role: "user",
          content: "Keep talking without history.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.canOpenThreadPicker).toBe(false);
    });

    expect(result.current.activeThread?.sessionId).toBe("fresh-session-1");
    expect(result.current.historyThreads).toHaveLength(0);
    expect(result.current.threadPickerDisabledReason).toBe(
      "Thread history will be available after the latest backend update.",
    );
    expect(mocks.resetConversationThread).toHaveBeenCalledTimes(1);
    expect(mocks.resetConversationThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-1",
    });
  });

  it("seeds a fresh thread after bootstrap hydration fails to reopen the latest thread", async () => {
    mocks.loadCompanionChatThreadMessages.mockRejectedValueOnce(new Error("network hiccup"));

    const { result } = renderJourneysThreads();

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "I couldn't reopen the latest thread, so I started a fresh one.",
      );
    });

    expect(mocks.resetConversationThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
      greetingText: seededFreshThreadGreeting,
    });
    expect(result.current.activeThread?.sessionId).toBe("fresh-session-2");
  });

  it("archives the active persisted thread without starting a fresh one", async () => {
    const { result } = renderJourneysThreads({
      messages: [
        {
          role: "user",
          content: "Help me shape today.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("active-session-1");
    });

    await act(async () => {
      await result.current.archiveCurrentThread();
    });

    expect(mocks.setCompanionChatThreadArchived).toHaveBeenCalledWith("active-session-1", true);
    expect(mocks.resetConversationThread).not.toHaveBeenCalledWith({
      sessionId: "fresh-session-2",
    });
    expect(mocks.resetPlannerThread).not.toHaveBeenCalledWith({
      sessionId: "fresh-session-2",
    });
    expect(result.current.activeThread?.sessionId).toBe("active-session-1");
    await waitFor(() => {
      expect(result.current.historyThreads).toEqual(expect.arrayContaining([
        expect.objectContaining({
          sessionId: "active-session-1",
        }),
      ]));
    });
  });

  it("archives the active persisted thread before starting a fresh chat", async () => {
    const { result } = renderJourneysThreads({
      messages: [
        {
          role: "user",
          content: "Help me shape today.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("active-session-1");
    });

    await act(async () => {
      await result.current.startNewChat();
    });

    expect(mocks.setCompanionChatThreadArchived).toHaveBeenCalledWith("active-session-1", true);
    expect(mocks.resetConversationThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
      greetingText: seededFreshThreadGreeting,
    });
    expect(mocks.resetPlannerThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
    });
    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("fresh-session-2");
    });
    expect(result.current.hasPersistedActiveThread).toBe(false);
  });

  it("keeps a template-started fresh thread when bootstrap hydration resolves late", async () => {
    const deferredMessages = createDeferred<Array<{
      id: string;
      sessionId: string;
      role: "assistant";
      content: string;
      createdAt: string;
      source: "chat" | "plan";
    }>>();

    mocks.loadCompanionChatThreadMessages.mockImplementationOnce(async () => deferredMessages.promise);

    const { result } = renderJourneysThreads();

    await waitFor(() => {
      expect(mocks.loadCompanionChatThreadMessages).toHaveBeenCalledWith("active-session-1", "journeys");
    });

    act(() => {
      result.current.startTemplateThread();
    });

    expect(mocks.resetConversationThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
    });
    expect(mocks.resetPlannerThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
    });

    await waitFor(() => {
      expect(mocks.setCompanionChatThreadArchived).toHaveBeenCalledWith("active-session-1", true);
    });

    deferredMessages.resolve([
      {
        id: "late-chat-1",
        sessionId: "active-session-1",
        role: "assistant",
        content: "This old thread should stay archived.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat",
      },
      {
        id: "late-plan-1",
        sessionId: "active-session-1",
        role: "assistant",
        content: "And this old planner draft should not hydrate.",
        createdAt: "2026-04-18T08:02:00.000Z",
        source: "plan",
      },
    ]);

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("fresh-session-2");
    });

    expect(mocks.hydrateConversationThread).not.toHaveBeenCalledWith({
      sessionId: "active-session-1",
      messages: expect.anything(),
    });
    expect(mocks.hydratePlannerThread).not.toHaveBeenCalledWith({
      sessionId: "active-session-1",
      messages: expect.anything(),
    });
  });

  it("starts a fresh local chat without archiving when no persisted active thread exists", async () => {
    mocks.listCompanionChatThreads.mockResolvedValue([
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Old thread",
        previewText: "We can pick this back up.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
        messageCount: 4,
      },
    ]);

    const { result } = renderJourneysThreads({
      messages: [],
    });

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("fresh-session-1");
    });
    await waitFor(() => {
      expect(result.current.canStartNewChat).toBe(true);
    });

    await act(async () => {
      await result.current.startNewChat();
    });

    expect(mocks.setCompanionChatThreadArchived).not.toHaveBeenCalled();
    expect(mocks.resetConversationThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
      greetingText: seededFreshThreadGreeting,
    });
    expect(mocks.resetPlannerThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
    });
    expect(result.current.activeThread?.sessionId).toBe("fresh-session-2");
  });

  it("disables new chat while thread history is still loading", () => {
    const { result } = renderJourneysThreads();

    expect(result.current.canStartNewChat).toBe(false);
    expect(result.current.newChatDisabledReason).toBe("Loading thread history.");
  });

  it("disables new chat while the assistant is busy", async () => {
    const { result } = renderJourneysThreads({
      isBusy: true,
      messages: [
        {
          role: "user",
          content: "Keep this active for now.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.isLoadingThreads).toBe(false);
    });

    expect(result.current.canStartNewChat).toBe(false);
    expect(result.current.newChatDisabledReason).toBe("Wait for the current reply to finish.");
  });

  it("disables new chat while planner work is still pending", async () => {
    const { result } = renderJourneysThreads({
      hasPendingPlannerWork: true,
      messages: [
        {
          role: "user",
          content: "Keep this active for now.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.isLoadingThreads).toBe(false);
    });

    expect(result.current.canStartNewChat).toBe(false);
    expect(result.current.newChatDisabledReason).toBe(
      "Finish or dismiss the current plan before starting a new chat.",
    );
  });

  it("archives the current active thread before resuming an archived one", async () => {
    const { result } = renderJourneysThreads({
      messages: [
        {
          role: "user",
          content: "Keep this active for now.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.activeThread?.sessionId).toBe("active-session-1");
    });

    await act(async () => {
      await result.current.resumeThread("archived-session-1");
    });

    expect(mocks.setCompanionChatThreadArchived).toHaveBeenNthCalledWith(1, "active-session-1", true);
    expect(mocks.setCompanionChatThreadArchived).toHaveBeenNthCalledWith(2, "archived-session-1", false);
    expect(mocks.hydrateConversationThread).toHaveBeenLastCalledWith({
      sessionId: "archived-session-1",
      messages: [
        expect.objectContaining({
          id: "archived-chat-1",
        }),
      ],
    });
    expect(mocks.hydratePlannerThread).toHaveBeenLastCalledWith({
      sessionId: "archived-session-1",
      messages: [
        expect.objectContaining({
          id: "archived-plan-1",
        }),
      ],
    });
  });

  it("reopens with a fresh local thread after the current thread is archived", async () => {
    const initial = renderJourneysThreads({
      messages: [
        {
          role: "user",
          content: "Keep this active for now.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(initial.result.current.activeThread?.sessionId).toBe("active-session-1");
    });

    await act(async () => {
      await initial.result.current.archiveCurrentThread();
    });

    initial.unmount();

    const reloaded = renderJourneysThreads();

    await waitFor(() => {
      expect(reloaded.result.current.activeThread?.sessionId).toBe("fresh-session-2");
    });
  });

  it("reopens the resumed thread as the active thread after a reload", async () => {
    const initial = renderJourneysThreads({
      messages: [
        {
          role: "user",
          content: "Keep this active for now.",
          createdAt: "2026-04-19T08:05:00.000Z",
          source: "chat",
        },
      ],
    });

    await waitFor(() => {
      expect(initial.result.current.activeThread?.sessionId).toBe("active-session-1");
    });

    await act(async () => {
      await initial.result.current.resumeThread("archived-session-1");
    });

    initial.unmount();

    const reloaded = renderJourneysThreads();

    await waitFor(() => {
      expect(reloaded.result.current.activeThread?.sessionId).toBe("archived-session-1");
    });
  });
});
