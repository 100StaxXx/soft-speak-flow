import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  chatDraftInput: "Talk me through tomorrow",
  plannerDraftInput: "Make it a real quest",
  setChatDraftInput: vi.fn(),
  submitChatTypedMessage: vi.fn(),
  clearPlannerHandoff: vi.fn(),
  setPlannerDraftInput: vi.fn(),
  submitPlannerTypedMessage: vi.fn(),
  submitPlannerMessage: vi.fn().mockResolvedValue(undefined),
  confirmProposal: vi.fn(),
  rejectProposal: vi.fn(),
  pendingPlannerHandoffMessage: null as string | null,
  conversationMessages: [
    {
      id: "chat-1",
      role: "assistant" as const,
      content: "What's gucci fam?",
      createdAt: "2026-04-18T08:00:00.000Z",
      isSeed: true,
    },
  ],
  plannerMessages: [] as Array<{
    id: string;
    role: "companion" | "user";
    content: string;
    createdAt: string;
  }>,
  plannerQuestions: [] as Array<{
    id: string;
    prompt: string;
    required: boolean;
    field: "time_of_day" | "time_reason" | "cadence" | "end_date" | "campaign_link" | "duration" | "details";
    options?: string[];
  }>,
  pendingProposals: [] as Array<{
    id: string;
    kind: "create_quest";
    title: string;
    summary: string;
    payload: Record<string, unknown>;
    status: "pending";
    readyToConfirm: boolean;
    missingFields?: string[];
  }>,
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

vi.mock("@/hooks/useJourneysCompanionConversation", () => ({
  useJourneysCompanionConversation: () => ({
    messages: mocks.conversationMessages,
    draftInput: mocks.chatDraftInput,
    setDraftInput: mocks.setChatDraftInput,
    isSubmitting: false,
    pendingPlannerHandoffMessage: mocks.pendingPlannerHandoffMessage,
    clearPlannerHandoff: mocks.clearPlannerHandoff,
    submitTypedMessage: mocks.submitChatTypedMessage,
    submitMessage: vi.fn(),
  }),
}));

