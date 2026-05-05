import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DraggableFAB } from "./DraggableFAB";
import { DRAGGABLE_FAB_STORAGE_KEY_V2 } from "@/hooks/useDraggableFAB";
import { getJourneysCompanionLauncherGreeting } from "@/shared/journeysCompanionLauncherTemplates";

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

vi.mock("@/utils/storage", () => ({
  safeLocalStorage: storage.safeLocalStorage,
}));

const mocks = vi.hoisted(() => ({
  onOpenCompanionPlanner: vi.fn(),
  launcherImageCalls: [] as Array<Record<string, unknown>>,
  visual: {
    companionId: "companion-1",
    companionLabel: "Nova",
    presetId: "dragon",
    imageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
    focalX: null,
    focalY: null,
    element: "fire",
    usesPortraitShell: true,
    isGeneratedCompanion: false,
    currentSceneImageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
    launcherAwayImageUrl: "/companion-launcher-away/dragon/dragon__launcher-away__fire.png",
    launcherAwayFocalX: null,
    launcherAwayFocalY: null,
    launcherAwayUsesPortraitShell: true,
    needsLauncherImage: false,
  } as Record<string, unknown>,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/hooks/useJourneysCompanionVisual", () => ({
  useJourneysCompanionVisual: () => mocks.visual,
}));

