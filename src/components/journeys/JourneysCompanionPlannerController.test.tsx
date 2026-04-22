import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  surfaceCounter: 0,
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

vi.mock("@/hooks/useJourneysCompanionSurface", async () => {
  const React = await import("react");

  return {
    useJourneysCompanionSurface: () => {
      const [surfaceId] = React.useState(() => `surface-${++mocks.surfaceCounter}`);
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
          content: `thread:${surfaceId}`,
          createdAt: "2026-04-21T10:00:00.000Z",
        },
      ]);

      return {
        todayLabel: surfaceId,
        placeholder: "Talk to Cosmiq",
        messages,
        draftInput,
        setDraftInput,
        isSubmitting: false,
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
    mocks.surfaceCounter = 0;
  });

  it("keeps the simplified assistant state alive while the modal view closes and reopens", () => {
    const { rerender } = render(
      <JourneysCompanionPlannerController
        open
        onOpenChange={vi.fn()}
        presentation="dialog"
      />,
    );

    expect(screen.getByText("thread:surface-1")).toBeInTheDocument();
    expect(screen.getByText("surface-1")).toBeInTheDocument();

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

    expect(screen.getByText("thread:surface-1")).toBeInTheDocument();
    expect(screen.getByText("surface-1")).toBeInTheDocument();
    expect(screen.getByText("Keep this thread alive")).toBeInTheDocument();
  });
});
