import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentorGrid } from "./MentorGrid";

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: ({ mentorName }: { mentorName: string }) => (
    <div data-testid={`mentor-avatar-${mentorName.toLowerCase()}`} />
  ),
}));

const mentors = [
  {
    id: "mentor-1",
    name: "The Sage",
    slug: "sage",
    archetype: "coach",
    short_title: "Quiet Clarity",
    tone_description: "Calm and clear",
    style_description: "Calm and clear",
    target_user: "Focused builders",
    signature_line: "Build the system, then trust it.",
    primary_color: "#7B68EE",
    themes: ["discipline", "clarity"],
    availability: "active" as const,
  },
  {
    id: "mentor-2",
    name: "Lyra",
    slug: "lyra",
    archetype: "synthetic oracle",
    short_title: "Synthetic Oracle",
    tone_description: "Elegant and futuristic",
    style_description: "Elegant and futuristic",
    target_user: "Builders seeking signal",
    signature_line: "The pattern is already there.",
    primary_color: "#A855F7",
    themes: ["signal", "clarity"],
    availability: "active" as const,
  },
  {
    id: "mentor-3",
    name: "The Princess",
    slug: "princess",
    archetype: "healer",
    short_title: "Soft Discipline",
    tone_description: "Warm and steady",
    style_description: "Warm and steady",
    target_user: "Tender-hearted seekers",
    signature_line: "We begin by breathing.",
    primary_color: "#F97316",
    themes: ["healing", "calm"],
    availability: "active" as const,
  },
  {
    id: "upcoming-the-guy",
    name: "The Guy",
    slug: "the-guy",
    archetype: "field commander",
    short_title: "Field Commander",
    tone_description: "Direct, tactical, and battle-tested",
    style_description: "He cuts straight to the mission and pushes for clean execution.",
    target_user: "People who want toughness, structure, and resolve.",
    signature_line: "You do not need perfect conditions. You need a plan and the will to execute it.",
    primary_color: "#C26B3C",
    themes: ["discipline", "mission"],
    availability: "upcoming_unlockable" as const,
    unavailable_label: "Upcoming Unlockable",
    unavailable_description: "The Guy is visible in the mentor lineup, but he is not available to use yet.",
  },
];

describe("MentorGrid", () => {
  it("keeps the default appearance outside onboarding", () => {
    render(
      <MentorGrid
        mentors={mentors}
        onSelectMentor={vi.fn()}
        recommendedMentorId="mentor-1"
      />,
    );

    expect(screen.getByTestId("mentor-grid-root")).toHaveAttribute("data-appearance", "default");
    expect(screen.getByText("The Sage")).toBeInTheDocument();
    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });

  it("shows the onboarding preview treatment when appearance is onboarding", () => {
    render(
      <MentorGrid
        mentors={mentors}
        onSelectMentor={vi.fn()}
        appearance="onboarding"
      />,
    );

    expect(screen.getByTestId("mentor-grid-root")).toHaveAttribute("data-appearance", "onboarding");
    fireEvent.click(screen.getByText("The Sage"));
    expect(screen.getByText("Guide Preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose the sage/i })).toBeInTheDocument();
  });

  it("opens active mentors in preview mode and allows selection", () => {
    const onSelectMentor = vi.fn();

    render(
      <MentorGrid
        mentors={mentors}
        onSelectMentor={onSelectMentor}
      />,
    );

    fireEvent.click(screen.getByText("Lyra"));

    expect(screen.getByText("Builders seeking signal")).toBeInTheDocument();

    const chooseButton = screen.getByRole("button", { name: /choose lyra/i });
    expect(chooseButton).toBeEnabled();

    fireEvent.click(chooseButton);
    expect(onSelectMentor).toHaveBeenCalledWith("mentor-2");
  });

  it("opens upcoming mentors in preview mode without allowing selection", () => {
    const onSelectMentor = vi.fn();

    render(
      <MentorGrid
        mentors={mentors}
        onSelectMentor={onSelectMentor}
      />,
    );

    fireEvent.click(screen.getByText("The Guy"));

    expect(
      screen.getByText("The Guy is visible in the mentor lineup, but he is not available to use yet."),
    ).toBeInTheDocument();

    const lockedButton = screen.getByRole("button", { name: "Upcoming Unlockable" });
    expect(lockedButton).toBeDisabled();

    fireEvent.click(lockedButton);
    expect(onSelectMentor).not.toHaveBeenCalled();
  });
});
