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

  it("renders the chamber art layers while keeping continue disabled until a selection is made", () => {
    render(<OnboardingEggSelection onComplete={vi.fn()} storyTone="epic_adventure" />);

    expect(screen.getByRole("heading", { name: /Choose Your Element/i })).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-egg-chamber-underlay")).toHaveAttribute(
      "src",
      expect.stringContaining("choose-your-element-selection-screen-expanded.png"),
    );
    expect(screen.getByTestId("onboarding-egg-chamber-foreground")).toHaveAttribute(
      "src",
      expect.stringContaining("choose-your-element-selection-screen.png"),
    );
    expect(screen.queryByText("Ember")).not.toBeInTheDocument();
    expect(screen.queryByText("Frost")).not.toBeInTheDocument();
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

  it("uses the tuned light egg slot variables aligned to the painted pedestal art", () => {
    render(<OnboardingEggSelection onComplete={vi.fn()} storyTone="epic_adventure" />);

    const lightSlot = screen.getByTestId("egg-slot-light");

    expect(lightSlot.style.getPropertyValue("--egg-slot-y")).toBe("54.2%");
    expect(lightSlot.style.getPropertyValue("--egg-width")).toBe("61%");
    expect(lightSlot.style.getPropertyValue("--egg-bottom")).toBe("22.8%");
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
