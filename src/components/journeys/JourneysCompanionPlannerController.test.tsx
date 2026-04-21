import type { HTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  drawerRootProps: [] as Array<Record<string, unknown>>,
  sessionCounter: 0,
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
      const [sessionId] = React.useState(() => `session-${++mocks.sessionCounter}`);
      const [draftInput, setDraftInput] = React.useState("Keep this plan alive");
      const [messages, setMessages] = React.useState<Array<{
        id: string;
        role: "assistant" | "user";
        content: string;
        createdAt: string;
        inputMode?: "text";
        source: "agent";
      }>>([
        {
          id: "assistant-seed",
          role: "assistant" as const,
          content: `thread:${sessionId}`,
          createdAt: "2026-04-18T08:01:00.000Z",
          source: "agent" as const,
        },
      ]);

      return {
        todayLabel: sessionId,
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
              createdAt: "2026-04-18T08:02:00.000Z",
              inputMode: "text" as const,
              source: "agent" as const,
            },
          ]);
          setDraftInput("");
        },
        retryLastMessage: vi.fn().mockResolvedValue(undefined),
        confirmPendingAction: vi.fn(),
        cancelPendingAction: vi.fn(),
        isRecording: false,
        isAutoStopping: false,
        isVoiceSupported: true,
        permissionStatus: "granted" as const,
        showPermissionDialog: false,
        setShowPermissionDialog: vi.fn(),
        isRequestingPermission: false,
        toggleRecording: vi.fn(),
        requestMicrophonePermission: vi.fn(),
        isSpeaking: false,
        speechProvider: "none" as const,
        stopSpeaking: vi.fn(),
        activeThread: {
          sessionId,
          companionId: "companion-1",
          surface: "journeys" as const,
          title: "Current thread",
          previewText: `thread:${sessionId}`,
          createdAt: "2026-04-18T08:00:00.000Z",
          lastMessageAt: "2026-04-18T08:01:00.000Z",
          archivedAt: null,
          messageCount: messages.length,
        },
        historyThreads: [],
        isLoadingThreads: false,
        hasPersistedActiveThread: true,
        canOpenThreadPicker: true,
        threadHistoryEmptyStateMessage: "Past chats will show up here after at least one real exchange.",
        resumeThread: vi.fn(),
        archiveCurrentThread: vi.fn().mockResolvedValue(undefined),
        canArchiveThread: true,
        archiveDisabledReason: null,
        startNewChat: vi.fn().mockResolvedValue(undefined),
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

import { JourneysCompanionPlannerController } from "./JourneysCompanionPlannerModal";

describe("JourneysCompanionPlannerController", () => {
  beforeEach(() => {
    mocks.drawerRootProps.length = 0;
    mocks.sessionCounter = 0;
  });

  it("keeps assistant state alive while the modal view closes and reopens", () => {
    const { rerender } = render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("thread:session-1")).toBeInTheDocument();
    expect(screen.getByText("session-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Keep this plan alive")).toBeInTheDocument();

    rerender(
      <JourneysCompanionPlannerController
        open={false}
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.queryByText("Keep this plan alive")).not.toBeInTheDocument();

    rerender(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("thread:session-1")).toBeInTheDocument();
    expect(screen.getByText("session-1")).toBeInTheDocument();
    expect(screen.getByText("Keep this plan alive")).toBeInTheDocument();
  });
});
