import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setChatDraftInput: vi.fn(),
  submitChatTypedMessage: vi.fn(),
  clearPlannerHandoff: vi.fn(),
  setPlannerDraftInput: vi.fn(),
  submitPlannerTypedMessage: vi.fn(),
  submitPlannerMessage: vi.fn().mockResolvedValue(undefined),
  confirmProposal: vi.fn(),
  rejectProposal: vi.fn(),
  confirmAll: vi.fn(),
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
    draftInput: "Talk me through tomorrow",
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
    draftInput: "Make it a real quest",
    setDraftInput: mocks.setPlannerDraftInput,
    isSubmitting: false,
    isClassifying: false,
    submitTypedMessage: mocks.submitPlannerTypedMessage,
    submitMessage: mocks.submitPlannerMessage,
    confirmProposal: mocks.confirmProposal,
    rejectProposal: mocks.rejectProposal,
    confirmAll: mocks.confirmAll,
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
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it("renders the large companion opener state", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.getByText("What's gucci fam?")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-transcript")).toBeInTheDocument();
  });

  it("routes chat composer changes and send through the journeys conversation hook", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.change(screen.getByTestId("journeys-companion-planner-text-input"), {
      target: { value: "Let me vent for a second" },
    });
    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(mocks.setChatDraftInput).toHaveBeenCalledWith("Let me vent for a second");
    expect(mocks.submitChatTypedMessage).toHaveBeenCalledTimes(1);
  });

  it("switches into planner mode on handoff and keeps compact proposal actions inline", async () => {
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
    expect(screen.getByTestId("journeys-companion-planner-handoff-banner")).toBeInTheDocument();
    expect(screen.getByText("I can turn that into a clean quest flow.")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-questions")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-proposals")).toBeInTheDocument();
    expect(screen.queryAllByText("Plan tomorrow for me")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(mocks.confirmProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.rejectProposal).toHaveBeenCalledWith("proposal-1");
  });
});
