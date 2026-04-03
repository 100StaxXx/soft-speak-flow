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

  it("renders all six eggs and keeps continue disabled until a selection is made", () => {
    render(<OnboardingEggSelection onComplete={vi.fn()} />);

    expect(screen.getByText("Ember")).toBeInTheDocument();
    expect(screen.getByText("Frost")).toBeInTheDocument();
    expect(screen.getByText("Terra")).toBeInTheDocument();
    expect(screen.getByText("Void")).toBeInTheDocument();
    expect(screen.getByText("Storm")).toBeInTheDocument();
    expect(screen.getByText("Light")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("marks only the selected egg and submits the same onboarding payload shape", () => {
    const onComplete = vi.fn();

    render(<OnboardingEggSelection onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Select Frost egg" }));
    fireEvent.click(screen.getByRole("button", { name: /Dark & Intense/i }));

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

    render(<OnboardingEggSelection onComplete={vi.fn()} />);

    expect(screen.getByTestId("onboarding-egg-chamber")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("egg-float-fire")).toHaveAttribute("data-bouncing", "false");
    expect(screen.getByTestId("egg-float-fire")).not.toHaveClass("onboarding-egg-slot__float--animated");
  });
});