vi.mock("@/hooks/useCompanionLauncherImage", () => ({
  useCompanionLauncherImage: (options: Record<string, unknown>) => {
    mocks.launcherImageCalls.push(options);
    return {
      isGenerating: false,
      error: null,
    };
  },
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
    mocks.launcherImageCalls = [];
    mocks.visual = {
      companionId: "companion-1",
      companionLabel: "Nova",
      presetId: "dragon",
      imageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
      focalX: null,
      focalY: null,
      element: "fire",
      usesPortraitShell: true,
      isGeneratedCompanion: false,
      currentSceneImageUrl: "/companion-presets/dragon/t1_youth/normal/dragon__t1_youth__normal__fire.png",
      launcherAwayImageUrl: "/companion-launcher-away/dragon/dragon__launcher-away__fire.png",
      launcherAwayFocalX: null,
      launcherAwayFocalY: null,
      launcherAwayUsesPortraitShell: true,
      needsLauncherImage: false,
    };
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
    expect(launcher.style.boxShadow).toBe("");
    expect(launcher).toHaveAttribute("data-face-direction", "away");

    fireEvent.click(launcher);

    expect(screen.getByTestId("journeys-companion-launcher-popup")).toBeInTheDocument();
    expect(launcher).toHaveAttribute("data-face-direction", "front");
    expect(mocks.onOpenCompanionPlanner).not.toHaveBeenCalled();
  });

  it("requests AI launcher art while showing the current companion image", () => {
    mocks.visual = {
      companionId: "companion-ai",
      companionLabel: "Nova",
      presetId: null,
      imageUrl: "https://assets.example.com/scenic-companion.png",
      focalX: 0.4,
      focalY: 0.58,
      element: "fire",
      usesPortraitShell: false,
      isGeneratedCompanion: true,
      currentSceneImageUrl: "https://assets.example.com/scenic-companion.png",
      launcherAwayImageUrl: "https://assets.example.com/scenic-companion.png",
      launcherAwayFocalX: 0.4,
      launcherAwayFocalY: 0.58,
      launcherAwayUsesPortraitShell: true,
      needsLauncherImage: true,
    };

    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    expect(mocks.launcherImageCalls).toContainEqual({
      companionId: "companion-ai",
      sourceImageUrl: "https://assets.example.com/scenic-companion.png",
      enabled: true,
    });
    expect(screen.queryByTestId("journeys-companion-launcher-placeholder")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Nova" })).toHaveAttribute(
      "src",
      "https://assets.example.com/scenic-companion.png",
    );
  });

  it("suppresses popup open after a completed long-press drag interaction", async () => {
    vi.useFakeTimers();
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    const launcher = screen.getByTestId("journeys-companion-launcher-floating");
    const root = launcher.parentElement as HTMLElement;

    act(() => {
      fireEvent.pointerDown(root, {
        pointerId: 7,
        pointerType: "touch",
        button: 0,
        clientX: 300,
        clientY: 596,
      });
      vi.advanceTimersByTime(500);
      fireEvent.pointerMove(root, {
        pointerId: 7,
        pointerType: "touch",
        clientX: 180,
        clientY: 220,
      });
      fireEvent.pointerUp(root, {
        pointerId: 7,
        pointerType: "touch",
        clientX: 210,
        clientY: 270,
      });
    });

    fireEvent.click(launcher);

    expect(screen.queryByTestId("journeys-companion-launcher-popup")).not.toBeInTheDocument();
  });

  it("launches free talk from the popup into the conversation lane", async () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);
    const expectedGreeting = getJourneysCompanionLauncherGreeting({ userId: "user-1" });

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-option-free-talk"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "conversation",
      starterIntent: "free_talk_start",
      message: expectedGreeting,
    }));
    await waitFor(() => {
      expect(screen.getByTestId("journeys-companion-launcher-popup")).toHaveStyle("opacity: 0");
    });
  });

  it("shows a history button in the popup and routes it through a thread-history launch intent", async () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));

    expect(screen.getByTestId("journeys-companion-launcher-history-button")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-history-button"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      message: "",
      starterIntent: "thread_history",
      target: "planner",
    }));

    await waitFor(() => {
      expect(screen.getByTestId("journeys-companion-launcher-popup")).toHaveStyle("opacity: 0");
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
      expect(screen.getByTestId("journeys-companion-launcher-popup")).toHaveStyle("opacity: 0");
    });
  });

  it("routes the goal option straight to the campaign builder target and emits the tutorial event", () => {
    const newGoalStarted = vi.fn();
    window.addEventListener("companion-new-goal-started", newGoalStarted);
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-option-goal"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "campaign_builder",
      starterIntent: "goal_breakdown_start",
      message: "Let's lock in a new goal",
    }));
    expect(newGoalStarted).toHaveBeenCalledTimes(1);
    window.removeEventListener("companion-new-goal-started", newGoalStarted);
  });

  it("routes planner actions through the planner target", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    const upcomingButton = screen.getByTestId("journeys-companion-launcher-option-upcoming");
    expect(upcomingButton.className).toContain("border-[#315114]");
    fireEvent.click(upcomingButton);

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "planner",
      starterIntent: "upcoming_start",
      message: "What do I have coming up?",
    }));
  });

  it("routes the plan-day option through the planner as the exact daily planning starter", () => {
    const newGoalStarted = vi.fn();
    window.addEventListener("companion-new-goal-started", newGoalStarted);
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-option-plan-day"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "planner",
      starterIntent: "plan_day",
      message: "Plan my day",
    }));
    expect(newGoalStarted).not.toHaveBeenCalled();
    window.removeEventListener("companion-new-goal-started", newGoalStarted);
  });

  it("omits planner options that are not on the journeys launcher", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));

    expect(screen.queryByTestId("journeys-companion-launcher-option-low-energy")).not.toBeInTheDocument();
  });

  it("launches the quest option as a local quest-capture starter", () => {
    render(<DraggableFAB onOpenCompanionPlanner={mocks.onOpenCompanionPlanner} />);

    fireEvent.click(screen.getByTestId("journeys-companion-launcher-floating"));
    fireEvent.click(screen.getByTestId("journeys-companion-launcher-option-quest"));

    expect(mocks.onOpenCompanionPlanner).toHaveBeenCalledWith(expect.objectContaining({
      target: "planner",
      starterIntent: "quest_capture",
      message: "Nova's ready. What quest are we capturing?",
      briefingContext: null,
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
