import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MentorGuidanceCard,
  resolveMentorGuidanceBottomInsetPx,
  resolveMentorGuidanceMinTopPx,
  resolveMentorGuidancePlacement,
} from "./MentorGuidanceCard";

const mocks = vi.hoisted(() => ({
  onDialogueAction: vi.fn(),
  onSecondaryAction: vi.fn(),
  guidance: {
    isActive: true,
    isIntroDialogueActive: false,
    currentStep: "plan_my_day",
    currentSubstep: null,
    stepRoute: "/journeys",
    mentorInstructionLines: ["Tap 'Plan day.'"],
    progressText: "Step 2 of 3",
    activeTargetSelectors: ['[data-tour="companion-launcher-option-plan-day"]'],
    activeTargetSelector: '[data-tour="companion-launcher-option-plan-day"]',
    isStrictLockActive: true,
    canTemporarilyHide: false,
    dialogueText: "Tap 'Plan day.'",
    dialogueSupportText: "It'll give you something simple to follow.",
    secondaryActionLabel: "Skip tutorial",
    onSecondaryAction: vi.fn(),
    dialogueActionLabel: undefined,
    onDialogueAction: undefined,
    speakerName: "Sage",
    speakerSlug: "sage",
    speakerAvatarUrl: "",
  },
}));

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: ({ mentorName }: { mentorName: string }) => <div>{mentorName} portrait</div>,
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => mocks.guidance,
}));

