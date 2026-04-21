import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MentorResult } from "./MentorResult";

vi.mock("@/components/MentorAvatar", () => ({
  MentorAvatar: ({ mentorName }: { mentorName: string }) => (
    <div data-testid={`mentor-avatar-${mentorName.toLowerCase()}`} />
  ),
}));

const baseProps = {
  mentor: {
    id: "mentor-1",
    slug: "sage",
    name: "The Sage",
    short_title: "Quiet Clarity",
    primary_color: "#7B68EE",
  },
  explanation: {
    title: "Your Guide is: The Sage",
    subtitle: "Quiet Clarity",
    paragraph: "A focused guide for disciplined builders.",
    bullets: ["Build clear systems.", "Stay grounded under pressure."],
  },
  onConfirm: vi.fn(),
  onSeeAll: vi.fn(),
};

describe("MentorResult", () => {
  it("keeps the default mentor result presentation outside onboarding", () => {
    render(<MentorResult {...baseProps} />);

    expect(screen.getByTestId("mentor-result-root")).toHaveAttribute("data-appearance", "default");
    expect(screen.getByText("We've Found Your Guide")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose the sage as my guide/i })).toBeInTheDocument();
  }, 10000);

  it("renders the onboarding appearance when requested", () => {
    render(<MentorResult {...baseProps} appearance="onboarding" />);

    expect(screen.getByTestId("mentor-result-root")).toHaveAttribute("data-appearance", "onboarding");
    expect(screen.queryByText("We've Found Your Guide")).not.toBeInTheDocument();
    expect(screen.getByText(/guide found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with the sage/i })).toBeInTheDocument();
  });
});
