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
  },
  {
    id: "mentor-2",
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
});
