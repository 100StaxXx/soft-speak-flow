import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assistantCounter: 0,
  isNativePlatform: false,
  platform: "web",
  structuredResponse: null as null | {
    planDay?: {
      message: string;
      dayAssessment: string;
      suggestedQuests: Array<{
        suggestionId: string;
        proposalId?: string | null;
        title: string;
        type: string;
        estimatedDuration: string;
        source: string;
        reason: string;
      }>;
    };
    comingUp?: {
      message: string;
      nextEvent: { title: string; label: string } | null;
      remainingToday: Array<{ id: string; title: string; label: string }>;
      tomorrowSummary: string;
      missedItems: Array<{ id: string; title: string; label: string }>;
    };
  },
  pendingAction: null as null | {
    summary: string;
    confirmationMessage?: string | null;
  },
  error: null as string | null,
  lastFailedMessage: null as null | {
    text: string;
    inputMode: "text" | "voice";
    optimisticMessageId: string;
  },
  historyThreads: [] as Array<{
    sessionId: string;
    title: string;
    previewText: string;
    lastMessageAt: string;
  }>,
  canOpenThreadPicker: false,
  threadHistoryEmptyStateMessage: "",
  startNewChat: vi.fn(),
  archiveCurrentThread: vi.fn(),
  resumeThread: vi.fn(),
  retryLastMessage: vi.fn(),
  confirmPendingAction: vi.fn(),
  cancelPendingAction: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.isNativePlatform,
    getPlatform: () => mocks.platform,
  },
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    companionLabel: "Nova",
    imageUrl: "/placeholder-companion.svg",
    focalX: null,
    focalY: null,
    element: "fire",
    usesPortraitShell: false,
  }),
}));

