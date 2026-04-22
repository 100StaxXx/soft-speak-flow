import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  JourneysCompanionPlannerModal,
  type JourneysCompanionPlannerAssistant,
} from "./JourneysCompanionPlannerModal";

const mocks = vi.hoisted(() => ({
  assistant: {
    setDraftInput: vi.fn(),
    submitTypedMessage: vi.fn(),
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

const buildAssistant = (
  overrides: Partial<JourneysCompanionPlannerAssistant> = {},
): JourneysCompanionPlannerAssistant => ({
  todayLabel: "Tuesday, April 21",
  placeholder: "Talk to Cosmiq",
  messages: [
    {
      id: "message-1",
      role: "assistant",
      content: "What's good, friend?",
      createdAt: "2026-04-21T10:00:00.000Z",
    },
    {
      id: "message-2",
      role: "assistant",
      content: "Quest?",
      createdAt: "2026-04-21T10:01:00.000Z",
      variant: "quest_prompt",
    },
    {
      id: "message-3",
      role: "user",
      content: "Plan my day",
      createdAt: "2026-04-21T10:02:00.000Z",
    },
  ],
  draftInput: "Keep moving",
  setDraftInput: mocks.assistant.setDraftInput,
  isSubmitting: false,
  submitTypedMessage: mocks.assistant.submitTypedMessage,
  ...overrides,
});

describe("JourneysCompanionPlannerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders only the simplified transcript bubbles, including the yellow quest prompt", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        assistant={buildAssistant()}
      />,
    );

    expect(screen.getByText("What's good, friend?")).toBeInTheDocument();
    expect(screen.getByText("Quest?")).toBeInTheDocument();
    expect(screen.getByText("Plan my day")).toBeInTheDocument();
    expect(screen.getByText("Nova")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByText("Quest?").closest("[data-message-variant='quest_prompt']")).toBeInTheDocument();
  });

  it("wires the simplified composer to the assistant callbacks", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
        assistant={buildAssistant()}
      />,
    );

    fireEvent.change(screen.getByTestId("journeys-companion-planner-text-input"), {
      target: { value: "Need a reset" },
    });
    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(mocks.assistant.setDraftInput).toHaveBeenCalledWith("Need a reset");
    expect(mocks.assistant.submitTypedMessage).toHaveBeenCalled();
  });

  it("renders the same simplified shell in drawer mode", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
        assistant={buildAssistant({ draftInput: "" })}
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-send-button")).toBeDisabled();
  });
});
