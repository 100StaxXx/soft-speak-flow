import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableFAB } from "./DraggableFAB";

const mocks = vi.hoisted(() => ({
  onOpenCompanionPlanner: vi.fn(),
  lastHookOptions: null as null | {
    onDragStart?: () => void;
    onDragEnd?: (position: { x: number; y: number }) => void;
  },
  draggableFabState: {
    position: { x: 216, y: 520 },
    popupAlignment: {
      horizontal: "right" as const,
      vertical: "bottom" as const,
    },
    isDragging: false,
    isLongPressing: false,
    positionStyles: {
      left: 216,
      top: 520,
      right: "auto",
      bottom: "auto",
    },
  } as {
    position: { x: number; y: number };
    popupAlignment: {
      horizontal: "left" | "right";
      vertical: "top" | "bottom";
    };
    isDragging: boolean;
    isLongPressing: boolean;
    positionStyles: {
      left: number;
      top: number;
      right: string;
      bottom: string;
    };
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useDraggableFAB", () => ({
  useDraggableFAB: (options?: {
    onDragStart?: () => void;
    onDragEnd?: (position: { x: number; y: number }) => void;
  }) => {
    mocks.lastHookOptions = options ?? null;
    return {
      ...mocks.draggableFabState,
      dragControls: {
        drag: false as const,
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
      dragOffset: { x: 0, y: 0 },
    };
  },
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
    mocks.lastHookOptions = null;
    mocks.draggableFabState = {
      position: { x: 216, y: 520 },
      popupAlignment: {
        horizontal: "right",
        vertical: "bottom",
      },
      isDragging: false,
      isLongPressing: false,
      positionStyles: {
        left: 216,
        top: 520,
        right: "auto",
        bottom: "auto",
      },
    };
  });

  it("opens the popup menu and flips the launcher to face forward", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    const launcher = screen.getByTestId("journeys-companion-launcher-floating");
    const image = screen.getByRole("img", { name: "Nova" });

    expect(launcher).toHaveClass("h-36", "w-36", "overflow-visible", "bg-transparent");
    expect(launcher.className).not.toContain("backdrop-blur-xl");
    expect(launcher.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
    expect(image.parentElement).toHaveClass("h-[7.75rem]", "w-[7.75rem]");
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

  it("does not open the popup from the click that follows a completed drag", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    act(() => {
      mocks.lastHookOptions?.onDragEnd?.({ x: 120, y: 240 });
    });

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));

    expect(screen.queryByTestId("journeys-companion-launcher-popup")).not.toBeInTheDocument();
  });

  it("reports top-left popup placement when the launcher sits in the upper-left half", () => {
    mocks.draggableFabState = {
      ...mocks.draggableFabState,
      position: { x: 16, y: 120 },
      popupAlignment: {
        horizontal: "left",
        vertical: "top",
      },
      positionStyles: {
        left: 16,
        top: 120,
        right: "auto",
        bottom: "auto",
      },
    };

    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));

    const popup = screen.getByTestId("journeys-companion-launcher-popup");
    expect(popup).toHaveAttribute("data-popup-horizontal", "left");
    expect(popup).toHaveAttribute("data-popup-vertical", "top");
  });

  it("reports bottom-right popup placement when the launcher sits in the lower-right half", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));

    const popup = screen.getByTestId("journeys-companion-launcher-popup");
    expect(popup).toHaveAttribute("data-popup-horizontal", "right");
    expect(popup).toHaveAttribute("data-popup-vertical", "bottom");
  });
});
