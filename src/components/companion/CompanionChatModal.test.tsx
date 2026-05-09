import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  visual: {
    companionLabel: "Nova",
    imageUrl: "/placeholder-companion.svg" as string | null,
    focalX: null as number | null,
    focalY: null as number | null,
    element: "fire" as string | null,
    usesPortraitShell: false,
  },
  assistant: {
    submitTypedMessage: vi.fn(),
    submitMessage: vi.fn(),
    startNewChat: vi.fn(),
    archiveCurrentThread: vi.fn(),
    confirmSuggestedQuest: vi.fn(),
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    setDraftInput: vi.fn(),
    toggleRecording: vi.fn(),
    stopSpeaking: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    requestMicrophonePermission: vi.fn(),
  },
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => mocks.visual,
}));

vi.mock("@/hooks/useCompanionAssistant", () => ({
  useCompanionAssistant: () => ({
    messages: [
      {
        id: "message-1",
        role: "assistant",
        content: "Ready when you are.",
        createdAt: "2026-05-08T10:00:00.000Z",
        source: "agent",
      },
    ],
    structuredResponse: null,
    activeFollowUp: null,
    pendingAction: null,
    savedSuggestionProposalIds: [],
    pendingSuggestionProposalId: null,
    isSubmitting: false,
    isResolvingAction: false,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    isSpeaking: false,
    isLoadingThreads: false,
    canStartNewChat: true,
    canArchiveThread: true,
    draftInput: "",
    interimText: "",
    placeholder: "Message Nova",
    permissionStatus: "granted",
    showPermissionDialog: false,
    isRequestingPermission: false,
    submitTypedMessage: mocks.assistant.submitTypedMessage,
    submitMessage: mocks.assistant.submitMessage,
    startNewChat: mocks.assistant.startNewChat,
    archiveCurrentThread: mocks.assistant.archiveCurrentThread,
    confirmSuggestedQuest: mocks.assistant.confirmSuggestedQuest,
    confirmPendingAction: mocks.assistant.confirmPendingAction,
    cancelPendingAction: mocks.assistant.cancelPendingAction,
    setDraftInput: mocks.assistant.setDraftInput,
    toggleRecording: mocks.assistant.toggleRecording,
    stopSpeaking: mocks.assistant.stopSpeaking,
    setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
  }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DrawerContent: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DrawerDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/AudioReactiveWaveform", () => ({
  AudioReactiveWaveform: () => <div data-testid="audio-waveform" />,
}));

vi.mock("@/components/companion/CompanionStructuredResponseCards", () => ({
  CompanionStructuredResponseCards: () => <div data-testid="structured-response-cards" />,
}));

vi.mock("@/components/PermissionRequestDialog", () => ({
  PermissionRequestDialog: () => null,
}));

import { CompanionChatModal } from "./CompanionChatModal";

const renderOpenModal = () => {
  render(<CompanionChatModal open onOpenChange={vi.fn()} />);
};

const expectOpenChatWithFallbackInitial = () => {
  const modal = screen.getByTestId("companion-chat-modal");

  expect(modal).toBeInTheDocument();
  expect(within(modal).getByText("Nova")).toBeInTheDocument();
  expect(within(modal).getByText("N")).toBeInTheDocument();
};

describe("CompanionChatModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.visual.companionLabel = "Nova";
    mocks.visual.imageUrl = "/placeholder-companion.svg";
    mocks.visual.focalX = null;
    mocks.visual.focalY = null;
    mocks.visual.element = "fire";
    mocks.visual.usesPortraitShell = false;
  });

  it("wraps portrait-shell companion images in an Avatar root", () => {
    mocks.visual.imageUrl =
      "/companion-presets/phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__fire.png";
    mocks.visual.usesPortraitShell = true;

    renderOpenModal();

    expectOpenChatWithFallbackInitial();
  });

  it("wraps regular companion images in an Avatar root", () => {
    mocks.visual.imageUrl = "https://assets.example.com/generated-companion.png";
    mocks.visual.usesPortraitShell = false;

    renderOpenModal();

    expectOpenChatWithFallbackInitial();
  });

  it("renders the companion initial fallback when there is no image", () => {
    mocks.visual.imageUrl = null;

    renderOpenModal();

    expectOpenChatWithFallbackInitial();
  });
});
