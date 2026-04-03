import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingEggSelection } from "./OnboardingEggSelection";

const mocks = vi.hoisted(() => ({
  reducedMotion: false,
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => mocks.reducedMotion,
}));

describe("OnboardingEggSelection", () => {
  beforeEach(() => {
    mocks.reducedMotion = false;
  });

  it("keeps continue disabled until a selection is made and removes the top onboarding chrome", () => {
    render(<OnboardingEggSelection onComplete={vi.fn()} storyTone="epic_adventure" />);

    expect(screen.queryByText(/Final Choice/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Choose Your Egg/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Story Tone:/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Ember")).not.toBeInTheDocument();
    expect(screen.queryByText("Frost")).not.toBeInTheDocument();
    expect(screen.queryByText("Terra")).not.toBeInTheDocument();
    expect(screen.queryByText("Void")).not.toBeInTheDocument();
    expect(screen.queryByText("Storm")).not.toBeInTheDocument();
    expect(screen.queryByText("Light")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dark & Intense/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("renders the floating back button only when back navigation is available", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <OnboardingEggSelection onComplete={vi.fn()} storyTone="epic_adventure" onBack={onBack} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender(<OnboardingEggSelection onComplete={vi.fn()} storyTone="epic_adventure" />);

    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("marks only the selected egg and submits the provided story tone unchanged", () => {
    const onComplete = vi.fn();

    render(<OnboardingEggSelection onComplete={onComplete} storyTone="dark_intense" />);

    fireEvent.click(screen.getByRole("button", { name: "Select Frost egg" }));

    expect(screen.getByTestId("egg-slot-ice")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("egg-slot-fire")).toHaveAttribute("data-selected", "false");
    expect(screen.getByTestId("egg-slot-nature")).toHaveAttribute("data-selected", "false");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: null,
      favoriteColor: "#60A5FA",
      spiritAnimal: "Egg",
      coreElement: "ice",
      storyTone: "dark_intense",
    });
  });

  it("disables looping bounce classes when reduced motion is requested", () => {
    mocks.reducedMotion = true;

    render(<OnboardingEggSelection onComplete={vi.fn()} storyTone="epic_adventure" />);

    expect(screen.getByTestId("onboarding-egg-chamber")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("egg-float-fire")).toHaveAttribute("data-bouncing", "false");
    expect(screen.getByTestId("egg-float-fire")).not.toHaveClass("onboarding-egg-slot__float--animated");
  });
});
