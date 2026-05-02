import type { HTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type { CompanionAgentFollowUp } from "@/types/companionAgent";
import type { CompanionAssistantMessage } from "@/hooks/useCompanionAssistant";

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
    submitMessage: vi.fn().mockResolvedValue(true),
    startNewChat: vi.fn().mockResolvedValue(undefined),
    startTemplateThread: vi.fn().mockReturnValue("fresh-template-session"),
    archiveCurrentThread: vi.fn().mockResolvedValue(undefined),
    resumeThread: vi.fn().mockResolvedValue(undefined),
  },
  drawerRootProps: [] as Array<Record<string, unknown>>,
  assistantOptions: [] as Array<Record<string, unknown>>,
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
    ] as CompanionAssistantMessage[],
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
    } as CompanionStructuredResponse | null,
    activeFollowUp: null as CompanionAgentFollowUp | null,
    understandingState: null as null | string,
    proposedActions: [] as Array<{ type: string }>,
    savedSuggestionProposalIds: ["proposal-plan-1"],
    pendingSuggestionProposalId: null as string | null,
  },
}));

const PERSONALIZED_QUEST_CAPTURE_OPENING =
  "Nova's ready. What quest are we capturing?";

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
  useCompanionAssistant: (options: Record<string, unknown>) => {
    mocks.assistantOptions.push(options);
    return {
      todayLabel: "Saturday, April 18",
      placeholder: "Talk to Cosmiq",
      messages: mocks.state.messages,
      structuredResponse: mocks.state.structuredResponse,
      activeFollowUp: mocks.state.activeFollowUp,
      understandingState: mocks.state.understandingState,
      proposedActions: mocks.state.proposedActions,
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
      submitMessage: mocks.assistant.submitMessage,
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
      startTemplateThread: mocks.assistant.startTemplateThread,
      archiveCurrentThread: mocks.assistant.archiveCurrentThread,
      resumeThread: mocks.assistant.resumeThread,
    };
  },
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

const createBaseAssistantMessage = () => ({
  id: "m1",
  role: "assistant" as const,
  content:
    "I can help you shape that into something concrete when you're ready.",
  createdAt: "2026-04-18T08:01:00.000Z",
  source: "agent" as const,
});

const createBasePendingAction = () => ({
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
});

const createBaseActiveThread = () => ({
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
});

const createBaseStructuredResponse = (): CompanionStructuredResponse => ({
  intent: {
    intentType: "conversation",
    timeHorizon: "today",
    isRecurring: false,
    shouldCreateQuest: false,
    shouldPromptCampaign: false,
  },
  planDay: {
    message: "Today is best as a balanced push with one clear focus block.",
    dayAssessment: "balanced",
    suggestedQuests: [
      {
        suggestionId: "plan-1",
        proposalId: "proposal-plan-1",
        title: "Outline the launch checklist",
        type: "must",
        estimatedDuration: "45 min",
        estimatedDurationMinutes: 45,
        source: "campaign",
        reason:
          "It keeps the launch campaign moving without crowding the afternoon.",
      },
    ],
  },
});

const getTranscriptViewport = () => {
  const transcript = screen.getByTestId(
    "journeys-companion-planner-transcript",
  );
  const viewport = transcript.closest<HTMLElement>(
    "[data-radix-scroll-area-viewport]",
  );
  if (!viewport) {
    throw new Error("Expected the planner transcript to render in a viewport.");
  }
  return viewport;
};

const setTranscriptViewportMetrics = (
  viewport: HTMLElement,
  metrics: {
    scrollHeight: number;
    clientHeight: number;
    scrollTop: number;
  },
) => {
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  });
  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  });
  Object.defineProperty(viewport, "scrollTop", {
    configurable: true,
    writable: true,
    value: metrics.scrollTop,
  });
};

const installTranscriptScrollTo = (viewport: HTMLElement) => {
  const scrollTo = vi.fn((options?: ScrollToOptions | number, y?: number) => {
    if (typeof options === "number") {
      viewport.scrollLeft = options;
      viewport.scrollTop = typeof y === "number" ? y : viewport.scrollTop;
      return;
    }

    if (typeof options?.top === "number") {
      viewport.scrollTop = options.top;
    }
    if (typeof options?.left === "number") {
      viewport.scrollLeft = options.left;
    }
  });

  Object.defineProperty(viewport, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });

  return scrollTo;
};

