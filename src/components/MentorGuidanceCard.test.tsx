import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentorGuidanceCard } from "./MentorGuidanceCard";

const mocks = vi.hoisted(() => ({
  guidance: {
    isActive: true,
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
});