vi.mock("@/hooks/useCompanionPlanner", () => ({
  useCompanionPlanner: () => ({
    messages: mocks.plannerMessages,
    questions: mocks.plannerQuestions,
    pendingProposals: mocks.pendingProposals,
    readyProposalCount: mocks.pendingProposals.filter((proposal) => proposal.readyToConfirm).length,
    draftInput: mocks.plannerDraftInput,
    setDraftInput: mocks.setPlannerDraftInput,
    isSubmitting: false,
    isClassifying: false,
    submitTypedMessage: mocks.submitPlannerTypedMessage,
    submitMessage: mocks.submitPlannerMessage,
    confirmProposal: mocks.confirmProposal,
    rejectProposal: mocks.rejectProposal,
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
    mocks.chatDraftInput = "Talk me through tomorrow";
    mocks.plannerDraftInput = "Make it a real quest";
    mocks.pendingPlannerHandoffMessage = null;
    mocks.conversationMessages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "What's gucci fam?",
        createdAt: "2026-04-18T08:00:00.000Z",
        isSeed: true,
      },
    ];
    mocks.plannerMessages = [];
    mocks.plannerQuestions = [];
    mocks.pendingProposals = [];
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
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

  it("renders the portrait rail and a single shared dialogue screen", () => {
    vi.useFakeTimers();

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-portrait-rail")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-dialogue-screen")).toBeInTheDocument();
    expect(screen.getAllByText("Nova")).toHaveLength(2);
    expect(screen.getByText("What's gucci fam?")).toBeInTheDocument();
    expect(screen.queryByText("A light RPG-style overlay for talking through quests, momentum, and whatever is on your mind.")).not.toBeInTheDocument();
  });

  it("routes chat composer changes and send through the journeys conversation hook after typing finishes", () => {
    vi.useFakeTimers();

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    act(() => {
      vi.runAllTimers();
    });

    fireEvent.change(screen.getByTestId("journeys-companion-planner-text-input"), {
      target: { value: "Let me vent for a second" },
    });
    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(mocks.setChatDraftInput).toHaveBeenCalledWith("Let me vent for a second");
    expect(mocks.submitChatTypedMessage).toHaveBeenCalledTimes(1);
  });

  it("reveals assistant text letter-by-letter and lets send finish the current line", () => {
    vi.useFakeTimers();
    mocks.chatDraftInput = "";
    mocks.conversationMessages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "Animate this line slowly",
        createdAt: "2026-04-18T08:00:00.000Z",
        isSeed: true,
      },
    ];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.queryByText("Animate this line slowly")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(54);
    });

    expect(screen.getByText(/^Ani/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(screen.getByText("Animate this line slowly")).toBeInTheDocument();
    expect(mocks.submitChatTypedMessage).not.toHaveBeenCalled();
  });

  it("lets tapping the dialogue screen finish the current assistant line", () => {
    vi.useFakeTimers();
    mocks.conversationMessages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "Tap to finish me",
        createdAt: "2026-04-18T08:00:00.000Z",
        isSeed: true,
      },
    ];

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    act(() => {
      vi.advanceTimersByTime(36);
    });

    expect(screen.queryByText("Tap to finish me")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-planner-dialogue-screen"));

    expect(screen.getByText("Tap to finish me")).toBeInTheDocument();
  });

  it("renders assistant lines instantly when reduced motion is preferred", () => {
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

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("What's gucci fam?")).toBeInTheDocument();
  });

  it("keeps planning in the same shell with inline options and only the active proposal visible", async () => {
    mocks.pendingPlannerHandoffMessage = "Plan tomorrow for me";
    mocks.conversationMessages = [
      {
        id: "chat-1",
        role: "assistant",
        content: "What's gucci fam?",
        createdAt: "2026-04-18T08:00:00.000Z",
        isSeed: true,
      },
      {
        id: "chat-2",
        role: "user",
        content: "Plan tomorrow for me",
        createdAt: "2026-04-18T08:01:00.000Z",
      },
    ];
    mocks.plannerMessages = [
      {
        id: "planner-1",
        role: "user",
        content: "Plan tomorrow for me",
        createdAt: "2026-04-18T08:01:01.000Z",
      },
      {
        id: "planner-2",
        role: "companion",
        content: "I can turn that into a clean quest flow.",
        createdAt: "2026-04-18T08:01:02.000Z",
      },
    ];
    mocks.plannerQuestions = [
      {
        id: "time_of_day",
        prompt: "What time of day should this live in your schedule?",
        required: true,
        field: "time_of_day",
        options: ["Morning", "Afternoon", "Evening"],
      },
    ];
    mocks.pendingProposals = [
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

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    await waitFor(() => {
      expect(mocks.submitPlannerMessage).toHaveBeenCalledWith("Plan tomorrow for me", "text");
    });

    expect(mocks.clearPlannerHandoff).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("journeys-companion-planner-dialogue-screen")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("I can turn that into a clean quest flow.")).toBeInTheDocument();
      expect(screen.getByText("What time of day should this live in your schedule?")).toBeInTheDocument();
    });
    expect(screen.getByTestId("journeys-companion-planner-inline-options")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-inline-proposal")).toBeInTheDocument();
    expect(screen.getByText("Create Focus quest")).toBeInTheDocument();
    expect(screen.queryByText("Create Backup quest")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-handoff-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-questions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("journeys-companion-planner-proposals")).not.toBeInTheDocument();
    expect(screen.queryAllByText("Plan tomorrow for me")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Morning" }));
    expect(mocks.submitPlannerMessage).toHaveBeenCalledWith("Morning", "text");

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(mocks.confirmProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.rejectProposal).toHaveBeenCalledWith("proposal-1");
  });
});