const rect = ({
  top,
  left,
  width,
  height,
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}) =>
  ({
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

describe("MentorGuidanceCard", () => {
  it("renders VN-style dialogue with a skip control once the tutorial is in progress", () => {
    render(<MentorGuidanceCard />);

    expect(screen.getByText("Sage portrait")).toBeInTheDocument();
    expect(screen.getByText("Sage")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Tap 'Plan day.'")).toBeInTheDocument();
    expect(screen.getByText("It'll give you something simple to follow.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip tutorial" })).toBeInTheDocument();
  });

  it("uses a centered compact mobile width for the floating panel", () => {
    const { container } = render(<MentorGuidanceCard />);

    const panel = container.querySelector('[data-tutorial="mentor-dialogue-panel"] > div');
    expect(panel).toHaveClass("mx-auto", "w-full", "max-w-[22rem]", "sm:max-w-4xl");
  });

  it("places the panel against the visible duplicate target", async () => {
    document.body.innerHTML = `
      <button data-tour="companion-launcher-option-plan-day" data-kind="hidden" style="display:none">hidden</button>
      <button data-tour="companion-launcher-option-plan-day" data-kind="visible">visible</button>
    `;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      if (element.dataset.tutorial === "mentor-dialogue-panel" || element.dataset.testid === "mentor-guidance-card-panel") {
        return rect({ top: 620, left: 0, width: 390, height: 224 });
      }
      if (element.dataset.kind === "hidden") {
        return rect({ top: 300, left: 30, width: 330, height: 58 });
      }
      if (element.dataset.kind === "visible") {
        return rect({ top: 690, left: 30, width: 330, height: 58 });
      }
      return rect({ top: 0, left: 0, width: 0, height: 0 });
    });

    const { container } = render(<MentorGuidanceCard />);

    const wrapper = container.querySelector('[data-tutorial="mentor-dialogue-panel"]');
    await waitFor(() => {
      expect(wrapper).toHaveAttribute("data-placement", "floating");
      expect(wrapper).toHaveStyle({ top: "454px" });
    });

    rectSpy.mockRestore();
  });

  it("constrains the compact dock to the measured nonblocking height", async () => {
    document.body.innerHTML = `
      <button data-tour="companion-launcher-option-plan-day">plan</button>
      <div data-tutorial-avoid="true">right rail</div>
    `;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      if (element.dataset.tutorial === "mentor-dialogue-panel" || element.dataset.testid === "mentor-guidance-card-panel") {
        return rect({ top: 620, left: 0, width: 390, height: 224 });
      }
      if (element.dataset.tour === "companion-launcher-option-plan-day") {
        return rect({ top: 700, left: 24, width: 180, height: 48 });
      }
      if (element.dataset.tutorialAvoid === "true") {
        return rect({ top: 64, left: 350, width: 40, height: 768 });
      }
      return rect({ top: 0, left: 0, width: 0, height: 0 });
    });

    const { container } = render(<MentorGuidanceCard />);

    const wrapper = container.querySelector('[data-tutorial="mentor-dialogue-panel"]');
    const panel = container.querySelector('[data-testid="mentor-guidance-card-panel"]');
    await waitFor(() => {
      expect(wrapper).toHaveAttribute("data-compact", "true");
      expect(wrapper).toHaveStyle({ height: "104px" });
      expect(panel).toHaveClass("h-full", "overflow-hidden");
    });
    expect(screen.queryByRole("button", { name: "Skip tutorial" })).not.toBeInTheDocument();

    rectSpy.mockRestore();
  });

  it("does not render when guidance is inactive", () => {
    mocks.guidance.isActive = false;
    render(<MentorGuidanceCard />);
    expect(screen.queryByText("Sage")).not.toBeInTheDocument();
    mocks.guidance.isActive = true;
  });

  it("renders intro action button and triggers callback", () => {
    mocks.guidance.isIntroDialogueActive = true;
    mocks.guidance.secondaryActionLabel = undefined;
    mocks.guidance.onSecondaryAction = undefined;
    mocks.guidance.dialogueActionLabel = "Start Tutorial";
    mocks.guidance.onDialogueAction = mocks.onDialogueAction;

    render(<MentorGuidanceCard />);
    fireEvent.click(screen.getByRole("button", { name: "Start Tutorial" }));

    expect(mocks.onDialogueAction).toHaveBeenCalledTimes(1);

    mocks.guidance.isIntroDialogueActive = false;
    mocks.guidance.secondaryActionLabel = "Skip tutorial";
    mocks.guidance.onSecondaryAction = mocks.onSecondaryAction;
    mocks.guidance.dialogueActionLabel = undefined;
    mocks.guidance.onDialogueAction = undefined;
    mocks.onDialogueAction.mockClear();
  });

  it("renders skip action for in-progress tutorial milestones", () => {
    mocks.guidance.secondaryActionLabel = "Skip tutorial";
    mocks.guidance.onSecondaryAction = mocks.onSecondaryAction;

    render(<MentorGuidanceCard />);
    fireEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));

    expect(mocks.onSecondaryAction).toHaveBeenCalledTimes(1);

    mocks.onSecondaryAction.mockClear();
  });

  it("renders a complete tutorial action on the final closeout step", () => {
    mocks.guidance.secondaryActionLabel = "Complete tutorial";
    mocks.guidance.onSecondaryAction = mocks.onSecondaryAction;

    render(<MentorGuidanceCard />);

    expect(screen.getByRole("button", { name: "Complete tutorial" })).toBeInTheDocument();

    mocks.guidance.secondaryActionLabel = "Skip tutorial";
  });

  it("renders continue action for non-intro explainer milestones", () => {
    mocks.guidance.isIntroDialogueActive = false;
    mocks.guidance.dialogueActionLabel = "Continue";
    mocks.guidance.onDialogueAction = mocks.onDialogueAction;

    render(<MentorGuidanceCard />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(mocks.onDialogueAction).toHaveBeenCalledTimes(1);

    mocks.guidance.dialogueActionLabel = undefined;
    mocks.guidance.onDialogueAction = undefined;
    mocks.onDialogueAction.mockClear();
  });

  it("renders hide tutorial control only when temporary hiding is allowed", () => {
    const { rerender } = render(<MentorGuidanceCard />);

    expect(screen.queryByRole("button", { name: "Hide tutorial" })).not.toBeInTheDocument();

    mocks.guidance.canTemporarilyHide = true;
    rerender(<MentorGuidanceCard />);

    expect(screen.getByRole("button", { name: "Hide tutorial" })).toBeInTheDocument();

    mocks.guidance.canTemporarilyHide = false;
  });

  it("hides the panel after tapping hide tutorial", () => {
    mocks.guidance.canTemporarilyHide = true;

    render(<MentorGuidanceCard />);
    fireEvent.click(screen.getByRole("button", { name: "Hide tutorial" }));

    expect(screen.queryByText("Sage portrait")).not.toBeInTheDocument();

    mocks.guidance.canTemporarilyHide = false;
  });

  it("restores the panel after temporary hiding is no longer allowed", () => {
    mocks.guidance.canTemporarilyHide = true;
    const { rerender } = render(<MentorGuidanceCard />);

    fireEvent.click(screen.getByRole("button", { name: "Hide tutorial" }));
    expect(screen.queryByText("Sage portrait")).not.toBeInTheDocument();

    mocks.guidance.canTemporarilyHide = false;
    rerender(<MentorGuidanceCard />);

    expect(screen.getByText("Sage portrait")).toBeInTheDocument();
    expect(screen.getByText("Tap 'Plan day.'")).toBeInTheDocument();
  });
});

