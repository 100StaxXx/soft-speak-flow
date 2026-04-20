import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableFAB } from "./DraggableFAB";
import { DRAGGABLE_FAB_STORAGE_KEY_V2 } from "@/hooks/useDraggableFAB";

const storage = vi.hoisted(() => {
  const values = new Map<string, string>();

  return {
    safeLocalStorage: {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
        return true;
      }),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
        return true;
      }),
      clear: vi.fn(() => {
        values.clear();
        return true;
      }),
    },
  };
});

const motion = vi.hoisted(() => ({
  dragControls: {
    start: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    cancel: vi.fn(),
  },
}));

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storage.safeLocalStorage,
}));

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useDragControls: () => motion.dragControls,
  };
});

const mocks = vi.hoisted(() => ({
  onOpenCompanionPlanner: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
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

const setViewport = ({ width, height }: { width: number; height: number }) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
};

const setSafeAreaVars = ({
  top = 0,
  right = 0,
  bottom = 0,
  left = 0,
}: {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}) => {
  document.documentElement.style.setProperty("--safe-area-inset-top", `${top}px`);
  document.documentElement.style.setProperty("--safe-area-inset-right", `${right}px`);
  document.documentElement.style.setProperty("--safe-area-inset-bottom", `${bottom}px`);
  document.documentElement.style.setProperty("--safe-area-inset-left", `${left}px`);
  document.documentElement.style.setProperty("--sat", `${top}px`);
  document.documentElement.style.setProperty("--sar", `${right}px`);
  document.documentElement.style.setProperty("--sab", `${bottom}px`);
  document.documentElement.style.setProperty("--sal", `${left}px`);
};

describe("DraggableFAB", () => {
  beforeEach(() => {
    storage.safeLocalStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    setViewport({ width: 400, height: 800 });
    setSafeAreaVars({ top: 0, right: 0, bottom: 0, left: 0 });
    document.documentElement.style.setProperty("--bottom-nav-runtime-offset", "96px");
    document.documentElement.style.setProperty("--bottom-nav-safe-offset", "96px");
  });

  it("opens the popup menu and flips the launcher to face forward on tap", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    const launcher = screen.getByTestId("journeys-companion-launcher-floating");
    const image = screen.getByRole("img", { name: "Nova" });

    expect(launcher).toHaveClass("h-36", "w-36", "overflow-visible", "bg-transparent");
    expect(launcher.className).not.toContain("backdrop-blur-xl");
    expect(launcher.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
    expect(image.parentElement).toHaveClass("h-[7.75rem]", "w-[7.75rem]");
    expect(launcher).toHaveAttribute("data-face-direction", "away");

    fireEvent.click(launcher);

    expect(screen.getByTestId("journeys-companion-launcher-popup")).toBeInTheDocument();
    expect(launcher).toHaveAttribute("data-face-direction", "front");
    expect(mocks.onOpenCompanionPlanner).not.toHaveBeenCalled();
  });

  it("starts drag controls after a long press and does not open the popup from that same press", () => {
    vi.useFakeTimers();
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    const launcher = screen.getByTestId("journeys-companion-launcher-floating");

    act(() => {
      fireEvent.pointerDown(launcher, {
        pointerId: 7,
        pointerType: "touch",
        button: 0,
        clientX: 240,
        clientY: 536,
      });
      vi.advanceTimersByTime(500);
    });

    expect(motion.dragControls.start).toHaveBeenCalledTimes(1);

    fireEvent.click(launcher);

    expect(screen.queryByTestId("journeys-companion-launcher-popup")).not.toBeInTheDocument();
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

  it("reports top-left popup placement when the launcher sits in the upper-left half", () => {
    storage.safeLocalStorage.setItem(DRAGGABLE_FAB_STORAGE_KEY_V2, JSON.stringify({ x: 16, y: 120 }));

    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));

    const popup = screen.getByTestId("journeys-companion-launcher-popup");
    expect(popup).toHaveAttribute("data-popup-horizontal", "left");
    expect(popup).toHaveAttribute("data-popup-vertical", "top");
  });

  it("reports bottom-right popup placement when the launcher sits in the lower-right half", () => {
    storage.safeLocalStorage.setItem(DRAGGABLE_FAB_STORAGE_KEY_V2, JSON.stringify({ x: 216, y: 520 }));

    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));

    const popup = screen.getByTestId("journeys-companion-launcher-popup");
    expect(popup).toHaveAttribute("data-popup-horizontal", "right");
    expect(popup).toHaveAttribute("data-popup-vertical", "bottom");
  });
});
