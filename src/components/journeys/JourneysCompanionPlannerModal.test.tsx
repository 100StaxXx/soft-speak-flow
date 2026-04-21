import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    stopSpeaking: vi.fn(),
    startNewChat: vi.fn().mockResolvedValue(undefined),
    archiveCurrentThread: vi.fn().mockResolvedValue(undefined),
    resumeThread: vi.fn().mockResolvedValue(undefined),
  },
  drawerRootProps: [] as Array<Record<string, unknown>>,
  state: {
    messages: [
      {
        id: "m1",
        role: "assistant" as const,
        content: "I can help you shape that into something concrete when you're ready.",
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "agent" as const,
      },
    ],
    draftInput: "Plan tomorrow for me",
    pendingAction: {
      id: "action-1",
      status: "pending" as const,
      intent: "schedule_task" as const,
      actionType: "task_create" as const,
      summary: 'Add "Focus block" for 2026-04-19 at 14:00.',
      confirmationMessage: 'Want me to add "Focus block" for 2026-04-19 at 14:00?',
      normalizedPayload: {},
      affectedEntities: null,
      expiresAt: "2026-04-19T20:00:00.000Z",
      createdAt: "2026-04-18T08:02:00.000Z",
    },
    activeThread: {
      sessionId: "journeys-session-1",
      companionId: "companion-1",
      surface: "journeys" as const,
      title: "Current thread",
      previewText: "I can help you shape that into something concrete when you're ready.",
      createdAt: "2026-04-18T08:00:00.000Z",
      lastMessageAt: "2026-04-18T08:01:00.000Z",
      archivedAt: null,
      messageCount: 2,
    },
    historyThreads: [
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys" as const,
        title: "Earlier thread",
        previewText: "Let's pick up yesterday's plan.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
        messageCount: 4,
      },
    ],
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

vi.mock("@/hooks/useCompanionAssistant", () => ({
  useCompanionAssistant: () => ({
    todayLabel: "Saturday, April 18",
    placeholder: "Talk to Cosmiq",
    messages: mocks.state.messages,
    pendingAction: mocks.state.pendingAction,
    draftInput: mocks.state.draftInput,
    setDraftInput: mocks.assistant.setDraftInput,
    interimText: "",
    isSubmitting: false,
    isResolvingAction: false,
    submitTypedMessage: mocks.assistant.submitTypedMessage,
    confirmPendingAction: mocks.assistant.confirmPendingAction,
    cancelPendingAction: mocks.assistant.cancelPendingAction,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "granted" as const,
    showPermissionDialog: false,
    setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
    isRequestingPermission: false,
    toggleRecording: mocks.assistant.toggleRecording,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
    isSpeaking: false,
    speechProvider: "none" as const,
    stopSpeaking: mocks.assistant.stopSpeaking,
    activeThread: mocks.state.activeThread,
    historyThreads: mocks.state.historyThreads,
    isLoadingThreads: false,
    canOpenThreadPicker: true,
    threadHistoryEmptyStateMessage: "Past chats will show up here after at least one real exchange.",
    hasPersistedActiveThread: true,
    canStartNewChat: true,
    newChatDisabledReason: null,
    canArchiveThread: true,
    archiveDisabledReason: null,
    startNewChat: mocks.assistant.startNewChat,
    archiveCurrentThread: mocks.assistant.archiveCurrentThread,
    resumeThread: mocks.assistant.resumeThread,
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    open,
    children,
    ...props
  }: {
    open: boolean;
    children: ReactNode;
  } & Record<string, unknown>) => {
    mocks.drawerRootProps.push({ open, ...props });
    return open ? <div>{children}</div> : null;
  },
  DrawerContent: ({
    children,
    className,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
    <div className={className} {...props}>{children}</div>
  ),
  DrawerHeader: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { JourneysCompanionPlannerModal } from "./JourneysCompanionPlannerModal";

describe("JourneysCompanionPlannerModal", () => {
  const originalMatchMedia = window.matchMedia;
  const originalVisualViewport = window.visualViewport;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drawerRootProps.length = 0;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 700,
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVisualViewport,
    });
  });

  it("renders the unified transcript and inline pending confirmation card", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("I can help you shape that into something concrete when you're ready.")).toBeInTheDocument();
    expect(screen.getByText('Add "Focus block" for 2026-04-19 at 14:00.')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("opens thread history from the thread-history launch intent and resumes a selected thread", async () => {
    const onLaunchIntentConsumed = vi.fn();

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        launchIntent={{
          id: "launch-1",
          message: "",
          starterIntent: "thread_history",
        }}
        onLaunchIntentConsumed={onLaunchIntentConsumed}
      />,
    );

    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-1");

    await waitFor(() => {
      expect(screen.getByTestId("journeys-companion-thread-picker")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("journeys-companion-thread-resume-archived-session-1"));

    await waitFor(() => {
      expect(mocks.assistant.resumeThread).toHaveBeenCalledWith("archived-session-1");
    });
  });

  it("wires inline confirm and cancel actions to the unified assistant hook", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.assistant.confirmPendingAction).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.cancelPendingAction).toHaveBeenCalledTimes(1);
  });
});