describe("resolveMentorGuidancePlacement", () => {
  const viewportHeight = 844;
  const minTopPx = 64;
  const panelRect = {
    top: 620,
    right: 390,
    bottom: 844,
    left: 0,
    width: 390,
    height: 224,
  };

  const placedRect = (
    placement: ReturnType<typeof resolveMentorGuidancePlacement>,
    baseRect = panelRect
  ) => {
    if (placement.anchor === "floating") {
      return {
        top: placement.topPx,
        bottom: placement.topPx + (placement.heightPx ?? baseRect.height),
        left: placement.leftPx,
        right: placement.leftPx + placement.widthPx,
      };
    }
    if (placement.anchor === "top") {
      return {
        top: placement.topPx,
        bottom: placement.topPx + baseRect.height,
        left: baseRect.left,
        right: baseRect.right,
      };
    }

    const top = viewportHeight - placement.bottomPx - baseRect.height;
    return {
      top,
      bottom: top + baseRect.height,
      left: baseRect.left,
      right: baseRect.right,
    };
  };

  it("repositions to avoid bottom-nav mentor tab overlap", () => {
    const mentorTabRect = {
      top: 758,
      right: 88,
      bottom: 834,
      left: 8,
      width: 80,
      height: 76,
    };

    const placement = resolveMentorGuidancePlacement({
      panelRect,
      targetRect: mentorTabRect,
      viewportHeight,
      minTopPx,
    });

    const rect = placedRect(placement);
    expect(rect.bottom).toBeLessThanOrEqual(mentorTabRect.top - 12);
    expect(rect.top).toBeGreaterThanOrEqual(minTopPx);
  });

  it("repositions to avoid morning check-in submit button overlap", () => {
    const submitRect = {
      top: 690,
      right: 360,
      bottom: 748,
      left: 30,
      width: 330,
      height: 58,
    };

    const placement = resolveMentorGuidancePlacement({
      panelRect,
      targetRect: submitRect,
      viewportHeight,
      minTopPx,
    });

    const rect = placedRect(placement);
    expect(rect.bottom).toBeLessThanOrEqual(submitRect.top - 12);
    expect(rect.top).toBeGreaterThanOrEqual(minTopPx);
  });

  it("repositions to avoid morning check-in card overlap", () => {
    const checkInCardRect = {
      top: 530,
      right: 372,
      bottom: 760,
      left: 18,
      width: 354,
      height: 230,
    };

    const placement = resolveMentorGuidancePlacement({
      panelRect,
      targetRect: checkInCardRect,
      viewportHeight,
      minTopPx,
    });

    const rect = placedRect(placement);
    expect(rect.bottom).toBeLessThanOrEqual(checkInCardRect.top - 12);
    expect(rect.top).toBeGreaterThanOrEqual(minTopPx);
  });

  it("uses minTopPx when top fallback is the selected non-overlapping candidate", () => {
    const topOnlyPanelRect = {
      top: 0,
      right: 390,
      bottom: 120,
      left: 0,
      width: 390,
      height: 120,
    };
    const topTargetRect = {
      top: 10,
      right: 180,
      bottom: 52,
      left: 24,
      width: 156,
      height: 42,
    };

    const placement = resolveMentorGuidancePlacement({
      panelRect: topOnlyPanelRect,
      targetRect: topTargetRect,
      viewportHeight,
      baseBottomPx: 760,
      minTopPx,
    });

    const rect = placedRect(placement, topOnlyPanelRect);
    expect(rect.top).toBe(minTopPx);
    expect(rect.top - topTargetRect.bottom).toBeGreaterThanOrEqual(12);
  });

  it("avoids every active target and tutorial avoid rectangle before choosing placement", () => {
    const activeTargetRect = {
      top: 690,
      right: 360,
      bottom: 748,
      left: 30,
      width: 330,
      height: 58,
    };
    const avoidFooterRect = {
      top: 430,
      right: 390,
      bottom: 690,
      left: 0,
      width: 390,
      height: 260,
    };

    const placement = resolveMentorGuidancePlacement({
      panelRect,
      targetRect: activeTargetRect,
      avoidRects: [avoidFooterRect],
      viewportHeight,
      viewportWidth: 390,
      minTopPx,
    });

    const rect = placedRect(placement);
    expect(rect.bottom <= avoidFooterRect.top - 12 || rect.top >= activeTargetRect.bottom + 12).toBe(true);
  });

  it("collapses to a compact dock when no full placement is clear", () => {
    const fullWidthAvoidRect = {
      top: 52,
      right: 390,
      bottom: 844,
      left: 0,
      width: 390,
      height: 792,
    };

    const placement = resolveMentorGuidancePlacement({
      panelRect,
      targetRect: fullWidthAvoidRect,
      avoidRects: [fullWidthAvoidRect],
      viewportHeight,
      viewportWidth: 390,
      minTopPx,
    });

    expect(placement.anchor).toBe("floating");
    if (placement.anchor === "floating") {
      expect(placement.compact).toBe(true);
      expect(placement.widthPx).toBeLessThanOrEqual(320);
      expect(placement.heightPx).toBeLessThanOrEqual(104);
    }
  });
});

