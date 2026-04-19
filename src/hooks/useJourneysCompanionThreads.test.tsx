import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  buildCompanionThreadPreview: (value: string) => value,
  buildCompanionThreadTitle: (value: string) => value,
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
        greeting: "The road's open.",
        messages: [
          {
            role: "assistant",
            content: "The road's open.",
            createdAt: "2026-04-19T08:00:00.000Z",
            source: "chat",
            isSeed: true,
          },
        ],
        hasPendingPlannerWork: false,
        isBusy: false,
        conversation: {
          resetThread: mocks.resetConversationThread,
          hydrateThread: mocks.hydrateConversationThread,
        },
        planner: {
          resetThread: mocks.resetPlannerThread,
          hydrateThread: mocks.hydratePlannerThread,
        },
        ...overrides,
      }),
    { wrapper: createWrapper() },
  );

describe("useJourneysCompanionThreads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generatedSessionIds = ["fresh-session-1", "fresh-session-2", "fresh-session-3"];
    mocks.listCompanionChatThreads.mockResolvedValue([
      {
        sessionId: "active-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Current thread",
        previewText: "Let's plan today.",
        createdAt: "2026-04-18T08:00:00.000Z",
        lastMessageAt: "2026-04-18T08:05:00.000Z",
        archivedAt: null,
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
      },
    ]);
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

  it("loads the latest active persisted thread and hydrates both chat lanes", async () => {
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
    expect(result.current.archivedThreads).toHaveLength(1);
  });

  it("keeps a fresh local thread when no persisted active thread exists", async () => {
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
      },
    ]);

    const { result } = renderJourneysThreads();

    await waitFor(() => {
      expect(mocks.listCompanionChatThreads).toHaveBeenCalled();
    });

    expect(mocks.hydrateConversationThread).not.toHaveBeenCalled();
    expect(result.current.activeThread?.sessionId).toBe("fresh-session-1");
  });

  it("blocks archiving when the thread only has the seeded opener", async () => {
    const { result } = renderJourneysThreads({
      messages: [
        {
          role: "assistant",
          content: "The road's open.",
          createdAt: "2026-04-19T08:00:00.000Z",
          source: "chat",
          isSeed: true,
        },
      ],
    });

    await waitFor(() => {
      expect(result.current.canArchiveThread).toBe(false);
    });

    expect(result.current.archiveDisabledReason).toContain("Start the conversation");
  });

  it("archives the active thread and starts a fresh one", async () => {
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
    expect(mocks.resetConversationThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
      greetingText: "The road's open.",
    });
    expect(mocks.resetPlannerThread).toHaveBeenLastCalledWith({
      sessionId: "fresh-session-2",
    });
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
});
