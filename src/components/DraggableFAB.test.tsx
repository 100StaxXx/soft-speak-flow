import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableFAB } from "./DraggableFAB";

const mocks = vi.hoisted(() => ({
  onOpenCompanionPlanner: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useDraggableFAB", () => ({
  useDraggableFAB: () => ({
    position: "bottom-right" as const,
    isDragging: false,
    isLongPressing: false,
    dragControls: {
      drag: false,
      dragConstraints: { top: -500, left: -500, right: 500, bottom: 500 },
      dragElastic: 0.1,
      dragMomentum: false,
      onDragStart: vi.fn(),
      onDragEnd: vi.fn(),
    },
    longPressHandlers: {
      onPointerDown: vi.fn(),
      onPointerUp: vi.fn(),
      onPointerCancel: vi.fn(),
    },
    positionStyles: {
      right: "12px",
      bottom: "12px",
      left: "auto",
      top: "auto",
    },
    dragOffset: { x: 0, y: 0 },
  }),
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => ({
    companionLabel: "Nova",
    presetId: "dragon",
    imageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
    focalX: null,
    focalY: null,
    element: "fire",
    usesPortraitShell: true,
    launcherAwayImageUrl: "/companion-launcher-away/dragon/dragon__launcher-away__fire.png",
    launcherAwayFocalX: null,
    launcherAwayFocalY: null,
    launcherAwayUsesPortraitShell: true,
  }),
}));

describe("DraggableFAB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the popup menu and flips the launcher to face forward", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    const launcher = screen.getByTestId("journeys-companion-launcher-floating");
    expect(launcher).toHaveAttribute("data-face-direction", "away");
    expect(screen.queryByTestId("journeys-companion-launcher-popup")).not.toBeInTheDocument();

    fireEvent.click(launcher);

    expect(screen.getByTestId("journeys-companion-launcher-popup")).toBeInTheDocument();
    expect(launcher).toHaveAttribute("data-face-direction", "front");
    expect(mocks.onOpenCompanionPlanner).not.toHaveBeenCalled();
  });

  it("launches free talk from the popup into the conversation lane", async () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-option-free-talk"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "conversation",
      starterIntent: "general",
    }));
    await waitFor(() => {
      expect(screen.queryByTestId("journeys-companion-launcher-popup")).not.toBeInTheDocument();
    });
  });

  it("closes the popup on outside press", async () => {
    render(
      <div>
        <button type="button" data-testid="outside">
          outside
        </button>
        <DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />
      </div>,
    );

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    expect(screen.getByTestId("journeys-companion-launcher-popup")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId("outside"));

    await waitFor(() => {
      expect(screen.queryByTestId("journeys-companion-launcher-popup")).not.toBeInTheDocument();
    });
  });

  it("routes the goal option through the campaign-builder launch target", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-option-goal"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "campaign_builder",
      starterIntent: "goal_breakdown",
      message: "Help me break a big goal into steps.",
    }));
  });

  it("routes planner actions through the planner target", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-option-upcoming"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "planner",
      starterIntent: "plan_day",
      message: "What do I have coming up for the rest of today and tomorrow?",
    }));
  });
});
