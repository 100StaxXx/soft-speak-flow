import type { CSSProperties, ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    confirmPendingAction: vi.fn(),
    cancelPendingAction: vi.fn(),
    setDraftInput: vi.fn(),
    toggleRecording: vi.fn(),
    stopSpeaking: vi.fn(),
    setShowPermissionDialog: vi.fn(),
    requestMicrophonePermission: vi.fn(),
  },
  drawerRootProps: [] as Array<Record<string, unknown>>,
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
    isSubmitting: false,
    isOpeningThread: false,
    isResolvingAction: false,
    isRecording: false,
    isAutoStopping: false,
    isVoiceSupported: true,
    isSpeaking: false,
    isLoadingThreads: false,
    canSubmitMessage: true,
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
    confirmPendingAction: mocks.assistant.confirmPendingAction,
    cancelPendingAction: mocks.assistant.cancelPendingAction,
    setDraftInput: mocks.assistant.setDraftInput,
    toggleRecording: mocks.assistant.toggleRecording,
    stopSpeaking: mocks.assistant.stopSpeaking,
    setShowPermissionDialog: mocks.assistant.setShowPermissionDialog,
    requestMicrophonePermission: mocks.assistant.requestMicrophonePermission,
  }),
}));

vi.mock("@/hooks/usePlannerPathfinderAppearance", () => ({
  usePlannerPathfinderAppearance: () => ({
    themeMode: "light",
    setThemeMode: vi.fn(),
    themeModeClassName: "[--background:202_100%_98%]",
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
    style,
    ...props
  }: {
    children: ReactNode;
    className?: string;
    style?: CSSProperties;
  } & Record<string, unknown>) => (
    <div className={className} style={style} {...props}>
      {children}
    </div>
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

const renderOpenModal = (
  props: Partial<{
    onOpenChange: (open: boolean) => void;
    layoutMode: "desktop" | "mobile";
  }> = {},
) => {
  render(
    <CompanionChatModal
      open
      onOpenChange={props.onOpenChange ?? vi.fn()}
      layoutMode={props.layoutMode}
    />,
  );
};

const expectOpenChatWithFallbackInitial = () => {
  const modal = screen.getByTestId("companion-chat-modal");

  expect(modal).toBeInTheDocument();
  expect(within(modal).getByText("Nova")).toBeInTheDocument();
  expect(within(modal).getByText("N")).toBeInTheDocument();
};

describe("CompanionChatModal", () => {
  const originalInnerHeight = window.innerHeight;
  const originalVisualViewport = window.visualViewport;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.drawerRootProps.length = 0;
    mocks.visual.companionLabel = "Nova";
    mocks.visual.imageUrl = "/placeholder-companion.svg";
    mocks.visual.focalX = null;
    mocks.visual.focalY = null;
    mocks.visual.element = "fire";
    mocks.visual.usesPortraitShell = false;

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 852,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 852,
        offsetTop: 0,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: originalVisualViewport,
    });
  });

  it("wraps portrait-shell companion images in an Avatar root", () => {
    mocks.visual.imageUrl =
      "/companion-presets/phoenix/t2_guardian/normal/phoenix__t2_guardian__normal__fire.png";
    mocks.visual.usesPortraitShell = true;

    renderOpenModal();

    expectOpenChatWithFallbackInitial();
  });

  it("fills regular companion images in the Avatar root", () => {
    mocks.visual.imageUrl = "https://assets.example.com/generated-companion.png";
    mocks.visual.usesPortraitShell = false;

    renderOpenModal();

    expectOpenChatWithFallbackInitial();
    expect(screen.getByRole("img", { name: "Nova" })).toHaveAttribute(
      "data-companion-image-fit",
      "cover",
    );
  });

  it("renders the companion initial fallback when there is no image", () => {
    mocks.visual.imageUrl = null;

    renderOpenModal();

    expectOpenChatWithFallbackInitial();
  });

  it("uses the shared frosted blue Pathfinder shell styling", () => {
    renderOpenModal();

    const modal = screen.getByTestId("companion-chat-modal");

    expect(modal.className).toContain("[--background:202_100%_98%]");
    expect(modal.className).toContain("border-[hsl(var(--celestial-blue)_/_0.58)]");
  });

  it("disables Vaul input repositioning for the mobile drawer", () => {
    renderOpenModal();

    expect(mocks.drawerRootProps[0]).toMatchObject({
      open: true,
      repositionInputs: false,
      handleOnly: true,
    });
  });

  it("keeps the mobile drawer flush and near 78dvh when no keyboard inset is present", () => {
    renderOpenModal();

    expect(screen.getByTestId("companion-chat-drawer-content")).toHaveStyle({
      bottom: "0px",
    });
    expect(screen.getByTestId("companion-chat-modal")).toHaveStyle({
      height: "665px",
    });
  });

  it("anchors and shrinks the mobile drawer to the visible viewport when the keyboard opens", () => {
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

    renderOpenModal();

    expect(screen.getByTestId("companion-chat-drawer-content")).toHaveStyle({
      bottom: "352px",
    });
    expect(screen.getByTestId("companion-chat-modal")).toHaveStyle({
      height: "454px",
    });
  });

  it("adds mobile safe-area padding and disables drawer dragging inside the chat well", () => {
    renderOpenModal();

    expect(screen.getByTestId("companion-chat-footer")).toHaveClass(
      "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
      "sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
    );
    expect(screen.getByTestId("companion-chat-dialogue-screen")).toHaveAttribute(
      "data-vaul-no-drag",
      "true",
    );
    expect(
      screen
        .getByTestId("companion-chat-text-input")
        .closest("[data-vaul-no-drag]"),
    ).not.toBeNull();
  });

});
