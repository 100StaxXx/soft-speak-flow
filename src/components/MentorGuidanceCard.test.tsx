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
    currentStep: "create_campaign",
    currentSubstep: null,
    stepRoute: "/journeys",
    mentorInstructionLines: ["Choose New goal."],
    progressText: "Step 3 of 4",
    activeTargetSelectors: ['[data-tour="companion-launcher-option-goal"]'],
    activeTargetSelector: '[data-tour="companion-launcher-option-goal"]',
    isStrictLockActive: true,
    canTemporarilyHide: false,
    dialogueText: "Choose New goal.",
    dialogueSupportText: "I'll highlight it for you.",
    secondaryActionLabel: "Skip tutorial",
    onSecondaryAction: vi.fn(),
    dialogueActionLabel: undefined,
    onDialogueAction: undefined,
    speakerName: "Atlas",
    speakerSlug: "atlas",
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

    expect(screen.getByText("Atlas portrait")).toBeInTheDocument();
    expect(screen.getByText("Atlas")).toBeInTheDocument();
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    expect(screen.getByText("Choose New goal.")).toBeInTheDocument();
    expect(screen.getByText("I'll highlight it for you.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip tutorial" })).toBeInTheDocument();
  });

  it("uses a centered compact mobile width for the floating panel", () => {
    const { container } = render(<MentorGuidanceCard />);

    const panel = container.querySelector('[data-tutorial="mentor-dialogue-panel"] > div');
    expect(panel).toHaveClass("mx-auto", "w-full", "max-w-[22rem]", "sm:max-w-4xl");
  });

  it("places the panel against the visible duplicate target", async () => {
    document.body.innerHTML = `
      <button data-tour="companion-launcher-option-goal" data-kind="hidden" style="display:none">hidden</button>
      <button data-tour="companion-launcher-option-goal" data-kind="visible">visible</button>
    `;
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const element = this as HTMLElement;
      if (element.dataset.tutorial === "mentor-dialogue-panel") {
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
      expect(wrapper).toHaveStyle({ bottom: "166px" });
    });

    rectSpy.mockRestore();
  });

  it("does not render when guidance is inactive", () => {
    mocks.guidance.isActive = false;
    render(<MentorGuidanceCard />);
    expect(screen.queryByText("Atlas")).not.toBeInTheDocument();
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

    expect(screen.queryByText("Atlas portrait")).not.toBeInTheDocument();

    mocks.guidance.canTemporarilyHide = false;
  });

  it("restores the panel after temporary hiding is no longer allowed", () => {
    mocks.guidance.canTemporarilyHide = true;
    const { rerender } = render(<MentorGuidanceCard />);

    fireEvent.click(screen.getByRole("button", { name: "Hide tutorial" }));
    expect(screen.queryByText("Atlas portrait")).not.toBeInTheDocument();

    mocks.guidance.canTemporarilyHide = false;
    rerender(<MentorGuidanceCard />);

    expect(screen.getByText("Atlas portrait")).toBeInTheDocument();
    expect(screen.getByText("Choose New goal.")).toBeInTheDocument();
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
    if (placement.anchor === "top") {
      return {
        top: placement.topPx,
        bottom: placement.topPx + baseRect.height,
      };
    }

    const top = viewportHeight - placement.bottomPx - baseRect.height;
    return {
      top,
      bottom: top + baseRect.height,
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

    expect(placement.anchor).toBe("top");
    if (placement.anchor === "top") {
      expect(placement.topPx).toBe(minTopPx);
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
      if (element.dataset.tutorial === "mentor-dialogue-panel") {
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
      if (element.dataset.tutorial === "mentor-dialogue-panel") {
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
      if (element.dataset.tutorial === "mentor-dialogue-panel") {
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
