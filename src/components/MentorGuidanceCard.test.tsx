import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentorGuidanceCard, resolveMentorGuidancePlacement } from "./MentorGuidanceCard";

const mocks = vi.hoisted(() => ({
  onDialogueAction: vi.fn(),
  guidance: {
    isActive: true,
    isIntroDialogueActive: false,
    currentStep: "create_quest",
    currentSubstep: "open_add_quest",
    stepRoute: "/journeys",
    mentorInstructionLines: ["Tap the + in the bottom right."],
    progressText: "Step 1 of 3 - Create Quest 2/5",
    activeTargetSelectors: ['[data-tour="add-quest-fab"]'],
    activeTargetSelector: '[data-tour="add-quest-fab"]',
    isStrictLockActive: true,
    dialogueText: "Tap the + in the bottom right.",
    dialogueSupportText: "I'll highlight it for you.",
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

describe("MentorGuidanceCard", () => {
  it("renders VN-style dialogue without tutorial control buttons", () => {
    render(<MentorGuidanceCard />);

    expect(screen.getByText("Atlas portrait")).toBeInTheDocument();
    expect(screen.getByText("Atlas")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3 - Create Quest 2/5")).toBeInTheDocument();
    expect(screen.getByText("Tap the + in the bottom right.")).toBeInTheDocument();
    expect(screen.getByText("I'll highlight it for you.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not render when guidance is inactive", () => {
    mocks.guidance.isActive = false;
    render(<MentorGuidanceCard />);
    expect(screen.queryByText("Atlas")).not.toBeInTheDocument();
    mocks.guidance.isActive = true;
  });

  it("renders intro action button and triggers callback", () => {
    mocks.guidance.isIntroDialogueActive = true;
    mocks.guidance.dialogueActionLabel = "Start Tutorial";
    mocks.guidance.onDialogueAction = mocks.onDialogueAction;

    render(<MentorGuidanceCard />);
    fireEvent.click(screen.getByRole("button", { name: "Start Tutorial" }));

    expect(mocks.onDialogueAction).toHaveBeenCalledTimes(1);

    mocks.guidance.isIntroDialogueActive = false;
    mocks.guidance.dialogueActionLabel = undefined;
    mocks.guidance.onDialogueAction = undefined;
    mocks.onDialogueAction.mockClear();
  });
});

describe("resolveMentorGuidancePlacement", () => {
  const viewportHeight = 844;
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
    });

    const rect = placedRect(placement);
    expect(rect.bottom).toBeLessThanOrEqual(mentorTabRect.top - 12);
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
    });

    const rect = placedRect(placement);
    expect(rect.bottom).toBeLessThanOrEqual(submitRect.top - 12);
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
    });

    const rect = placedRect(placement);
    expect(rect.bottom).toBeLessThanOrEqual(checkInCardRect.top - 12);
  });
});