describe("JourneysCompanionPlannerModal", () => {
  const originalMatchMedia = window.matchMedia;
  const originalVisualViewport = window.visualViewport;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assistant.submitMessage.mockResolvedValue(true);
    mocks.drawerRootProps.length = 0;
    mocks.assistantOptions.length = 0;
    mocks.state.messages = [createBaseAssistantMessage()];
    mocks.state.pendingAction = createBasePendingAction();
    mocks.state.activeThread = createBaseActiveThread();
    mocks.state.structuredResponse = createBaseStructuredResponse();
    mocks.state.draftInput = "Plan tomorrow for me";
    mocks.state.activeFollowUp = null;
    mocks.state.understandingState = null;
    mocks.state.proposedActions = [];
    mocks.state.savedSuggestionProposalIds = ["proposal-plan-1"];
    mocks.state.pendingSuggestionProposalId = null;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 700,
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
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: originalInnerHeight,
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
    expect(screen.getByTestId("journeys-companion-planner-text-input"))
      .toHaveAttribute("data-tour", "companion-plan-day-chat-input");
    expect(screen.getByTestId("journeys-companion-planner-send-button"))
      .toHaveAttribute("data-tour", "companion-plan-day-chat-send");
  });

  it("keeps text entry local until the user sends", () => {
    mocks.state.pendingAction = null;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.change(
      screen.getByTestId("journeys-companion-planner-text-input"),
      {
        target: { value: "Ok start creating tasks" },
      },
    );

    expect(mocks.assistant.setDraftInput).toHaveBeenCalledWith(
      "Ok start creating tasks",
    );
    expect(mocks.assistant.submitTypedMessage).not.toHaveBeenCalled();
    expect(mocks.assistant.submitMessage).not.toHaveBeenCalled();
  });

  it("shows rich planner cards as the single assistant response", () => {
    const previousMessages = mocks.state.messages;
    const previousPendingAction = mocks.state.pendingAction;
    const previousStructuredResponse = mocks.state.structuredResponse;
    const structuredResponse = createBaseStructuredResponse();
    const assistantReply = structuredResponse.planDay?.message ?? "";

    mocks.state.pendingAction = null;
    mocks.state.structuredResponse = structuredResponse;
    mocks.state.messages = [
      {
        id: "m-rich-card",
        role: "assistant",
        content: assistantReply,
        createdAt: "2026-04-18T08:03:00.000Z",
        source: "agent",
        structuredResponse,
      },
    ];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    const planDayCard = screen.getByTestId("structured-plan-day");
    const renderedCopies = screen.getAllByText(assistantReply);
    expect(renderedCopies).toHaveLength(1);
    expect(planDayCard).toContainElement(renderedCopies[0]!);
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();

    mocks.state.messages = previousMessages;
    mocks.state.pendingAction = previousPendingAction;
    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("hides the rich card origin bubble even when its text is unique", () => {
    const previousMessages = mocks.state.messages;
    const previousPendingAction = mocks.state.pendingAction;
    const previousStructuredResponse = mocks.state.structuredResponse;
    const structuredResponse = createBaseStructuredResponse();
    const uniqueAssistantReply =
      "I tightened the afternoon block before showing the plan.";
    const cardMessage = structuredResponse.planDay?.message ?? "";

    mocks.state.pendingAction = null;
    mocks.state.structuredResponse = structuredResponse;
    mocks.state.messages = [
      {
        id: "m-rich-card-unique-reply",
        role: "assistant",
        content: uniqueAssistantReply,
        createdAt: "2026-04-18T08:04:00.000Z",
        source: "agent",
        structuredResponse,
      },
    ];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    const planDayCard = screen.getByTestId("structured-plan-day");
    expect(screen.queryByText(uniqueAssistantReply)).toBeNull();
    expect(planDayCard).toContainElement(screen.getByText(cardMessage));
    expect(screen.getByRole("button", { name: "Saved" })).toBeInTheDocument();

    mocks.state.messages = previousMessages;
    mocks.state.pendingAction = previousPendingAction;
    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("keeps action receipt bubbles visible after rich card actions resolve", () => {
    const previousMessages = mocks.state.messages;
    const previousPendingAction = mocks.state.pendingAction;
    const previousStructuredResponse = mocks.state.structuredResponse;
    const structuredResponse = createBaseStructuredResponse();
    const cardOriginReply = "Here is the plan I can save for you.";
    const receiptReply = "Saved Outline the launch checklist.";

    mocks.state.pendingAction = null;
    mocks.state.structuredResponse = structuredResponse;
    mocks.state.messages = [
      {
        id: "m-rich-card-origin",
        role: "assistant",
        content: cardOriginReply,
        createdAt: "2026-04-18T08:05:00.000Z",
        source: "agent",
        structuredResponse,
      },
      {
        id: "m-user-confirm",
        role: "user",
        content: "Confirm",
        createdAt: "2026-04-18T08:06:00.000Z",
        source: "agent",
      },
      {
        id: "m-action-receipt",
        role: "assistant",
        content: receiptReply,
        createdAt: "2026-04-18T08:06:01.000Z",
        source: "agent",
        structuredResponse,
        receipt: {
          actionId: "action-1",
          status: "executed",
          proposalId: "proposal-plan-1",
          message: receiptReply,
          summary: "Saved the planned quest.",
          createdAt: "2026-04-18T08:06:01.000Z",
          executionResult: null,
          executionError: null,
        },
      },
    ];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.queryByText(cardOriginReply)).toBeNull();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText(receiptReply)).toBeInTheDocument();
    expect(screen.getByTestId("structured-plan-day"))
      .toHaveTextContent("Outline the launch checklist");

    mocks.state.messages = previousMessages;
    mocks.state.pendingAction = previousPendingAction;
    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("forwards New Quest launch intents through the assistant hook", async () => {
    const onLaunchIntentConsumed = vi.fn();
    const launchIntent = {
      id: "quest-launch-1",
      message: PERSONALIZED_QUEST_CAPTURE_OPENING,
      starterIntent: "quest_capture" as const,
      target: "planner" as const,
      briefingContext: null,
    };

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        launchIntent={launchIntent}
        onLaunchIntentConsumed={onLaunchIntentConsumed}
      />,
    );

    expect(
      await screen.findByText(
        "I can help you shape that into something concrete when you're ready.",
      ),
    ).toBeInTheDocument();
    expect(mocks.assistantOptions.at(-1)?.launchIntent).toEqual(launchIntent);
    expect(onLaunchIntentConsumed).not.toHaveBeenCalled();
    expect(mocks.assistant.startTemplateThread).not.toHaveBeenCalled();
    expect(mocks.assistant.submitMessage).not.toHaveBeenCalled();
    expect(mocks.assistant.submitTypedMessage).not.toHaveBeenCalled();
  });

  it("submits text after New Quest through normal assistant chat", async () => {
    mocks.state.draftInput = "Pilates tomorrow at 8am";

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        launchIntent={{
          id: "quest-launch-2",
          message: PERSONALIZED_QUEST_CAPTURE_OPENING,
          starterIntent: "quest_capture",
          target: "planner",
          briefingContext: null,
        }}
      />,
    );

    await screen.findByText(
      "I can help you shape that into something concrete when you're ready.",
    );

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(mocks.assistant.submitMessage).not.toHaveBeenCalled();
    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps the transcript in place when messages arrive after the user scrolls up", () => {
    const { rerender } = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        onOpenCampaignBuilder={vi.fn()}
        presentation="dialog"
      />,
    );
    const viewport = getTranscriptViewport();
    const scrollTo = installTranscriptScrollTo(viewport);

    setTranscriptViewportMetrics(viewport, {
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 120,
    });
    fireEvent.scroll(viewport);
    scrollTo.mockClear();

    mocks.state.messages = [
      ...mocks.state.messages,
      {
        id: "m2",
        role: "assistant" as const,
        content: "I added more detail while you were reading above.",
        createdAt: "2026-04-18T08:03:00.000Z",
        source: "agent" as const,
      },
    ];
    setTranscriptViewportMetrics(viewport, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 120,
    });

    rerender(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        onOpenCampaignBuilder={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("I added more detail while you were reading above."))
      .toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(viewport.scrollTop).toBe(120);
  });

  it("follows new messages when the transcript is already pinned to the bottom", () => {
    const { rerender } = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        onOpenCampaignBuilder={vi.fn()}
        presentation="dialog"
      />,
    );
    const viewport = getTranscriptViewport();
    const scrollTo = installTranscriptScrollTo(viewport);

    setTranscriptViewportMetrics(viewport, {
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 600,
    });
    fireEvent.scroll(viewport);
    scrollTo.mockClear();

    mocks.state.messages = [
      ...mocks.state.messages,
      {
        id: "m2",
        role: "assistant" as const,
        content: "Here is the next thing at the bottom.",
        createdAt: "2026-04-18T08:03:00.000Z",
        source: "agent" as const,
      },
    ];
    setTranscriptViewportMetrics(viewport, {
      scrollHeight: 1200,
      clientHeight: 300,
      scrollTop: 600,
    });

    rerender(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        onOpenCampaignBuilder={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(scrollTo).toHaveBeenCalledWith({
      top: 900,
      behavior: "smooth",
    });
    expect(viewport.scrollTop).toBe(900);
  });

  it("does not scroll the transcript when the composer receives focus", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );
    const viewport = getTranscriptViewport();
    const scrollTo = installTranscriptScrollTo(viewport);

    setTranscriptViewportMetrics(viewport, {
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 120,
    });
    fireEvent.scroll(viewport);
    scrollTo.mockClear();

    fireEvent.focus(screen.getByTestId("journeys-companion-planner-text-input"));

    expect(scrollTo).not.toHaveBeenCalled();
    expect(viewport.scrollTop).toBe(120);
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

  it("disables Vaul input repositioning for the mobile planner drawer", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    expect(mocks.drawerRootProps.find((props) => props.open === true))
      .toMatchObject({ repositionInputs: false });
  });

  it("keeps the mobile planner drawer flush when no keyboard inset is present", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-drawer-content"))
      .toHaveStyle({ bottom: "0px" });
  });

  it.each([
    ["390x844", 844, 736],
    ["393x852", 852, 736],
    ["430x932", 932, 736],
    ["375x667", 667, 621],
  ])(
    "keeps the self-sized mobile planner drawer within a %s viewport",
    (_label, viewportHeight, expectedShellHeight) => {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: viewportHeight,
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: {
          height: viewportHeight,
          offsetTop: 0,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      });

      render(
        <JourneysCompanionPlannerModal
          open
          onOpenChange={vi.fn()}
          presentation="drawer"
        />,
      );

      expect(screen.getByTestId("journeys-companion-planner-shell"))
        .toHaveStyle({ height: `${expectedShellHeight}px` });
      expect(screen.getByTestId("journeys-companion-planner-drawer-content"))
        .toHaveClass("max-h-none");
    },
  );

  it("adds bottom safe-area padding to the mobile planner composer", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-footer"))
      .toHaveClass(
        "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
        "sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
      );
  });

  it("sizes the mobile planner shell to the visible viewport when the keyboard opens", () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 852,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 500,
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-shell"))
      .toHaveStyle({ height: "454px" });
    expect(screen.getByTestId("journeys-companion-planner-drawer-content"))
      .toHaveStyle({ bottom: "352px" });
    expect(mocks.drawerRootProps.find((props) => props.open === true))
      .toMatchObject({ repositionInputs: false });
  });

  it("keeps the pinned transcript anchored when the drawer layout changes", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );
    const viewport = getTranscriptViewport();
    const scrollTo = installTranscriptScrollTo(viewport);

    setTranscriptViewportMetrics(viewport, {
      scrollHeight: 900,
      clientHeight: 300,
      scrollTop: 600,
    });
    fireEvent.scroll(viewport);
    scrollTo.mockClear();

    await act(async () => {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        writable: true,
        value: 852,
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: {
          height: 500,
          offsetTop: 0,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      });
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("journeys-companion-planner-shell"))
        .toHaveStyle({ height: "454px" });
    });
    expect(scrollTo).toHaveBeenCalledWith({
      top: 600,
      behavior: "smooth",
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

    expect(screen.getByRole("button", { name: "Confirm All (3)" }))
      .toHaveAttribute("data-tour", "companion-plan-day-pending-confirm-all");
    expect(screen.getByRole("button", { name: "Confirm" }))
      .toHaveAttribute("data-tour", "companion-plan-day-pending-confirm");
    expect(mocks.assistant.confirmAllPendingActions).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.confirmPendingAction).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.cancelPendingAction).toHaveBeenCalledTimes(1);
  });

  it("renders model follow-up options as direct replies", async () => {
    const previousPendingAction = mocks.state.pendingAction;
    mocks.state.pendingAction = null;
    mocks.state.activeFollowUp = {
      question: "Do you want today to lean progress or recovery?",
      reason: "Your calendar has room for either shape.",
      expectedAnswerType: "choice",
      options: ["Progress", "Recovery"],
      blocksDrafting: true,
    };

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-follow-up"))
      .toHaveTextContent("Do you want today to lean progress or recovery?");
    expect(screen.getByText("Your calendar has room for either shape."))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Progress" }))
      .toHaveAttribute("data-tour", "companion-plan-day-follow-up-option");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    });

    expect(mocks.assistant.submitMessage).toHaveBeenCalledWith(
      "Progress",
      "text",
      {
        turnOrigin: "follow_up_option",
      },
    );

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.activeFollowUp = null;
  });

  it("opens a quest draft instead of submitting when Plan My Day quest consent is accepted", async () => {
    const previousPendingAction = mocks.state.pendingAction;
    const previousMessages = mocks.state.messages;
    const onQuestProposalEditHandoff = vi.fn().mockResolvedValue({
      saved: false,
    });
    mocks.state.pendingAction = null;
    mocks.state.messages = [
      createBaseAssistantMessage(),
      {
        id: "u1",
        role: "user" as const,
        content: "Review project at 3pm for 45 minutes",
        createdAt: "2026-04-18T08:02:00.000Z",
        source: "agent" as const,
      },
      {
        id: "m2",
        role: "assistant" as const,
        content: "Would you like to form a quest?",
        createdAt: "2026-04-18T08:03:00.000Z",
        source: "agent" as const,
      },
    ];
    mocks.state.activeFollowUp = {
      question: "Would you like to form a quest?",
      reason:
        "Plan my day stays conversational unless you explicitly want this to become a quest.",
      expectedAnswerType: "confirmation",
      options: ["Yes", "No"],
      blocksDrafting: true,
      metadata: {
        questionId: "plan_day_quest_consent",
        planningLauncherConsent: true,
        consentKind: "quest",
        sourceStarterIntent: "plan_day",
      },
    };

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        onQuestProposalEditHandoff={onQuestProposalEditHandoff}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    });

    expect(mocks.assistant.submitMessage).not.toHaveBeenCalled();
    expect(onQuestProposalEditHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "create_quest",
        status: "pending",
        readyToConfirm: true,
        payload: expect.objectContaining({
          taskText: "Review Project",
          scheduledTime: "15:00",
          estimatedDuration: 45,
        }),
      }),
    );
    expect(screen.queryByTestId("journeys-companion-follow-up")).toBeNull();

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.messages = previousMessages;
    mocks.state.activeFollowUp = null;
  });

  it("keeps negative Plan My Day quest consent in the normal chat flow", async () => {
    const previousPendingAction = mocks.state.pendingAction;
    const onQuestProposalEditHandoff = vi.fn().mockResolvedValue({
      saved: false,
    });
    mocks.state.pendingAction = null;
    mocks.state.activeFollowUp = {
      question: "Would you like to form a quest?",
      expectedAnswerType: "confirmation",
      options: ["Yes", "No"],
      blocksDrafting: true,
      metadata: {
        questionId: "plan_day_quest_consent",
        planningLauncherConsent: true,
        consentKind: "quest",
        sourceStarterIntent: "plan_day",
      },
    };

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        onQuestProposalEditHandoff={onQuestProposalEditHandoff}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "No" }));
    });

    expect(onQuestProposalEditHandoff).not.toHaveBeenCalled();
    expect(mocks.assistant.submitMessage).toHaveBeenCalledWith(
      "No",
      "text",
      {
        turnOrigin: "follow_up_option",
      },
    );

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.activeFollowUp = null;
  });

  it("renders model proposed actions and sends the selected draft context", async () => {
    const previousPendingAction = mocks.state.pendingAction;
    const previousStructuredResponse = mocks.state.structuredResponse;
    const previousProposedActions = mocks.state.proposedActions;
    const proposedAction = {
      type: "quest.create",
      title: "Draft launch email",
      summary: "Protect one launch block before the afternoon fills.",
      reason: "It fits the cleanest open window.",
      normalizedPayload: {
        title: "Draft launch email",
        date: "2026-04-18",
        startTime: "10:00",
      },
    };
    mocks.state.pendingAction = null;
    mocks.state.structuredResponse = null;
    mocks.state.proposedActions = [proposedAction];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-proposed-actions"))
      .toHaveTextContent("Draft launch email");
    expect(screen.getByText("It fits the cleanest open window."))
      .toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Draft/i }));
    });

    expect(mocks.assistant.submitMessage).toHaveBeenCalledWith(
      "Draft this: Draft launch email",
      "text",
      {
        turnOrigin: "proposed_action",
        selectedProposedAction: proposedAction,
        selectedProposedActionIntent: "draft",
      },
    );

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.structuredResponse = previousStructuredResponse;
    mocks.state.proposedActions = previousProposedActions;
  });

  it("prevents duplicate proposed action submits while a selection is in flight", async () => {
    const previousPendingAction = mocks.state.pendingAction;
    const previousStructuredResponse = mocks.state.structuredResponse;
    const previousProposedActions = mocks.state.proposedActions;
    const firstProposedAction = {
      type: "quest.create",
      title: "Draft launch email",
      summary: "Protect one launch block before the afternoon fills.",
    };
    const secondProposedAction = {
      type: "quest.create",
      title: "Outline sales page",
      summary: "Use the next clean focus block.",
    };
    mocks.assistant.submitMessage.mockReturnValueOnce(
      new Promise<boolean>(() => undefined),
    );
    mocks.state.pendingAction = null;
    mocks.state.structuredResponse = null;
    mocks.state.proposedActions = [firstProposedAction, secondProposedAction];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    const draftButtons = screen.getAllByRole("button", { name: /Draft/i });
    expect(draftButtons).toHaveLength(2);
    fireEvent.click(draftButtons[0]!);
    fireEvent.click(draftButtons[1]!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Drafting/i }))
        .toBeDisabled();
    });
    expect(mocks.assistant.submitMessage).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.submitMessage).toHaveBeenCalledWith(
      "Draft this: Draft launch email",
      "text",
      {
        turnOrigin: "proposed_action",
        selectedProposedAction: firstProposedAction,
        selectedProposedActionIntent: "draft",
      },
    );

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.structuredResponse = previousStructuredResponse;
    mocks.state.proposedActions = previousProposedActions;
  });

  it("keeps unsupported proposed actions conversational instead of draftable", async () => {
    const previousPendingAction = mocks.state.pendingAction;
    const previousStructuredResponse = mocks.state.structuredResponse;
    const previousProposedActions = mocks.state.proposedActions;
    const proposedAction = {
      type: "calendar.event.update",
      title: "Move dentist appointment",
      summary: "External calendar events are read-only here.",
      reason: "Cosmiq can talk through options, but cannot edit that event.",
    };
    mocks.state.pendingAction = null;
    mocks.state.structuredResponse = null;
    mocks.state.proposedActions = [proposedAction];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-proposed-actions"))
      .toHaveTextContent("Move dentist appointment");
    expect(screen.queryByRole("button", { name: /Draft/i })).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Discuss/i }));
    });

    expect(mocks.assistant.submitMessage).toHaveBeenCalledWith(
      "Tell me more about: Move dentist appointment",
      "text",
      {
        turnOrigin: "proposed_action",
        selectedProposedAction: proposedAction,
        selectedProposedActionIntent: "discuss",
      },
    );

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.structuredResponse = previousStructuredResponse;
    mocks.state.proposedActions = previousProposedActions;
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

    expect(screen.getByTestId("structured-suggestion-confirm-plan-1"))
      .toHaveAttribute("data-tour", "companion-plan-day-suggestion-save");
    expect(mocks.assistant.confirmSuggestedQuest).toHaveBeenCalledWith(
      "proposal-plan-1",
    );

    mocks.state.pendingAction = previousPendingAction;
    mocks.state.savedSuggestionProposalIds = previousSavedSuggestionProposalIds;
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
            reason:
              "This campaign has slipped repeatedly and needs a reset plan this week.",
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
            reason:
              "This campaign has slipped repeatedly and needs a reset plan right now.",
          },
        ],
      },
      reflectionBridge: {
        message:
          "Tomorrow should start with a reset move before you add more pressure.",
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
          reason:
            "This campaign has slipped repeatedly without a protected recovery move. The honest first move tomorrow is resetting Launch prep before you pile on more work.",
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