vi.mock("@/hooks/useCompanionAssistant", async () => {
  const React = await import("react");

  return {
    useCompanionAssistant: () => {
      const [assistantId] = React.useState(() => `assistant-${++mocks.assistantCounter}`);
      const [draftInput, setDraftInput] = React.useState("Keep this thread alive");
      const [messages, setMessages] = React.useState<Array<{
        id: string;
        role: "assistant" | "user";
        content: string;
        createdAt: string;
      }>>([
        {
          id: "assistant-seed",
          role: "assistant" as const,
          content: `thread:${assistantId}`,
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ]);

      return {
        todayLabel: assistantId,
        placeholder: "chat",
        messages,
        structuredResponse: mocks.structuredResponse,
        pendingAction: mocks.pendingAction,
        error: mocks.error,
        lastFailedMessage: mocks.lastFailedMessage,
        draftInput,
        setDraftInput,
        interimText: "",
        isSubmitting: false,
        isResolvingAction: false,
        submitMessage: vi.fn(),
        submitTypedMessage: () => {
          setMessages((previous) => [
            ...previous,
            {
              id: `user-${previous.length}`,
              role: "user",
              content: draftInput,
              createdAt: "2026-04-21T10:01:00.000Z",
            },
          ]);
          setDraftInput("");
        },
        acceptSuggestedQuest: vi.fn(),
        retryLastMessage: mocks.retryLastMessage,
        confirmPendingAction: mocks.confirmPendingAction,
        cancelPendingAction: mocks.cancelPendingAction,
        isRecording: false,
        isAutoStopping: false,
        isVoiceSupported: false,
        permissionStatus: "granted" as const,
        showPermissionDialog: false,
        setShowPermissionDialog: vi.fn(),
        isRequestingPermission: false,
        toggleRecording: vi.fn(),
        requestMicrophonePermission: vi.fn(),
        isSpeaking: false,
        speechProvider: "none" as const,
        stopSpeaking: vi.fn(),
        activeThread: null,
        historyThreads: mocks.historyThreads,
        isLoadingThreads: false,
        hasPersistedActiveThread: false,
        canOpenThreadPicker: mocks.canOpenThreadPicker,
        threadHistoryEmptyStateMessage: mocks.threadHistoryEmptyStateMessage,
        resumeThread: mocks.resumeThread,
        archiveCurrentThread: mocks.archiveCurrentThread,
        canArchiveThread: false,
        archiveDisabledReason: null,
        startNewChat: mocks.startNewChat,
        canStartNewChat: true,
        newChatDisabledReason: null,
      };
    },
  };
});

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DrawerContent: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DrawerHeader: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { JourneysCompanionPlannerController } from "./JourneysCompanionPlannerModal";

type MockVisualViewport = {
  height: number;
  offsetTop: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatch: (type: "resize" | "scroll") => void;
};

const createMockVisualViewport = ({
  height,
  offsetTop,
}: {
  height: number;
  offsetTop?: number;
}): MockVisualViewport => {
  const listeners = new Map<"resize" | "scroll", Set<() => void>>([
    ["resize", new Set()],
    ["scroll", new Set()],
  ]);

  return {
    height,
    offsetTop: offsetTop ?? 0,
    addEventListener: vi.fn((type: "resize" | "scroll", listener: () => void) => {
      listeners.get(type)?.add(listener);
    }),
    removeEventListener: vi.fn((type: "resize" | "scroll", listener: () => void) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatch: (type: "resize" | "scroll") => {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
  };
};

describe("JourneysCompanionPlannerController", () => {
  beforeEach(() => {
    mocks.assistantCounter = 0;
    mocks.isNativePlatform = false;
    mocks.platform = "web";
    mocks.structuredResponse = null;
    mocks.pendingAction = null;
    mocks.error = null;
    mocks.lastFailedMessage = null;
    mocks.historyThreads = [];
    mocks.canOpenThreadPicker = false;
    mocks.threadHistoryEmptyStateMessage = "";
    mocks.startNewChat.mockReset();
    mocks.archiveCurrentThread.mockReset();
    mocks.resumeThread.mockReset();
    mocks.retryLastMessage.mockReset();
    mocks.confirmPendingAction.mockReset();
    mocks.cancelPendingAction.mockReset();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 900,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("keeps the journeys assistant state alive while the modal view closes and reopens", () => {
    const { rerender } = render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("thread:assistant-1")).toBeInTheDocument();
    expect(screen.getByText("assistant-1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));
    expect(screen.getByText("Keep this thread alive")).toBeInTheDocument();

    rerender(
      <JourneysCompanionPlannerController
        open={false}
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.queryByText("Keep this thread alive")).not.toBeInTheDocument();

    rerender(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("thread:assistant-1")).toBeInTheDocument();
    expect(screen.getByText("assistant-1")).toBeInTheDocument();
    expect(screen.getByText("Keep this thread alive")).toBeInTheDocument();
  });

  it("renders the ornate header actions and keeps the restored bubble styling for assistant and user messages", () => {
    render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-new-chat-button")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-thread-history-button")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("chat")).toBeInTheDocument();

    const assistantBubble = screen.getByText("thread:assistant-1").closest('[data-message-role="assistant"]');
    expect(assistantBubble).toBeInTheDocument();
    expect(assistantBubble?.className).toContain("border-[#6d3518]");

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    const userBubble = screen.getByText("Keep this thread alive").closest('[data-message-role="user"]');
    expect(userBubble).toBeInTheDocument();
    expect(userBubble?.className).toContain("border-[#4f6716]");
  });

  it("opens thread history immediately for a thread_history launch intent", () => {
    mocks.historyThreads = [
      {
        sessionId: "thread-1",
        title: "Morning check-in",
        previewText: "Let’s rebalance the morning.",
        lastMessageAt: "2026-04-21T10:00:00.000Z",
      },
    ];
    mocks.canOpenThreadPicker = true;
    const onLaunchIntentConsumed = vi.fn();

    render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        launchIntent={{
          id: "intent-1",
          message: "",
          starterIntent: "thread_history",
          target: "planner",
          briefingContext: null,
        }}
        onLaunchIntentConsumed={onLaunchIntentConsumed}
      />,
    );

    expect(screen.getByTestId("journeys-companion-thread-picker")).toBeInTheDocument();
    expect(screen.getByText("Morning check-in")).toBeInTheDocument();
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("intent-1");
  });

  it("renders structured cards plus pending and retry states inside the restored shell", () => {
    mocks.structuredResponse = {
      planDay: {
        message: "We should protect your energy first.",
        dayAssessment: "low_energy",
        suggestedQuests: [
          {
            suggestionId: "quest-1",
            proposalId: "proposal-1",
            title: "Daily Hydration",
            type: "should",
            estimatedDuration: "10 min",
            source: "recovery",
            reason: "It will help your baseline.",
          },
        ],
      },
      comingUp: {
        message: "Here’s what the rest of the day looks like.",
        nextEvent: {
          title: "Sales block",
          label: "11:00 AM",
        },
        remainingToday: [
          {
            id: "item-1",
            title: "Follow up leads",
            label: "After lunch",
          },
        ],
        tomorrowSummary: "light",
        missedItems: [
          {
            id: "missed-1",
            title: "Stretch",
            label: "Missed this morning",
          },
        ],
      },
    };
    mocks.pendingAction = {
      summary: "Create the Daily Hydration quest?",
      confirmationMessage: "Nothing changes until you confirm it.",
    };
    mocks.error = "Cosmiq hit a snag. Try that again.";
    mocks.lastFailedMessage = {
      text: "retry me",
      inputMode: "text",
      optimisticMessageId: "failed-1",
    };

    render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("Plan My Day")).toBeInTheDocument();
    expect(screen.getByText("We should protect your energy first.")).toBeInTheDocument();
    expect(screen.getByText("Daily Hydration")).toBeInTheDocument();
    expect(screen.getByText("Coming Up")).toBeInTheDocument();
    expect(screen.getByText("Sales block")).toBeInTheDocument();
    expect(screen.getByText("Pending Confirmation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByText("Cosmiq hit a snag. Try that again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("autofocuses the composer on web but not on native ios", () => {
    const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, "focus").mockImplementation(() => {});
    const rafSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(focusSpy).toHaveBeenCalledTimes(1);

    focusSpy.mockClear();
    mocks.isNativePlatform = true;
    mocks.platform = "ios";

    render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    expect(focusSpy).not.toHaveBeenCalled();
    rafSpy.mockRestore();
    focusSpy.mockRestore();
  });

  it("keeps drawer height responsive without lifting the whole shell above the keyboard", () => {
    const visualViewport = createMockVisualViewport({ height: 820 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      writable: true,
      value: visualViewport,
    });

    render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    const shell = screen.getByTestId("journeys-companion-planner-shell");
    expect(shell.style.height).toBe("736px");
    expect(shell.style.paddingBottom).toBe("");

    act(() => {
      visualViewport.height = 540;
      visualViewport.dispatch("resize");
    });

    expect(shell.style.height).toBe("516px");
    expect(shell.style.paddingBottom).toBe("");
  });

  it("auto-grows and shrinks the composer as the draft changes", () => {
    render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    const composer = screen.getByTestId("journeys-companion-planner-text-input") as HTMLTextAreaElement;
    let mockedScrollHeight = 68;

    Object.defineProperty(composer, "scrollHeight", {
      configurable: true,
      get: () => mockedScrollHeight,
    });

    fireEvent.change(composer, { target: { value: "building\nmy app" } });
    expect(composer.style.height).toBe("68px");
    expect(composer.style.overflowY).toBe("hidden");

    mockedScrollHeight = 220;
    fireEvent.change(composer, { target: { value: "building\nmy app\nwith more detail\nand even more detail" } });
    expect(composer.style.height).toBe("160px");
    expect(composer.style.overflowY).toBe("auto");

    mockedScrollHeight = 52;
    fireEvent.change(composer, { target: { value: "done" } });
    expect(composer.style.height).toBe("52px");
    expect(composer.style.overflowY).toBe("hidden");
  });
});
