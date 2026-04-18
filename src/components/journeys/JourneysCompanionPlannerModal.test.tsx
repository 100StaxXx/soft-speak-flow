import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setDraftInput: vi.fn(),
  submitTypedMessage: vi.fn(),
  toggleRecording: vi.fn(),
  requestMicrophonePermission: vi.fn(),
  setShowPermissionDialog: vi.fn(),
  confirmProposal: vi.fn(),
  rejectProposal: vi.fn(),
  confirmAll: vi.fn(),
  showPermissionDialog: false,
  isRecording: false,
  interimText: "",
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

vi.mock("@/hooks/useCompanionPlanner", () => ({
  useCompanionPlanner: () => ({
    greeting: "Let's sketch your next move together.",
    messages: [
      {
        id: "message-1",
        role: "companion",
        content: "Let's sketch your next move together.",
        createdAt: "2026-04-18T08:00:00.000Z",
      },
      {
        id: "message-2",
        role: "user",
        content: "Help me protect an hour for deep work tomorrow.",
        createdAt: "2026-04-18T08:01:00.000Z",
        inputMode: "text",
      },
      {
        id: "message-3",
        role: "companion",
        content: "I can hold 3 PM tomorrow if that still fits your energy.",
        createdAt: "2026-04-18T08:02:00.000Z",
      },
    ],
    questions: [
      {
        id: "time_of_day",
        prompt: "What time of day should this live in your schedule?",
        required: true,
        field: "time_of_day",
        options: ["Morning", "Afternoon", "Evening"],
      },
    ],
    pendingProposals: [
      {
        id: "proposal-1",
        kind: "create_quest",
        title: "Create Deep work block",
        summary: "Reserve a two hour focus quest tomorrow afternoon.",
        reasoning: null,
        payload: {},
        status: "pending",
        readyToConfirm: true,
      },
    ],
    readyProposalCount: 1,
    draftInput: "Protect an hour for writing",
    setDraftInput: mocks.setDraftInput,
    interimText: mocks.interimText,
    isSubmitting: false,
    isClassifying: false,
    isRecording: mocks.isRecording,
    isAutoStopping: false,
    isVoiceSupported: true,
    permissionStatus: "prompt",
    showPermissionDialog: mocks.showPermissionDialog,
    setShowPermissionDialog: mocks.setShowPermissionDialog,
    isRequestingPermission: false,
    submitTypedMessage: mocks.submitTypedMessage,
    toggleRecording: mocks.toggleRecording,
    requestMicrophonePermission: mocks.requestMicrophonePermission,
    confirmProposal: mocks.confirmProposal,
    rejectProposal: mocks.rejectProposal,
    confirmAll: mocks.confirmAll,
  }),
}));

vi.mock("@/components/AudioReactiveWaveform", () => ({
  AudioReactiveWaveform: ({ isActive }: { isActive: boolean }) => (
    <div data-testid="waveform" data-active={String(isActive)} />
  ),
}));

vi.mock("@/components/PermissionRequestDialog", () => ({
  PermissionRequestDialog: ({
    isOpen,
    onRequestPermission,
    onClose,
  }: {
    isOpen: boolean;
    onRequestPermission: () => void;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="permission-dialog">
        <button type="button" onClick={onRequestPermission}>
          request permission
        </button>
        <button type="button" onClick={onClose}>
          close permission
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) => (open ? <div>{children}</div> : null),
  DrawerContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children, className }: { children: ReactNode; className?: string }) => <div className={className}>{children}</div>,
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { JourneysCompanionPlannerModal } from "./JourneysCompanionPlannerModal";

describe("JourneysCompanionPlannerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.showPermissionDialog = false;
    mocks.isRecording = false;
    mocks.interimText = "";
  });

  it("renders the backlit opener and latest companion reply", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-modal")).toBeInTheDocument();
    expect(screen.getByText("Let's sketch your next move together.")).toBeInTheDocument();
    expect(screen.getByTestId("journeys-companion-planner-latest-reply")).toHaveTextContent(
      "I can hold 3 PM tomorrow if that still fits your energy.",
    );
  });

  it("routes text entry and send through the planner hook", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    fireEvent.change(screen.getByTestId("journeys-companion-planner-text-input"), {
      target: { value: "Protect tomorrow afternoon" },
    });
    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));

    expect(mocks.setDraftInput).toHaveBeenCalledWith("Protect tomorrow afternoon");
    expect(mocks.submitTypedMessage).toHaveBeenCalledTimes(1);
  });

  it("routes mic and permission actions through the planner hook", () => {
    mocks.showPermissionDialog = true;
    mocks.isRecording = true;
    mocks.interimText = "Tomorrow at 3 PM...";

    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="drawer"
      />,
    );

    fireEvent.click(screen.getByTestId("journeys-companion-planner-mic-button"));
    fireEvent.click(screen.getByRole("button", { name: "request permission" }));

    expect(mocks.toggleRecording).toHaveBeenCalledTimes(1);
    expect(mocks.requestMicrophonePermission).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("journeys-companion-planner-listening")).toBeInTheDocument();
  });

  it("renders compact proposal actions and forwards confirm/reject", () => {
    render(
      <JourneysCompanionPlannerModal
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByTestId("journeys-companion-planner-proposals")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(mocks.confirmProposal).toHaveBeenCalledWith("proposal-1");
    expect(mocks.rejectProposal).toHaveBeenCalledWith("proposal-1");
  });
});
