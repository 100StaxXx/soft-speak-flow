import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    confirmSuggestedQuest: vi.fn(),
    confirmAllPendingActions: vi.fn(),
    stopSpeaking: vi.fn(),
    startNewChat: vi.fn().mockResolvedValue(undefined),
    archiveCurrentThread: vi.fn().mockResolvedValue(undefined),
    resumeThread: vi.fn().mockResolvedValue(undefined),
  },
  planningMode: {
    setPlanningMode: vi.fn(),
  },
  drawerRootProps: [] as Array<Record<string, unknown>>,
  state: {
    messages: [
      {
        id: "m1",
        role: "assistant" as const,
        content:
          "I can help you shape that into something concrete when you're ready.",
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
      proposalId: null,
      summary: 'Add "Focus block" for 2026-04-19 at 14:00.',
      confirmationMessage:
        'Want me to add "Focus block" for 2026-04-19 at 14:00?',
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
      previewText:
        "I can help you shape that into something concrete when you're ready.",
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
    structuredResponse: {
      intent: {
        intentType: "conversation" as const,
        timeHorizon: "today" as const,
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      planDay: {
        message: "Today is best as a balanced push with one clear focus block.",
        dayAssessment: "balanced" as const,
        suggestedQuests: [
          {
            suggestionId: "plan-1",
            proposalId: "proposal-plan-1",
            title: "Outline the launch checklist",
            type: "must" as const,
            estimatedDuration: "45 min",
            estimatedDurationMinutes: 45,
            source: "campaign" as const,
            reason:
              "It keeps the launch campaign moving without crowding the afternoon.",
          },
        ],
      },
    } as CompanionStructuredResponse,
    savedSuggestionProposalIds: ["proposal-plan-1"],
    pendingSuggestionProposalId: null as string | null,
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
    structuredResponse: mocks.state.structuredResponse,
    planningMode: "balanced" as const,
    setPlanningMode: mocks.planningMode.setPlanningMode,
    pendingAction: mocks.state.pendingAction,
    savedSuggestionProposalIds: mocks.state.savedSuggestionProposalIds,
    pendingSuggestionProposalId: mocks.state.pendingSuggestionProposalId,
    pendingActionCount: 3,
    readyPendingActionCount: 3,
    draftInput: mocks.state.draftInput,
    setDraftInput: mocks.assistant.setDraftInput,
    interimText: "",
    isSubmitting: false,
    isResolvingAction: false,
    submitTypedMessage: mocks.assistant.submitTypedMessage,
    confirmPendingAction: mocks.assistant.confirmPendingAction,
    cancelPendingAction: mocks.assistant.cancelPendingAction,
    confirmSuggestedQuest: mocks.assistant.confirmSuggestedQuest,
    confirmAllPendingActions: mocks.assistant.confirmAllPendingActions,
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
    threadHistoryEmptyStateMessage:
      "Past chats will show up here after at least one real exchange.",
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
  Dialog: (
    { open, children }: { open: boolean; children: ReactNode },
  ) => (open ? <div>{children}</div> : null),
  DialogContent: (
    { children, className }: { children: ReactNode; className?: string },
  ) => <div className={className}>{children}</div>,
  DialogHeader: (
    { children, className }: { children: ReactNode; className?: string },
  ) => <div className={className}>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
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
  DrawerHeader: (
    { children, className }: { children: ReactNode; className?: string },
  ) => <div className={className}>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
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

    expect(
      screen.getByText(
        "I can help you shape that into something concrete when you're ready.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("structured-plan-day")).toBeInTheDocument();
    expect(screen.getByText("Outline the launch checklist"))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByText('Add "Focus block" for 2026-04-19 at 14:00.'))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm All (3)" }))
      .toBeInTheDocument();
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
      expect(screen.getByTestId("journeys-companion-thread-picker"))
        .toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByTestId("journeys-companion-thread-resume-archived-session-1"),
    );

    await waitFor(() => {
      expect(mocks.assistant.resumeThread).toHaveBeenCalledWith(
        "archived-session-1",
      );
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

    fireEvent.click(screen.getByRole("button", { name: "Confirm All (3)" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mocks.assistant.confirmAllPendingActions).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.confirmPendingAction).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.cancelPendingAction).toHaveBeenCalledTimes(1);
  });

  it("lets the user confirm a specific structured quest suggestion", () => {
    const previousPendingAction = mocks.state.pendingAction;
    const previousSavedSuggestionProposalIds =
      mocks.state.savedSuggestionProposalIds;
    mocks.state.pendingAction = null;
    mocks.state.savedSuggestionProposalIds = [];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByTestId("structured-suggestion-confirm-plan-1"));

    expect(mocks.assistant.confirmSuggestedQuest).toHaveBeenCalledWith(
      "proposal-plan-1",
    );

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.savedSuggestionProposalIds = previousSavedSuggestionProposalIds;
  });

  it("lets the user switch the day mode inside the journeys planner shell", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByTestId("companion-planning-mode-lock_in"));

    expect(mocks.planningMode.setPlanningMode).toHaveBeenCalledWith("lock_in");
  });

  it("keeps proposal-backed weekly, tomorrow, and priority cards actionable in the journeys shell", () => {
    const previousStructuredResponse = mocks.state.structuredResponse;
    const previousPendingAction = mocks.state.pendingAction;
    const previousSavedSuggestionProposalIds =
      mocks.state.savedSuggestionProposalIds;
    const previousPendingSuggestionProposalId =
      mocks.state.pendingSuggestionProposalId;

    mocks.state.pendingAction = null;
    mocks.state.savedSuggestionProposalIds = ["proposal-priority-reset-1"];
    mocks.state.pendingSuggestionProposalId = "proposal-tomorrow-reset-1";
    mocks.state.structuredResponse = {
      intent: {
        intentType: "quest" as const,
        timeHorizon: "short_term" as const,
        isRecurring: false,
        shouldCreateQuest: false,
        shouldPromptCampaign: false,
      },
      weeklyPlan: {
        message: "Launch prep needs a reset move this week.",
        weeklyTheme: "Reset the launch path before adding more work.",
        focusCampaignTitle: "Launch prep",
        focusCampaignStatus: "stalled" as const,
        focusCampaignInterventionLevel: "reset" as const,
        focusCampaignReason:
          "This campaign has slipped repeatedly without a protected recovery move.",
        focusCampaignHealth: {
          overdueQuestCount: 2,
          protectedTodayCount: 0,
          recentCompletedQuestCount: 1,
          daysWithoutMomentum: 8,
          activeCampaignCount: 4,
        },
        topPriorities: [
          {
            suggestionId: "journeys-weekly-reset-1",
            proposalId: "proposal-weekly-reset-1",
            title: "Adjust Launch prep",
            type: "must" as const,
            estimatedDuration: "20 min",
            estimatedDurationMinutes: 20,
            source: "campaign" as const,
            reason: "This campaign has slipped repeatedly and needs a reset plan this week.",
          },
        ],
        busyDays: [],
        openDays: ["Wed"],
      },
      priorityOverview: {
        title: "What Matters",
        message: "The honest next move is to reset the campaign first.",
        campaignPressure:
          "Campaign pressure: Launch prep is stalled. The honest next move is to adjust the campaign plan before adding more work.",
        topPriorities: [
          {
            suggestionId: "journeys-priority-reset-1",
            proposalId: "proposal-priority-reset-1",
            title: "Adjust Launch prep",
            type: "must" as const,
            estimatedDuration: "20 min",
            estimatedDurationMinutes: 20,
            source: "campaign" as const,
            reason: "This campaign has slipped repeatedly and needs a reset plan right now.",
          },
        ],
      },
      reflectionBridge: {
        message: "Tomorrow should start with a reset move before you add more pressure.",
        carryForward: null,
        tomorrowSummary: "light" as const,
        firstAction: {
          suggestionId: "journeys-tomorrow-reset-1",
          proposalId: "proposal-tomorrow-reset-1",
          title: "Adjust Launch prep",
          type: "must" as const,
          estimatedDuration: "20 min",
          estimatedDurationMinutes: 20,
          source: "campaign" as const,
          reason: "This campaign has slipped repeatedly without a protected recovery move. The honest first move tomorrow is resetting Launch prep before you pile on more work.",
        },
        tomorrowSchedule: [],
      },
    };

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    const weeklySaveButton = screen.getByTestId(
      "structured-suggestion-confirm-journeys-weekly-reset-1",
    );
    const prioritySavedButton = screen.getByTestId(
      "structured-suggestion-confirm-journeys-priority-reset-1",
    );
    const reflectionPendingButton = screen.getByTestId(
      "structured-suggestion-confirm-journeys-tomorrow-reset-1",
    );

    expect(weeklySaveButton).toHaveTextContent("Save");
    expect(prioritySavedButton).toHaveTextContent("Saved");
    expect(reflectionPendingButton).toHaveTextContent("Saving");
    expect(prioritySavedButton).toBeDisabled();
    expect(reflectionPendingButton).toBeDisabled();

    fireEvent.click(weeklySaveButton);

    expect(mocks.assistant.confirmSuggestedQuest).toHaveBeenCalledWith(
      "proposal-weekly-reset-1",
    );

    mocks.state.structuredResponse = previousStructuredResponse;
    mocks.state.pendingAction = previousPendingAction;
    mocks.state.savedSuggestionProposalIds = previousSavedSuggestionProposalIds;
    mocks.state.pendingSuggestionProposalId =
      previousPendingSuggestionProposalId;
  });
});
