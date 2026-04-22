import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assistantCounter: 0,
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

vi.mock("@/hooks/useCompanionAssistant", async () => {
  const React = await import("react");

  return {
    useCompanionAssistant: () => {
      const [assistantId] = React.useState(() => `assistant-${++mocks.assistantCounter}`);
      const [draftInput, setDraftInput] = React.useState("Keep this thread alive");
      const [messages, setMessages] = React.useState<Array<{
        id: string;
        role: "assistant" | "user";
        content: string;
        createdAt: string;
      }>>([
        {
          id: "assistant-seed",
          role: "assistant" as const,
          content: `thread:${assistantId}`,
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ]);

      return {
        todayLabel: assistantId,
        placeholder: "Talk to Cosmiq",
        messages,
        pendingAction: null,
        error: null,
        lastFailedMessage: null,
        draftInput,
        setDraftInput,
        interimText: "",
        isSubmitting: false,
        isResolvingAction: false,
        submitMessage: vi.fn(),
        submitTypedMessage: () => {
          setMessages((previous) => [
            ...previous,
            {
              id: `user-${previous.length}`,
              role: "user",
              content: draftInput,
              createdAt: "2026-04-21T10:01:00.000Z",
            },
          ]);
          setDraftInput("");
        },
        retryLastMessage: vi.fn(),
        confirmPendingAction: vi.fn(),
        cancelPendingAction: vi.fn(),
        isRecording: false,
        isAutoStopping: false,
        isVoiceSupported: false,
        permissionStatus: "granted" as const,
        showPermissionDialog: false,
        setShowPermissionDialog: vi.fn(),
        isRequestingPermission: false,
        toggleRecording: vi.fn(),
        requestMicrophonePermission: vi.fn(),
        isSpeaking: false,
        speechProvider: "none" as const,
        stopSpeaking: vi.fn(),
        activeThread: null,
        historyThreads: [],
        isLoadingThreads: false,
        hasPersistedActiveThread: false,
        canOpenThreadPicker: false,
        threadHistoryEmptyStateMessage: "",
        resumeThread: vi.fn(),
        archiveCurrentThread: vi.fn(),
        canArchiveThread: false,
        archiveDisabledReason: null,
        startNewChat: vi.fn(),
        canStartNewChat: true,
        newChatDisabledReason: null,
      };
    },
  };
});

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

import { JourneysCompanionPlannerController } from "./JourneysCompanionPlannerModal";

describe("JourneysCompanionPlannerController", () => {
  beforeEach(() => {
    mocks.assistantCounter = 0;
  });

  it("keeps the journeys assistant state alive while the modal view closes and reopens", () => {
    const { rerender } = render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("thread:assistant-1")).toBeInTheDocument();
    expect(screen.getByText("assistant-1")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-planner-send-button"));
    expect(screen.getByText("Keep this thread alive")).toBeInTheDocument();

    rerender(
      <JourneysCompanionPlannerController
        open={false}
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.queryByText("Keep this thread alive")).not.toBeInTheDocument();

    rerender(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("thread:assistant-1")).toBeInTheDocument();
    expect(screen.getByText("assistant-1")).toBeInTheDocument();
    expect(screen.getByText("Keep this thread alive")).toBeInTheDocument();
  });
});
