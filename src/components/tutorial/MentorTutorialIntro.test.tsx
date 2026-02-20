import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MentorTutorialIntro } from "./MentorTutorialIntro";

const mocks = vi.hoisted(() => ({
  guidance: {
    isIntroActive: true,
    completeIntro: vi.fn(),
    speakerName: "Atlas",
  },
}));

vi.mock("@/hooks/usePostOnboardingMentorGuidance", () => ({
  usePostOnboardingMentorGuidance: () => mocks.guidance,
}));

describe("MentorTutorialIntro", () => {
  beforeEach(() => {
    mocks.guidance.completeIntro.mockClear();
    mocks.guidance.isIntroActive = true;
  });

  it("renders the first intro screen by default", () => {
    render(<MentorTutorialIntro />);

    expect(screen.getByText("Quick mentor tutorial")).toBeInTheDocument();
    expect(screen.queryByText("Follow the highlights")).not.toBeInTheDocument();
  });

  it("moves to the second screen when Next is clicked", async () => {
    render(<MentorTutorialIntro />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Follow the highlights")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Start Tutorial" })).toBeInTheDocument();
  });

  it("calls completeIntro from the Start Tutorial action", () => {
    render(<MentorTutorialIntro />);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Tutorial" }));

    expect(mocks.guidance.completeIntro).toHaveBeenCalledTimes(1);
  });

  it("calls completeIntro from Skip controls", () => {
    render(<MentorTutorialIntro />);

    fireEvent.click(screen.getByRole("button", { name: "Skip tutorial intro" }));

    expect(mocks.guidance.completeIntro).toHaveBeenCalledTimes(1);
  });
});
