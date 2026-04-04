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
    render(
      <OnboardingEggSelection
        onComplete={vi.fn()}
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
      />,
    );

    expect(screen.getByRole("heading", { name: /Choose Your Element/i })).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-egg-chamber-underlay")).toHaveAttribute(
      "src",
      expect.stringContaining("choose-your-element-selection-screen-expanded.png"),
    );
    expect(screen.getByTestId("onboarding-egg-chamber-foreground")).toHaveAttribute(
      "src",
      expect.stringContaining("choose-your-element-selection-screen.png"),
    );
    expect(screen.queryByText(/Locked Species/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Dragon")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Choose the element now. Your dragon will sleep within the shell until it hatches."),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Ember")).not.toBeInTheDocument();
    expect(screen.queryByText("Frost")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("renders the floating back button only when back navigation is available", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <OnboardingEggSelection
        onComplete={vi.fn()}
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
        onBack={onBack}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    rerender(
      <OnboardingEggSelection
        onComplete={vi.fn()}
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
      />,
    );

    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("uses the tuned light egg slot variables aligned to the painted pedestal art", () => {
    render(
      <OnboardingEggSelection
        onComplete={vi.fn()}
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
      />,
    );

    const lightSlot = screen.getByTestId("egg-slot-light");

    expect(lightSlot.style.getPropertyValue("--egg-slot-y")).toBe("54.2%");
    expect(lightSlot.style.getPropertyValue("--egg-width")).toBe("61%");
    expect(lightSlot.style.getPropertyValue("--egg-bottom")).toBe("26%");
  });

  it("keeps the chamber visible and freezes controls while setup is saving", () => {
    render(
      <OnboardingEggSelection
        onComplete={vi.fn()}
        isLoading
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByTestId("onboarding-egg-chamber")).toBeInTheDocument();
    expect(screen.queryByText("Opening the hatchery...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select Ember element" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("marks only the selected element and submits the provided story tone unchanged", () => {
    const onComplete = vi.fn();

    render(
      <OnboardingEggSelection
        onComplete={onComplete}
        storyTone="dark_intense"
        presetId="wolf"
        spiritAnimal="Wolf"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Frost element" }));

    expect(screen.getByTestId("egg-slot-ice")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("egg-slot-fire")).toHaveAttribute("data-selected", "false");
    expect(screen.getByTestId("egg-slot-nature")).toHaveAttribute("data-selected", "false");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: "wolf",
      favoriteColor: "#60A5FA",
      spiritAnimal: "Wolf",
      coreElement: "ice",
      storyTone: "dark_intense",
    });
  });

  it("disables looping bounce classes when reduced motion is requested", () => {
    mocks.reducedMotion = true;

    render(
      <OnboardingEggSelection
        onComplete={vi.fn()}
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
      />,
    );

    expect(screen.getByTestId("onboarding-egg-chamber")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.getByTestId("egg-float-fire")).toHaveAttribute("data-bouncing", "false");
    expect(screen.getByTestId("egg-float-fire")).not.toHaveClass("onboarding-egg-slot__float--animated");
  });
});
