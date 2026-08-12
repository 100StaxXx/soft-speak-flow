import type { HTMLAttributes, ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type { CompanionAgentFollowUp } from "@/types/companionAgent";
import type { CompanionAssistantMessage } from "@/hooks/useCompanionAssistant";

const mocks = vi.hoisted(() => ({
  visual: {
    companionLabel: "Nova",
    imageUrl: "/placeholder-companion.svg" as string | null,
    focalX: null as number | null,
    focalY: null as number | null,
    element: "fire" as string | null,
    usesPortraitShell: false,
    favoriteColor: "#9b6bff" as string | null,
  },
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
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
  toastError: vi.fn(),
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
      intent: "plan_week" as const,
      actionType: "campaign_update" as const,
      proposalId: null,
      summary: "Adjust Launch prep.",
      confirmationMessage:
        "Want me to adjust Launch prep?",
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
  },
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => mocks.visual,
}));

vi.mock("@/hooks/useCompanionAssistant", () => ({
  useCompanionAssistant: (options: Record<string, unknown>) => {
    mocks.assistantOptions.push(options);
    return {
      todayLabel: "Saturday, April 18",
      placeholder: "chat",
      messages: mocks.state.messages,
      structuredResponse: mocks.state.structuredResponse,
      activeFollowUp: mocks.state.activeFollowUp,
      understandingState: mocks.state.understandingState,
      pendingAction: mocks.state.pendingAction,
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
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DialogHeader: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
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
    <div className={className} {...props}>
      {children}
    </div>
  ),
  DrawerHeader: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
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

vi.mock("@/components/ui/sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
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
  intent: "plan_week" as const,
  actionType: "campaign_update" as const,
  proposalId: null,
  summary: "Adjust Launch prep.",
  confirmationMessage: "Want me to adjust Launch prep?",
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

const createComingUpStructuredResponse = (): CompanionStructuredResponse => ({
  intent: {
    intentType: "conversation",
    timeHorizon: "today",
    isRecurring: false,
    shouldCreateQuest: false,
    shouldPromptCampaign: false,
  },
  comingUp: {
    message: "You have one useful move before your next event.",
    nextEvent: {
      id: "event-1",
      title: "Client call",
      label: "2:00 PM",
      startsAt: "2026-04-25T21:00:00.000Z",
      endsAt: "2026-04-25T21:30:00.000Z",
      isAllDay: false,
      source: "calendar",
    },
    nextBestAction: {
      suggestionId: "coming-up-1",
      proposalId: "proposal-coming-up-1",
      title: "Adjust Course launch",
      type: "must",
      estimatedDuration: "30 min",
      estimatedDurationMinutes: 30,
      source: "campaign",
      reason: "This fits before the call and reduces the most pressure.",
    },
    remainingToday: [],
    tomorrowSummary: "light",
    missedItems: [],
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
    mocks.visual = {
      companionLabel: "Nova",
      imageUrl: "/placeholder-companion.svg",
      focalX: null,
      focalY: null,
      element: "fire",
      usesPortraitShell: false,
      favoriteColor: "#9b6bff",
    };

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
    expect(
      screen.getByText("Outline the launch checklist"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /saved|save|draft/i }))
      .toBeNull();
    expect(
      screen.getByText("Adjust Launch prep."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm All (3)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByTestId("journeys-companion-planner-text-input"),
    ).toHaveAttribute("data-tour", "companion-plan-day-chat-input");
    expect(
      screen.getByTestId("journeys-companion-planner-send-button"),
    ).toHaveAttribute("data-tour", "companion-plan-day-chat-send");
  });

  it("previews the exact day blocks before confirmation", () => {
    mocks.state.pendingAction = {
      ...createBasePendingAction(),
      intent: "plan_day",
      actionType: "day_plan_apply",
      summary: "Plan 2026-04-18 with 2 focused blocks.",
      normalizedPayload: {
        plan_date: "2026-04-18",
        send_to_calendar: true,
        calendar_provider: "google",
        blocks: [
          { title: "Launch notes", start_time: "09:30", duration_minutes: 45 },
          { title: "Walk", start_time: "14:00", duration_minutes: 20 },
        ],
      },
    } as any;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("09:30")).toBeInTheDocument();
    expect(screen.getByText("Launch notes")).toBeInTheDocument();
    expect(screen.getByText("45m")).toBeInTheDocument();
    expect(screen.getByText("Also send to google")).toBeInTheDocument();
  });

  it("fills generated scene avatars in the circular header frame", () => {
    mocks.visual.imageUrl = "https://assets.example.com/generated-companion-scene.png";
    mocks.visual.focalX = 0.42;
    mocks.visual.focalY = 0.58;
    mocks.visual.usesPortraitShell = false;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByRole("img", { name: "Nova" })).toHaveAttribute(
      "data-companion-image-fit",
      "cover",
    );
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
    expect(screen.queryByRole("button", { name: /saved|save|draft/i }))
      .toBeNull();

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
    expect(screen.queryByRole("button", { name: /saved|save|draft/i }))
      .toBeNull();

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
    expect(screen.getByTestId("structured-plan-day")).toHaveTextContent(
      "Outline the launch checklist",
    );

    mocks.state.messages = previousMessages;
    mocks.state.pendingAction = previousPendingAction;
    mocks.state.structuredResponse = previousStructuredResponse;
  });

  it("passes the selected Journeys date into the assistant hook", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        selectedDate={new Date("2026-02-13T00:00:00")}
      />,
    );

    expect(
      await screen.findByText(
        "I can help you shape that into something concrete when you're ready.",
      ),
    ).toBeInTheDocument();
    expect(mocks.assistantOptions.at(-1)?.defaultSelectedDate).toBe(
      "2026-02-13",
    );
  });

  it("renders planner briefing context for plan-day launch intents", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        launchIntent={{
          id: "plan-launch-1",
          message: "Plan my day",
          starterIntent: "plan_day",
          target: "planner",
          selectedDate: "2026-04-18",
          briefingContext: {
            content:
              "Saturday, April 18 looks steady: 3 open quests, 1 timed and 2 anytime, with about 2h planned.",
            focus: "Keep this day realistic.",
            actionPrompt: "Preserve timed quests and avoid overload.",
            dataSnapshot: {
              openQuestCount: 3,
              scheduledQuestCount: 1,
              anytimeQuestCount: 2,
              ritualQuestCount: 1,
              activeCampaignCount: 1,
              estimatedLoadLabel: "2h",
              loadSignal: "steady",
              plannerInsightStatement:
                "The day is workable. Choose the next important quest, then keep the rest in a simple order.",
            },
          },
        }}
      />,
    );

    const briefing = await screen.findByTestId(
      "journeys-companion-planner-briefing",
    );

    expect(briefing).toHaveTextContent("Saturday, April 18 looks steady");
    expect(within(briefing).getByText("Planning with")).toBeInTheDocument();
    expect(within(briefing).getByText("Open")).toBeInTheDocument();
    expect(within(briefing).getByText("3")).toBeInTheDocument();
    expect(briefing).toHaveTextContent(
      '"The day is workable. Choose the next important quest, then keep the rest in a simple order."',
    );
    expect(briefing).toHaveTextContent("- Nova");
    expect(briefing).not.toHaveTextContent("Preserve timed quests");
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

    expect(
      screen.getByText("I added more detail while you were reading above."),
    ).toBeInTheDocument();
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

  it("keeps the transcript in place when a coming-up card arrives", () => {
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

    const structuredResponse = createComingUpStructuredResponse();
    mocks.state.pendingAction = null;
    mocks.state.structuredResponse = structuredResponse;
    mocks.state.messages = [
      ...mocks.state.messages,
      {
        id: "m2",
        role: "user" as const,
        content: "What do I have coming up?",
        createdAt: "2026-04-18T08:02:00.000Z",
        source: "agent" as const,
      },
      {
        id: "m3",
        role: "assistant" as const,
        content: structuredResponse.comingUp?.message ?? "",
        createdAt: "2026-04-18T08:03:00.000Z",
        source: "agent" as const,
        structuredResponse,
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

    expect(screen.getByTestId("structured-coming-up")).toBeInTheDocument();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(viewport.scrollTop).toBe(600);
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

    fireEvent.focus(
      screen.getByTestId("journeys-companion-planner-text-input"),
    );

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
      expect(
        screen.getByTestId("journeys-companion-thread-picker"),
      ).toBeInTheDocument();
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

  it("keeps mobile planner typing out of Vaul drawer gestures", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    expect(
      mocks.drawerRootProps.find((props) => props.open === true),
    ).toMatchObject({ repositionInputs: false, handleOnly: true });
    expect(
      screen
        .getByTestId("journeys-companion-planner-text-input")
        .closest("[data-vaul-no-drag]"),
    ).not.toBeNull();
  });

  it("allows normal mobile drawer close requests away from the composer", () => {
    const onOpenChange = vi.fn();
    mocks.state.draftInput = "";

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={onOpenChange}
        presentation="drawer"
      />,
    );

    const drawerProps = mocks.drawerRootProps.find(
      (props) => props.open === true,
    );
    (drawerProps?.onOpenChange as (open: boolean) => void)(false);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the mobile planner drawer flush when no keyboard inset is present", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    expect(
      screen.getByTestId("journeys-companion-planner-drawer-content"),
    ).toHaveStyle({ bottom: "0px" });
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

      expect(
        screen.getByTestId("journeys-companion-planner-shell"),
      ).toHaveStyle({ height: `${expectedShellHeight}px` });
      expect(
        screen.getByTestId("journeys-companion-planner-drawer-content"),
      ).toHaveClass("max-h-none");
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

    expect(screen.getByTestId("journeys-companion-planner-footer")).toHaveClass(
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

    expect(screen.getByTestId("journeys-companion-planner-shell")).toHaveStyle({
      height: "454px",
    });
    expect(
      screen.getByTestId("journeys-companion-planner-drawer-content"),
    ).toHaveStyle({ bottom: "352px" });
    expect(
      mocks.drawerRootProps.find((props) => props.open === true),
    ).toMatchObject({ repositionInputs: false });
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
      expect(
        screen.getByTestId("journeys-companion-planner-shell"),
      ).toHaveStyle({ height: "454px" });
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

    expect(
      screen.getByRole("button", { name: "Confirm All (3)" }),
    ).toHaveAttribute("data-tour", "companion-plan-day-pending-confirm-all");
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveAttribute(
      "data-tour",
      "companion-plan-day-pending-confirm",
    );
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
    };

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(
      screen.getByTestId("journeys-companion-follow-up"),
    ).toHaveTextContent("Do you want today to lean progress or recovery?");
    expect(
      screen.getByText("Your calendar has room for either shape."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Progress" })).toHaveAttribute(
      "data-tour",
      "companion-plan-day-follow-up-option",
    );

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

  it("renders structured guidance without save buttons", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.queryByRole("button", { name: /save|draft/i })).toBeNull();
  });
});
