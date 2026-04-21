import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  JourneysCompanionPlannerModal,
  type JourneysCompanionPlannerAssistant,
} from "./JourneysCompanionPlannerModal";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    retryLastMessage: vi.fn().mockResolvedValue(undefined),
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

const buildAssistant = (
  overrides: Partial<JourneysCompanionPlannerAssistant> = {},
): JourneysCompanionPlannerAssistant => ({
  todayLabel: "Saturday, April 18",
  placeholder: "Talk to Cosmiq",
  messages: [
    {
      id: "m1",
      role: "assistant",
      content: "I can help you shape that into something concrete when you're ready.",
      createdAt: "2026-04-18T08:01:00.000Z",
      source: "agent",
    },
  ],
  pendingAction: {
    id: "action-1",
    status: "pending",
    intent: "schedule_task",
    actionType: "task_create",
    summary: 'Add "Focus block" for 2026-04-19 at 14:00.',
    confirmationMessage: 'Want me to add "Focus block" for 2026-04-19 at 14:00?',
    normalizedPayload: {},
    affectedEntities: null,
    expiresAt: "2026-04-19T20:00:00.000Z",
    createdAt: "2026-04-18T08:02:00.000Z",
  },
  error: null,
  lastFailedMessage: null,
  draftInput: "Plan tomorrow for me",
  setDraftInput: mocks.assistant.setDraftInput,
  interimText: "",
  isSubmitting: false,
  isResolvingAction: false,
  submitMessage: vi.fn(),
  submitTypedMessage: mocks.assistant.submitTypedMessage,
  retryLastMessage: mocks.assistant.retryLastMessage,
  confirmPendingAction: mocks.assistant.confirmPendingAction,
  cancelPendingAction: mocks.assistant.cancelPendingAction,
  isRecording: false,
  isAutoStopping: false,
  isVoiceSupported: true,
  permissionStatus: "granted",
  showPermissionDialog: false,
  setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
  isRequestingPermission: false,
  toggleRecording: mocks.assistant.toggleRecording,
  requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
  isSpeaking: false,
  speechProvider: "none",
  stopSpeaking: mocks.assistant.stopSpeaking,
  activeThread: {
    sessionId: "journeys-session-1",
    companionId: "companion-1",
    surface: "journeys",
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
      surface: "journeys",
      title: "Earlier thread",
      previewText: "Let's pick up yesterday's plan.",
      createdAt: "2026-04-17T08:00:00.000Z",
      lastMessageAt: "2026-04-17T08:05:00.000Z",
      archivedAt: "2026-04-17T09:00:00.000Z",
      messageCount: 4,
    },
  ],
  isLoadingThreads: false,
  hasPersistedActiveThread: true,
  canOpenThreadPicker: true,
  threadHistoryEmptyStateMessage: "Past chats will show up here after at least one real exchange.",
  resumeThread: mocks.assistant.resumeThread,
  archiveCurrentThread: mocks.assistant.archiveCurrentThread,
  canArchiveThread: true,
  archiveDisabledReason: null,
  startNewChat: mocks.assistant.startNewChat,
  canStartNewChat: true,
  newChatDisabledReason: null,
  ...overrides,
});

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

  it("does not expose the removed quest proposal handoff prop", () => {
    type ModalProps = ComponentProps<typeof JourneysCompanionPlannerModal>;
    type HasQuestProposalHandoff = "onQuestProposalEditHandoff" extends keyof ModalProps ? true : false;

    expectTypeOf<HasQuestProposalHandoff>().toEqualTypeOf<false>();
  });

  it("renders the unified transcript and inline pending confirmation card", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        assistant={buildAssistant()}
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
        assistant={buildAssistant()}
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

  it("wires inline confirm and cancel actions to the assistant", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        assistant={buildAssistant()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.assistant.confirmPendingAction).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.cancelPendingAction).toHaveBeenCalledTimes(1);
  });

  it("renders a persistent inline error row with retry", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        assistant={buildAssistant({
          pendingAction: null,
          error: "Cosmiq hit a snag. Try that again.",
          lastFailedMessage: {
            text: "Plan tomorrow for me",
            inputMode: "text",
            optimisticMessageId: "failed-message-1",
          },
        })}
      />,
    );

    expect(screen.getByTestId("journeys-companion-submit-error")).toHaveTextContent(
      "Cosmiq hit a snag. Try that again.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(mocks.assistant.retryLastMessage).toHaveBeenCalledTimes(1);
    });
  });
});
