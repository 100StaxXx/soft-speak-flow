import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentorGuidanceCard } from "./MentorGuidanceCard";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  personality: { name: "Atlas" } as { name: string } | null,
  guidance: {
    isActive: true,
    currentStep: "create_quest",
    currentSubstep: "open_add_quest",
    stepRoute: "/journeys",
    mentorInstructionLines: ["Step 1: Tap the + button to open Add Quest."],
    progressText: "Step 1 of 3 - Create Quest 2/4",
  },
}));

vi.mock("@/hooks/useMentorPersonality", () => ({
  useMentorPersonality: () => mocks.personality,
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => mocks.guidance,
}));

describe("MentorGuidanceCard", () => {
  it("renders mentor guidance text without tutorial control buttons", () => {
    render(
      <MemoryRouter initialEntries={["/journeys"]}>
        <MentorGuidanceCard route="/journeys" />
      </MemoryRouter>
    );

    expect(screen.getByText("Atlas")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3 - Create Quest 2/4")).toBeInTheDocument();
    expect(screen.getByText("Step 1: Tap the + button to open Add Quest.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not render when route does not match active guidance step", () => {
    render(
      <MemoryRouter initialEntries={["/mentor"]}>
        <MentorGuidanceCard route="/mentor" />
      </MemoryRouter>
    );
    expect(screen.queryByText("Atlas")).not.toBeInTheDocument();
  });
});
