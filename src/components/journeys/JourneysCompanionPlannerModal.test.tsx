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
  },
  state: {
    greeting: "What's gucci, fam. Hand me the calendar.",
    messages: [
      {
        id: "chat-1",
        role: "assistant" as const,
        content: "What's gucci, fam. Hand me the calendar.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat" as const,
      },
      {
        id: "plan-1",
        role: "assistant" as const,
        content: "I can turn that into a clean quest flow.",
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
    placeholder: "Pick a starter or tell me what's stuck...",
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

import { JourneysCompanionPlannerModal } from "./JourneysCompanionPlannerModal";

describe("JourneysCompanionPlannerModal", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mocks.state.greeting = "What's gucci, fam. Hand me the calendar.";
    mocks.state.messages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "What's gucci, fam. Hand me the calendar.",
        createdAt: "2026-04-18T08:00:00.000Z",
        source: "chat",
      },
      {
        id: "plan-1",
        role: "assistant",
        content: "I can turn that into a clean quest flow.",
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

  it("renders the portrait rail, shared dialogue screen, and inline planning state", async () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-portrait-rail")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-dialogue-screen")).toBeInTheDocument();
    expect(screen.getAllByText("Nova").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("What's gucci, fam. Hand me the calendar.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("I can turn that into a clean quest flow.")).toBeInTheDocument();
      expect(screen.getByText("What time of day should this live in your schedule?")).toBeInTheDocument();
    });
    expect(screen.getByTestId("journeys-companion-planner-inline-options")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal")).toBeInTheDocument();
    expect(screen.getByText("Create Focus quest")).toBeInTheDocument();
    expect(screen.queryByText("Create Backup quest")).not.toBeInTheDocument();
  });

  it("shows the seeded opener and starter templates on first load", async () => {
    mocks.state.messages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "What's gucci, fam. Hand me the calendar.",
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

    expect(screen.getByText("What's gucci, fam. Hand me the calendar.")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-starter-options")).toBeInTheDocument();

    for (const starter of COMPANION_PLANNER_STARTER_TEMPLATES) {
      expect(screen.getByRole("button", { name: starter })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Help me break down a big goal." }));

    await waitFor(() => {
      expect(mocks.assistant.submitPlannerMessage).toHaveBeenCalledWith(
        "Help me break down a big goal.",
        "text",
      );
    });
    expect(mocks.assistant.submitMessage).not.toHaveBeenCalled();
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
