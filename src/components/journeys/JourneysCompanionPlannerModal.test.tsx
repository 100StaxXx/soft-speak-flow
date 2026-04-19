import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_PLANNER_STARTER_TEMPLATES } from "@/shared/companionPlannerCopy";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
    submitMessage: vi.fn().mockResolvedValue(undefined),
    submitPlannerMessage: vi.fn().mockResolvedValue(undefined),
    confirmProposal: vi.fn(),
    rejectProposal: vi.fn(),
    confirmAll: vi.fn(),
    toggleRecording: vi.fn(),
    requestMicrophonePermission: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    archiveCurrentThread: vi.fn().mockResolvedValue(undefined),
    resumeThread: vi.fn().mockResolvedValue(undefined),
  },
  state: {
    greeting: "The road's open. What are we setting in motion?",
    messages: [
      {
        id: "chat-1",
        role: "assistant" as const,
        content: "The road's open. What are we setting in motion?",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat" as const,
        isSeed: true,
      },
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
        payload: {},
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
        payload: {},
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
      previewText: "The road's open. What are we setting in motion?",
      createdAt: "2026-04-18T08:00:00.000Z",
      lastMessageAt: "2026-04-18T08:01:00.000Z",
      archivedAt: null,
    },
    archivedThreads: [
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys" as const,
        title: "Earlier thread",
        previewText: "Let's pick up yesterday's plan.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
      },
    ],
    canArchiveThread: true,
    archiveDisabledReason: null as string | null,
    isLoadingThreads: false,
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
    placeholder: "Talk to me, or ask how today looks.",
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
    submitMessage: mocks.assistant.submitMessage,
    submitPlannerMessage: mocks.assistant.submitPlannerMessage,
    toggleRecording: mocks.assistant.toggleRecording,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
    confirmProposal: mocks.assistant.confirmProposal,
    rejectProposal: mocks.assistant.rejectProposal,
    confirmAll: mocks.assistant.confirmAll,
    autoplayVoice: false,
    setAutoplayVoice: vi.fn(),
    muteSpokenReplies: false,
    setMuteSpokenReplies: vi.fn(),
    isSpeaking: false,
    speechProvider: "none" as const,
    stopSpeaking: vi.fn(),
    activeThread: mocks.state.activeThread,
    archivedThreads: mocks.state.archivedThreads,
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
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DrawerContent: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.state.greeting = "The road's open. What are we setting in motion?";
    mocks.state.messages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "The road's open. What are we setting in motion?",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat",
        isSeed: true,
      },
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
        payload: {},
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
        payload: {},
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
      previewText: "The road's open. What are we setting in motion?",
      createdAt: "2026-04-18T08:00:00.000Z",
      lastMessageAt: "2026-04-18T08:01:00.000Z",
      archivedAt: null,
    };
    mocks.state.archivedThreads = [
      {
        sessionId: "archived-session-1",
        companionId: "companion-1",
        surface: "journeys",
        title: "Earlier thread",
        previewText: "Let's pick up yesterday's plan.",
        createdAt: "2026-04-17T08:00:00.000Z",
        lastMessageAt: "2026-04-17T08:05:00.000Z",
        archivedAt: "2026-04-17T09:00:00.000Z",
      },
    ];
    mocks.state.canArchiveThread = true;
    mocks.state.archiveDisabledReason = null;
    mocks.state.isLoadingThreads = false;
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
  });

  it("renders the messenger header, shared dialogue screen, and inline planning state", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-chat-header")).toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-portrait-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-dialogue-screen")).toBeInTheDocument();
    expect(screen.getByText("The road's open. What are we setting in motion?")).toBeInTheDocument();
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByText("Journeys Thread")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("I can help you shape that into something concrete when you're ready.")).toBeInTheDocument();
      expect(screen.getByText("What time of day should this live in your schedule?")).toBeInTheDocument();
    });
    expect(screen.getByTestId("journeys-companion-planner-inline-options")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal")).toBeInTheDocument();
    expect(screen.getByText("Create Focus quest")).toBeInTheDocument();
    expect(screen.queryByText("Create Backup quest")).not.toBeInTheDocument();
    expect(screen.queryByText("You")).not.toBeInTheDocument();
    expect(screen.queryByText("Quick reply")).not.toBeInTheDocument();
    expect(screen.queryByText("Schedule")).not.toBeInTheDocument();
  });

  it("shows the seeded opener and starter templates on first load", async () => {
    mocks.state.messages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "The road's open. What are we setting in motion?",
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
    expect(screen.getByTestId("journeys-companion-planner-starter-options")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-text-input")).toHaveAttribute("placeholder", "Talk to me, or ask how today looks.");
    expect(screen.queryByText("Quick start")).not.toBeInTheDocument();

    for (const starter of COMPANION_PLANNER_STARTER_TEMPLATES) {
      expect(screen.getByRole("button", { name: starter })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "I'll type my own." })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Help me break a big goal into steps." }));

    await waitFor(() => {
      expect(mocks.assistant.submitMessage).toHaveBeenCalledWith(
        "Help me break a big goal into steps.",
        "text",
      );
    });
    expect(mocks.assistant.submitPlannerMessage).not.toHaveBeenCalled();
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

  it("routes composer, quick replies, mic taps, and proposal actions through the assistant hook", async () => {
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
    fireEvent.click(screen.getAllByRole("button", { name: "Confirm" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm all" }));

    expect(mocks.assistant.setDraftInput).toHaveBeenCalledWith("Rework my afternoon");
    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.submitMessage).toHaveBeenCalledWith("Morning", "text");
    expect(mocks.assistant.toggleRecording).toHaveBeenCalledTimes(1);
    expect(mocks.assistant.confirmProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.assistant.rejectProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.assistant.confirmAll).toHaveBeenCalledTimes(1);
  });

  it("renders the archive control and disables it when the thread cannot be archived", () => {
    mocks.state.canArchiveThread = false;
    mocks.state.archiveDisabledReason = "Finish or dismiss the current plan before archiving this thread.";

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-archive-button")).toBeDisabled();
    expect(screen.getByText("Finish or dismiss the current plan before archiving this thread.")).toBeInTheDocument();
  });

  it("opens the thread picker and resumes archived threads from it", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.click(screen.getByTestId("journeys-companion-thread-picker-trigger"));

    expect(screen.getByTestId("journeys-companion-thread-picker")).toBeInTheDocument();
    expect(screen.getByText("Earlier thread")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-thread-resume-archived-session-1"));

    await waitFor(() => {
      expect(mocks.assistant.resumeThread).toHaveBeenCalledWith("archived-session-1");
    });
  });

  it("reveals assistant text letter-by-letter and lets send finish the current line", () => {
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

    act(() => {
      vi.advanceTimersByTime(54);
    });

    expect(screen.queryByText("What time of day should this live in your schedule?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(screen.getByText("What time of day should this live in your schedule?")).toBeInTheDocument();
    expect(mocks.assistant.submitTypedMessage).not.toHaveBeenCalled();
  });
});
