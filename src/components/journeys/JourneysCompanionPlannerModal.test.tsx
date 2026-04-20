import type { HTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    submitMessage: vi.fn().mockResolvedValue(undefined),
    submitPlannerMessage: vi.fn().mockResolvedValue(undefined),
    confirmProposal: vi.fn(),
    completeProposalEdit: vi.fn().mockResolvedValue(undefined),
    rejectProposal: vi.fn(),
    confirmAll: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    stopSpeaking: vi.fn(),
    startNewChat: vi.fn().mockResolvedValue(undefined),
    archiveCurrentThread: vi.fn().mockResolvedValue(undefined),
    resumeThread: vi.fn().mockResolvedValue(undefined),
  },
  openCampaignBuilder: vi.fn(),
  drawerRootProps: [] as Array<Record<string, unknown>>,
  state: {
    greeting: "The road's open. What are we setting in motion?",
    messages: [
      {
        id: "plan-1",
        role: "assistant" as const,
        content: "I can help you shape that into something concrete when you're ready.",
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "plan" as const,
      },
    ],
    questions: [
      {
        id: "time_of_day",
        prompt: "What time of day should this live in your schedule?",
        required: true,
        field: "time_of_day" as const,
        options: ["Morning", "Afternoon", "Evening"],
      },
    ],
    proposals: [
      {
        id: "proposal-1",
        kind: "create_quest" as const,
        title: "Create Focus quest",
        summary: "Reserve a focused block tomorrow afternoon.",
        payload: {
          taskText: "Focus quest",
          notes: "Protect this block for the one thing that matters most.",
          subtasks: ["Choose the target", "Silence notifications"],
        },
        status: "pending" as const,
        readyToConfirm: true,
      },
      {
        id: "proposal-2",
        kind: "create_quest" as const,
        title: "Create Backup quest",
        summary: "Keep a second backup focus block.",
        payload: {},
        status: "pending" as const,
        readyToConfirm: true,
      },
    ],
    pendingProposals: [
      {
        id: "proposal-1",
        kind: "create_quest" as const,
        title: "Create Focus quest",
        summary: "Reserve a focused block tomorrow afternoon.",
        payload: {
          taskText: "Focus quest",
          notes: "Protect this block for the one thing that matters most.",
          subtasks: ["Choose the target", "Silence notifications"],
        },
        status: "pending" as const,
        readyToConfirm: true,
      },
      {
        id: "proposal-2",
        kind: "create_quest" as const,
        title: "Create Backup quest",
        summary: "Keep a second backup focus block.",
        payload: {},
        status: "pending" as const,
        readyToConfirm: true,
      },
    ],
    readyProposalCount: 2,
    draftInput: "Plan tomorrow for me",
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
    canOpenThreadPicker: true,
    threadPickerDisabledReason: null as string | null,
    threadHistoryEmptyStateMessage: "Past chats will show up here after at least one real exchange.",
    hasPersistedActiveThread: true,
    canStartNewChat: true,
    newChatDisabledReason: null as string | null,
    canArchiveThread: true,
    archiveDisabledReason: null as string | null,
    isLoadingThreads: false,
    isSpeaking: false,
    speechProvider: "none" as "none" | "device" | "cloud",
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
  useCompanionAssistant: (options?: { onOpenCampaignBuilder?: (message: string) => void }) => ({
    greeting: mocks.state.greeting,
    messages: mocks.state.messages,
    questions: mocks.state.questions,
    proposals: mocks.state.proposals,
    pendingProposals: mocks.state.pendingProposals,
    readyProposalCount: mocks.state.readyProposalCount,
    plannerMemory: null,
    scheduleInsights: {
      horizon: "day" as const,
      selectedDate: "2026-04-18",
      dayLoads: [],
      overloadedDates: [],
      emptyDates: [],
      conflicts: [],
      suggestedSlots: [],
      moveSuggestions: [],
      summary: "Today has room at 09:00.",
    },
    todayLabel: "Saturday, April 18",
    isLoadingContext: false,
    horizon: "day" as const,
    setHorizon: vi.fn(),
    draftInput: mocks.state.draftInput,
    setDraftInput: mocks.assistant.setDraftInput,
    interimText: "",
    placeholder: "Chat",
    isSubmitting: false,
    isClassifying: false,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "prompt" as const,
    showPermissionDialog: false,
    setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
    isRequestingPermission: false,
    submitTypedMessage: mocks.assistant.submitTypedMessage,
    submitMessage: async (message: string, inputMode: "text" | "voice") => {
      await mocks.assistant.submitMessage(message, inputMode);
      if (message === "Help me break a big goal into steps.") {
        options?.onOpenCampaignBuilder?.(message);
      }
    },
    submitPlannerMessage: mocks.assistant.submitPlannerMessage,
    toggleRecording: mocks.assistant.toggleRecording,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
    confirmProposal: mocks.assistant.confirmProposal,
    completeProposalEdit: mocks.assistant.completeProposalEdit,
    rejectProposal: mocks.assistant.rejectProposal,
    confirmAll: mocks.assistant.confirmAll,
    isSpeaking: mocks.state.isSpeaking,
    speechProvider: mocks.state.speechProvider,
    stopSpeaking: mocks.assistant.stopSpeaking,
    activeThread: mocks.state.activeThread,
    historyThreads: mocks.state.historyThreads,
    canOpenThreadPicker: mocks.state.canOpenThreadPicker,
    threadPickerDisabledReason: mocks.state.threadPickerDisabledReason,
    threadHistoryEmptyStateMessage: mocks.state.threadHistoryEmptyStateMessage,
    hasPersistedActiveThread: mocks.state.hasPersistedActiveThread,
    canStartNewChat: mocks.state.canStartNewChat,
    newChatDisabledReason: mocks.state.newChatDisabledReason,
    startNewChat: mocks.assistant.startNewChat,
    canArchiveThread: mocks.state.canArchiveThread,
    archiveDisabledReason: mocks.state.archiveDisabledReason,
    archiveCurrentThread: mocks.assistant.archiveCurrentThread,
    resumeThread: mocks.assistant.resumeThread,
    isLoadingThreads: mocks.state.isLoadingThreads,
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
    vi.useRealTimers();
    mocks.drawerRootProps.length = 0;
    mocks.state.greeting = "The road's open. What are we setting in motion?";
    mocks.state.messages = [
      {
        id: "plan-1",
        role: "assistant",
        content: "I can help you shape that into something concrete when you're ready.",
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "plan",
      },
    ];
    mocks.state.questions = [
      {
        id: "time_of_day",
        prompt: "What time of day should this live in your schedule?",
        required: true,
        field: "time_of_day",
        options: ["Morning", "Afternoon", "Evening"],
      },
    ];
    mocks.state.proposals = [
      {
        id: "proposal-1",
        kind: "create_quest",
        title: "Create Focus quest",
        summary: "Reserve a focused block tomorrow afternoon.",
        payload: {
          taskText: "Focus quest",
          notes: "Protect this block for the one thing that matters most.",
          subtasks: ["Choose the target", "Silence notifications"],
        },
        status: "pending",
        readyToConfirm: true,
      },
      {
        id: "proposal-2",
        kind: "create_quest",
        title: "Create Backup quest",
        summary: "Keep a second backup focus block.",
        payload: {},
        status: "pending",
        readyToConfirm: true,
      },
    ];
    mocks.state.pendingProposals = [
      {
        id: "proposal-1",
        kind: "create_quest",
        title: "Create Focus quest",
        summary: "Reserve a focused block tomorrow afternoon.",
        payload: {
          taskText: "Focus quest",
          notes: "Protect this block for the one thing that matters most.",
          subtasks: ["Choose the target", "Silence notifications"],
        },
        status: "pending",
        readyToConfirm: true,
      },
      {
        id: "proposal-2",
        kind: "create_quest",
        title: "Create Backup quest",
        summary: "Keep a second backup focus block.",
        payload: {},
        status: "pending",
        readyToConfirm: true,
      },
    ];
    mocks.state.readyProposalCount = 2;
    mocks.state.draftInput = "Plan tomorrow for me";
    mocks.state.activeThread = {
      sessionId: "journeys-session-1",
      companionId: "companion-1",
      surface: "journeys",
      title: "Current thread",
      previewText: "I can help you shape that into something concrete when you're ready.",
      createdAt: "2026-04-18T08:00:00.000Z",
      lastMessageAt: "2026-04-18T08:01:00.000Z",
      archivedAt: null,
      messageCount: 2,
    };
    mocks.state.historyThreads = [
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
    ];
    mocks.state.canOpenThreadPicker = true;
    mocks.state.threadPickerDisabledReason = null;
    mocks.state.threadHistoryEmptyStateMessage = "Past chats will show up here after at least one real exchange.";
    mocks.state.hasPersistedActiveThread = true;
    mocks.state.canStartNewChat = true;
    mocks.state.newChatDisabledReason = null;
    mocks.state.canArchiveThread = true;
    mocks.state.archiveDisabledReason = null;
    mocks.state.isLoadingThreads = false;
    mocks.state.isSpeaking = false;
    mocks.state.speechProvider = "none";
    mocks.openCampaignBuilder.mockReset();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVisualViewport,
    });
  });

  it("renders the messenger header, shared dialogue screen, and inline planning state", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        onQuestProposalEditHandoff={vi.fn().mockResolvedValue({ saved: false })}
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-chat-header")).toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-portrait-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-dialogue-screen")).toBeInTheDocument();
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.queryByText("Journeys Thread")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New chat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-text-input")).toHaveAttribute("rows", "1");
    expect(screen.getByTestId("journeys-companion-planner-text-input")).toHaveStyle("height: 48px");
    await waitFor(() => {
      expect(screen.getByText("I can help you shape that into something concrete when you're ready.")).toBeInTheDocument();
    });
    expect(screen.getByTestId("journeys-companion-planner-inline-proposals")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal-proposal-1")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal-proposal-2")).toBeInTheDocument();
    expect(screen.getByText("Create Focus quest")).toBeInTheDocument();
    expect(screen.queryByText("What time of day should this live in your schedule?")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-inline-options")).not.toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal-notes-proposal-1")).toHaveTextContent("Stored note");
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal-notes-proposal-1")).toHaveTextContent("Protect this block for the one thing that matters most.");
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal-subtasks-proposal-1")).toHaveTextContent("Choose the target");
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal-subtasks-proposal-1")).toHaveTextContent("Silence notifications");
    expect(screen.getByText("Create Backup quest")).toBeInTheDocument();
    expect(screen.queryByText("You")).not.toBeInTheDocument();
    expect(screen.queryByText("Quick reply")).not.toBeInTheDocument();
    expect(screen.queryByText("Schedule")).not.toBeInTheDocument();
  });

  it("renders the seeded opener for a fresh journeys thread without legacy starter chips", () => {
    mocks.state.messages = [
      {
        id: "chat-seed-1",
        role: "assistant",
        content: mocks.state.greeting,
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat",
        isSeed: true,
      },
    ];
    mocks.state.questions = [];
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    mocks.state.readyProposalCount = 0;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("The road's open. What are we setting in motion?")).toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-inline-options")).not.toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-text-input")).toHaveAttribute("placeholder", "Chat");
    expect(screen.queryByText("Quick start")).not.toBeInTheDocument();
  });

  it("shows a clean plan-day transcript without carried-over proposal cards", async () => {
    mocks.state.messages = [
      {
        id: "plan-day-user-1",
        role: "user",
        content: "Plan my day",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "plan",
      },
      {
        id: "plan-day-assistant-1",
        role: "assistant",
        content: [
          "To help you build a great day, can you tell me:",
          "- Which of your goals or tasks matters most today?",
          "- Are there any time constraints or outside commitments?",
          "- How's your energy this morning, and when do you usually feel your best?",
          "",
          "Once I know those, I can suggest the best flow for your day.",
        ].join("\n"),
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "plan",
      },
    ];
    mocks.state.questions = [];
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    mocks.state.readyProposalCount = 0;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Plan my day")).toBeInTheDocument();
    });
    expect(screen.getByTestId("journeys-companion-planner-dialogue-screen")).toHaveTextContent(
      "To help you build a great day, can you tell me:",
    );
    expect(screen.queryByTestId("journeys-companion-planner-inline-proposals")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Focus quest")).not.toBeInTheDocument();
  });

  it("does not show legacy starter template UI for custom assistant openers", () => {
    mocks.state.messages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "What's good homie?",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat",
        isSeed: true,
      },
    ];
    mocks.state.questions = [];
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    mocks.state.readyProposalCount = 0;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("What's good homie?")).toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-inline-options")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show me today's route." })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Help me make room for what matters." })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Help me break a big goal into steps." })).not.toBeInTheDocument();
  });

  it("renders launcher starters with the expected transcript roles", async () => {
    mocks.state.messages = [
      {
        id: "plan-quest-starter",
        role: "assistant",
        content: "Quest?",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "plan",
      },
    ];
    mocks.state.questions = [];
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    const questRender = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Quest?")).toBeInTheDocument();
    });
    expect(screen.queryByText("Help me create a new quest.")).not.toBeInTheDocument();
    questRender.unmount();

    mocks.state.messages = [
      {
        id: "plan-upcoming-user",
        role: "user",
        content: "What do I have coming up?",
        createdAt: "2026-04-18T07:59:00.000Z",
        source: "plan",
      },
      {
        id: "plan-upcoming-starter",
        role: "assistant",
        content: "Today: 14:00-15:00 Therapy; 15:00 Workout.\nTomorrow: 09:30 Inbox cleanup.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "plan",
      },
    ];
    const upcomingRender = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Today: 14:00-15:00 Therapy; 15:00 Workout\./i)).toBeInTheDocument();
    });
    expect(screen.getByText("What do I have coming up?")).toBeInTheDocument();
    expect(screen.queryByText("What do I have coming up for the rest of today and tomorrow?")).not.toBeInTheDocument();
    upcomingRender.unmount();

    mocks.state.messages = [
      {
        id: "plan-goal-starter",
        role: "assistant",
        content: "Name the goal you want to break down, and I'll help turn it into concrete steps.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "plan",
      },
    ];
    const goalRender = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/goal you want to break down/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Help me break a big goal into steps.")).not.toBeInTheDocument();
    goalRender.unmount();
  });

  it("strips raw markdown markers from assistant transcript bubbles", async () => {
    mocks.state.messages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "Your **calendar** is clear today.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat",
      },
    ];
    mocks.state.questions = [];
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    mocks.state.readyProposalCount = 0;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Your calendar is clear today.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Your **calendar** is clear today.")).not.toBeInTheDocument();
  });

  it("suppresses clarification prompts and quick replies when a proposal is ready to confirm", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        onQuestProposalEditHandoff={vi.fn().mockResolvedValue({ saved: false })}
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-inline-proposals")).toBeInTheDocument();
    expect(screen.queryByText("What time of day should this live in your schedule?")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-inline-options")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Morning" })).not.toBeInTheDocument();
  });

  it("hides a same-turn question-like assistant bubble when a ready quest proposal exists", async () => {
    mocks.state.messages = [
      {
        id: "plan-1",
        role: "assistant",
        content: "Just to check: Do you prefer to work out right after your workday?",
        createdAt: "2026-04-18T08:01:00.000Z",
        source: "plan",
      },
    ];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        onQuestProposalEditHandoff={vi.fn().mockResolvedValue({ saved: false })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Create Focus quest")).toBeInTheDocument();
    });
    expect(screen.queryByText(/do you prefer to work out right after your workday/i)).not.toBeInTheDocument();
    expect(screen.queryByText("What time of day should this live in your schedule?")).not.toBeInTheDocument();
  });

  it("routes composer, quick replies, and mic taps through the assistant hook", async () => {
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    mocks.state.readyProposalCount = 0;

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    fireEvent.change(screen.getByTestId("journeys-companion-planner-text-input"), {
      target: { value: "Rework my afternoon" },
    });
    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));
    fireEvent.click(screen.getByRole("button", { name: "Morning" }));
    fireEvent.click(screen.getByTestId("journeys-companion-planner-mic-button"));

    expect(mocks.assistant.setDraftInput).toHaveBeenCalledWith("Rework my afternoon");
    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.submitMessage).toHaveBeenCalledWith("Morning", "text");
    expect(mocks.assistant.toggleRecording).toHaveBeenCalledTimes(1);
  });

  it("routes proposal actions through the assistant hook", async () => {
    const onQuestProposalEditHandoff = vi.fn().mockResolvedValue({
      saved: true,
      savedTitle: "Edited Focus quest",
    });

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
        onQuestProposalEditHandoff={onQuestProposalEditHandoff}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm all" }));
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    });

    expect(mocks.assistant.confirmProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.assistant.confirmAll).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onQuestProposalEditHandoff).toHaveBeenCalledWith(
        expect.objectContaining({ id: "proposal-1" }),
      );
    });
    await waitFor(() => {
      expect(mocks.assistant.completeProposalEdit).toHaveBeenCalledWith("proposal-1", {
        savedTitle: "Edited Focus quest",
      });
    });
    expect(mocks.assistant.rejectProposal).not.toHaveBeenCalled();
  });

  it("auto-grows the composer and starts scrolling after the max height", async () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "scrollHeight");

    Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
      configurable: true,
      get() {
        return 220;
      },
    });

    try {
      render(
        <JourneysCompanionPlannerModal
          open
          onOpenChange={vi.fn()}
          presentation="dialog"
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("journeys-companion-planner-text-input")).toHaveStyle("height: 140px");
      });
      expect(screen.getByTestId("journeys-companion-planner-text-input")).toHaveStyle("overflow-y: auto");
    } finally {
      if (originalScrollHeight) {
        Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", originalScrollHeight);
      } else {
        delete (HTMLTextAreaElement.prototype as HTMLTextAreaElement & { scrollHeight?: unknown }).scrollHeight;
      }
    }
  });

  it("shows the speaking status row and lets the user stop playback", () => {
    mocks.state.isSpeaking = true;
    mocks.state.speechProvider = "cloud";

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-speaking-status")).toHaveTextContent(
      "Speaking with fallback audio.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop" }));

    expect(mocks.assistant.stopSpeaking).toHaveBeenCalledTimes(1);
  });

  it("starts a new chat from the header action", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByTestId("journeys-companion-new-chat-button"));

    await waitFor(() => {
      expect(mocks.assistant.startNewChat).toHaveBeenCalledTimes(1);
    });
  });

  it("disables Vaul input repositioning for the mobile drawer", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    const openDrawerProps = mocks.drawerRootProps.find((props) => props.open === true);

    expect(openDrawerProps?.repositionInputs).toBe(false);
  });

  it("updates the drawer shell height when visualViewport changes", async () => {
    const originalInnerHeight = window.innerHeight;
    const listeners = {
      resize: [] as Array<() => void>,
      scroll: [] as Array<() => void>,
    };
    const visualViewport = {
      height: 640,
      offsetTop: 0,
      addEventListener: vi.fn((event: "resize" | "scroll", handler: () => void) => {
        listeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: "resize" | "scroll", handler: () => void) => {
        listeners[event] = listeners[event].filter((entry) => entry !== handler);
      }),
    };

    try {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 640,
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: visualViewport,
      });

      render(
        <JourneysCompanionPlannerModal
          open
          onOpenChange={vi.fn()}
          presentation="drawer"
        />,
      );

      const shell = screen.getByTestId("journeys-companion-planner-shell");
      const drawerContent = screen.getByTestId("journeys-companion-planner-drawer-content");
      await waitFor(() => {
        expect(shell).toHaveStyle("height: 616px");
        expect(drawerContent).toHaveStyle("bottom: 0px");
      });

      act(() => {
        visualViewport.height = 480;
        listeners.resize.forEach((handler) => handler());
      });

      await waitFor(() => {
        expect(shell).toHaveStyle("height: 456px");
      });
    } finally {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("lifts the mobile drawer above the keyboard when the visual viewport shrinks", async () => {
    const originalInnerHeight = window.innerHeight;
    const listeners = {
      resize: [] as Array<() => void>,
      scroll: [] as Array<() => void>,
    };
    const visualViewport = {
      height: 540,
      offsetTop: 0,
      addEventListener: vi.fn((event: "resize" | "scroll", handler: () => void) => {
        listeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: "resize" | "scroll", handler: () => void) => {
        listeners[event] = listeners[event].filter((entry) => entry !== handler);
      }),
    };

    try {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 820,
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: visualViewport,
      });

      render(
        <JourneysCompanionPlannerModal
          open
          onOpenChange={vi.fn()}
          presentation="drawer"
        />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("journeys-companion-planner-drawer-content")).toHaveStyle("bottom: 280px");
      });
    } finally {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("updates and resets the mobile drawer lift as the viewport changes", async () => {
    const originalInnerHeight = window.innerHeight;
    const listeners = {
      resize: [] as Array<() => void>,
      scroll: [] as Array<() => void>,
    };
    const visualViewport = {
      height: 620,
      offsetTop: 0,
      addEventListener: vi.fn((event: "resize" | "scroll", handler: () => void) => {
        listeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event: "resize" | "scroll", handler: () => void) => {
        listeners[event] = listeners[event].filter((entry) => entry !== handler);
      }),
    };

    try {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: 700,
      });
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: visualViewport,
      });

      render(
        <JourneysCompanionPlannerModal
          open
          onOpenChange={vi.fn()}
          presentation="drawer"
        />,
      );

      const shell = screen.getByTestId("journeys-companion-planner-shell");
      const drawerContent = screen.getByTestId("journeys-companion-planner-drawer-content");

      await waitFor(() => {
        expect(shell).toHaveStyle("height: 596px");
        expect(drawerContent).toHaveStyle("bottom: 80px");
      });

      act(() => {
        visualViewport.height = 480;
        listeners.resize.forEach((handler) => handler());
      });

      await waitFor(() => {
        expect(shell).toHaveStyle("height: 456px");
        expect(drawerContent).toHaveStyle("bottom: 220px");
      });

      act(() => {
        visualViewport.height = 700;
        listeners.resize.forEach((handler) => handler());
      });

      await waitFor(() => {
        expect(shell).toHaveStyle("height: 676px");
        expect(drawerContent).toHaveStyle("bottom: 0px");
      });
    } finally {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("keeps textarea focus scroll correction local to the transcript viewport", async () => {
    const { container } = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    const transcriptViewport = container.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    expect(transcriptViewport).not.toBeNull();

    const viewportScrollToSpy = vi.fn();
    const windowScrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    Object.defineProperty(transcriptViewport!, "clientHeight", {
      configurable: true,
      value: 240,
    });
    Object.defineProperty(transcriptViewport!, "scrollHeight", {
      configurable: true,
      value: 920,
    });
    Object.defineProperty(transcriptViewport!, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(transcriptViewport!, "scrollTo", {
      configurable: true,
      writable: true,
      value: viewportScrollToSpy,
    });

    try {
      viewportScrollToSpy.mockClear();

      fireEvent.focus(screen.getByTestId("journeys-companion-planner-text-input"));

      await waitFor(() => {
        expect(viewportScrollToSpy).toHaveBeenCalledWith({ top: 680, behavior: "auto" });
      });
      expect(windowScrollToSpy).not.toHaveBeenCalled();
    } finally {
      windowScrollToSpy.mockRestore();
    }
  });

  it("opens past chats even when the current thread cannot be archived yet", async () => {
    mocks.state.canArchiveThread = false;
    mocks.state.archiveDisabledReason = "Start the conversation before archiving this thread.";

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByTestId("journeys-companion-archive-button"));

    expect(mocks.assistant.archiveCurrentThread).not.toHaveBeenCalled();
    expect(screen.getByTestId("journeys-companion-thread-picker")).toBeInTheDocument();
  });

  it("opens past chats from a thread-history launch intent without archiving", async () => {
    const onLaunchIntentConsumed = vi.fn();

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        launchIntent={{
          id: "launch-history",
          message: "",
          starterIntent: "thread_history",
          target: "planner",
          briefingContext: null,
        }}
        onLaunchIntentConsumed={onLaunchIntentConsumed}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("journeys-companion-thread-picker")).toBeInTheDocument();
    });

    expect(mocks.assistant.archiveCurrentThread).not.toHaveBeenCalled();
    expect(onLaunchIntentConsumed).toHaveBeenCalledWith("launch-history");
  });

  it("archives the current chat and opens past chats", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByTestId("journeys-companion-archive-button"));

    await waitFor(() => {
      expect(mocks.assistant.archiveCurrentThread).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("journeys-companion-thread-picker")).toBeInTheDocument();
    expect(screen.getByText("Past chats")).toBeInTheDocument();
    expect(screen.getByText("Earlier thread")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-thread-resume-archived-session-1"));

    await waitFor(() => {
      expect(mocks.assistant.resumeThread).toHaveBeenCalledWith("archived-session-1");
    });
  });

  it("disables the thread picker when history is unavailable during rollout", () => {
    mocks.state.canOpenThreadPicker = false;
    mocks.state.threadPickerDisabledReason = "Thread history will be available after the latest backend update.";
    mocks.state.threadHistoryEmptyStateMessage = "Past chats will show up after the latest backend update.";
    mocks.state.canArchiveThread = false;
    mocks.state.archiveDisabledReason = "Thread history will be available after the latest backend update.";
    mocks.state.historyThreads = [];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByTestId("journeys-companion-archive-button"));

    expect(screen.getByTestId("journeys-companion-thread-picker")).toBeInTheDocument();
    expect(screen.getByText("Past chats will show up after the latest backend update.")).toBeInTheDocument();
  });

  it("does not treat existing planner text as active typing when the modal opens", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await act(async () => {});

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
  });

  it("keeps the composer in submit mode when follow-up questions appear", async () => {
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    });

    mocks.state.messages = [];
    mocks.state.questions = [];
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    mocks.state.readyProposalCount = 0;

    const { rerender } = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    mocks.state.questions = [
      {
        id: "time_of_day",
        prompt: "What time of day should this live in your schedule?",
        required: true,
        field: "time_of_day",
        options: ["Morning", "Afternoon", "Evening"],
      },
    ];

    rerender(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await act(async () => {});

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    await act(async () => {});

    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
  });

  it("clears question history when the active journeys thread changes", async () => {
    mocks.state.messages = [];
    mocks.state.questions = [
      {
        id: "time_of_day",
        prompt: "What time of day should this live in your schedule?",
        required: true,
        field: "time_of_day",
        options: ["Morning", "Afternoon", "Evening"],
      },
    ];
    mocks.state.proposals = [];
    mocks.state.pendingProposals = [];
    mocks.state.readyProposalCount = 0;

    const { rerender } = render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("What time of day should this live in your schedule?")).toBeInTheDocument();
    });

    mocks.state.activeThread = {
      sessionId: "journeys-session-2",
      companionId: "companion-1",
      surface: "journeys",
      title: "Fresh thread",
      previewText: "A new chat just started.",
      createdAt: "2026-04-18T09:00:00.000Z",
      lastMessageAt: "2026-04-18T09:00:00.000Z",
      archivedAt: null,
      messageCount: 1,
    };
    mocks.state.messages = [
      {
        id: "chat-2",
        role: "assistant",
        content: "Fresh start. What's the move?",
        createdAt: "2026-04-18T09:00:00.000Z",
        source: "chat",
        isSeed: true,
      },
    ];
    mocks.state.questions = [];

    await act(async () => {
      rerender(
        <JourneysCompanionPlannerModal
          open
          onOpenChange={vi.fn()}
          presentation="drawer"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.queryByText("What time of day should this live in your schedule?")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Fresh start. What's the move?")).toBeInTheDocument();
  });
});