describe("resolveMentorGuidanceBottomInsetPx", () => {
  it("returns the panel height when bottom-anchored within the cap", () => {
    expect(
      resolveMentorGuidanceBottomInsetPx({
        panelHeight: 224,
        viewportHeight: 844,
        anchor: "bottom",
      })
    ).toBe(224);
  });

  it("caps the inset at 40% of the viewport height for tall panels", () => {
    expect(
      resolveMentorGuidanceBottomInsetPx({
        panelHeight: 600,
        viewportHeight: 844,
        anchor: "bottom",
      })
    ).toBeCloseTo(844 * 0.4);
  });

  it("returns 0 when top-anchored", () => {
    expect(
      resolveMentorGuidanceBottomInsetPx({
        panelHeight: 224,
        viewportHeight: 844,
        anchor: "top",
      })
    ).toBe(0);
  });

  it("returns 0 for non-positive heights", () => {
    expect(
      resolveMentorGuidanceBottomInsetPx({
        panelHeight: 0,
        viewportHeight: 844,
        anchor: "bottom",
      })
    ).toBe(0);
  });
});

describe("MentorGuidanceCard CSS var", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--mentor-guidance-bottom-inset");
    mocks.guidance.canTemporarilyHide = false;
    mocks.guidance.isActive = true;
  });

  it("writes the bottom inset variable while bottom-anchored", async () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      if (element.dataset.tutorial === "mentor-dialogue-panel" || element.dataset.testid === "mentor-guidance-card-panel") {
        return rect({ top: 620, left: 0, width: 390, height: 224 });
      }
      return rect({ top: 0, left: 0, width: 0, height: 0 });
    });

    render(<MentorGuidanceCard />);

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--mentor-guidance-bottom-inset")
      ).toBe("224px");
    });

    rectSpy.mockRestore();
  });

  it("resets the bottom inset variable when the panel unmounts", async () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      if (element.dataset.tutorial === "mentor-dialogue-panel" || element.dataset.testid === "mentor-guidance-card-panel") {
        return rect({ top: 620, left: 0, width: 390, height: 224 });
      }
      return rect({ top: 0, left: 0, width: 0, height: 0 });
    });

    const { unmount } = render(<MentorGuidanceCard />);
    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--mentor-guidance-bottom-inset")
      ).toBe("224px");
    });

    unmount();

    expect(
      document.documentElement.style.getPropertyValue("--mentor-guidance-bottom-inset")
    ).toBe("0px");

    rectSpy.mockRestore();
  });

  it("resets the bottom inset variable when the panel is temporarily hidden", async () => {
    mocks.guidance.canTemporarilyHide = true;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      if (element.dataset.tutorial === "mentor-dialogue-panel" || element.dataset.testid === "mentor-guidance-card-panel") {
        return rect({ top: 620, left: 0, width: 390, height: 224 });
      }
      return rect({ top: 0, left: 0, width: 0, height: 0 });
    });

    render(<MentorGuidanceCard />);
    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--mentor-guidance-bottom-inset")
      ).toBe("224px");
    });

    fireEvent.click(screen.getByRole("button", { name: "Hide tutorial" }));

    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue("--mentor-guidance-bottom-inset")
      ).toBe("0px");
    });

    rectSpy.mockRestore();
  });
});

describe("resolveMentorGuidanceMinTopPx", () => {
  it("adds safe area inset, base top margin, and iOS breathing room buffer", () => {
    expect(resolveMentorGuidanceMinTopPx({ safeAreaInsetTopPx: 47 })).toBe(67);
  });

  it("supports custom margins and clamps negative values to zero", () => {
    expect(
      resolveMentorGuidanceMinTopPx({
        safeAreaInsetTopPx: -10,
        topMarginPx: 6,
        topSafeBufferPx: 4,
      })
    ).toBe(0);
  });
});
