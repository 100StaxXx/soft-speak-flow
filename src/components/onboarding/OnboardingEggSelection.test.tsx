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

    expect(screen.getByRole("heading", { name: /Choose Your Companion/i })).toBeInTheDocument();
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
    expect(screen.queryByText("Ice")).not.toBeInTheDocument();
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

  it("uses tuned bottom-row egg variables aligned to the painted pedestal art", () => {
    render(
      <OnboardingEggSelection
        onComplete={vi.fn()}
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
      />,
    );

    const voidSlot = screen.getByTestId("egg-slot-void");
    const stormSlot = screen.getByTestId("egg-slot-storm");
    const lightSlot = screen.getByTestId("egg-slot-light");

    expect(voidSlot.style.getPropertyValue("--egg-bottom")).toBe("21%");
    expect(voidSlot.style.getPropertyValue("--egg-offset-x")).toBe("3%");
    expect(stormSlot.style.getPropertyValue("--egg-bottom")).toBe("21%");
    expect(stormSlot.style.getPropertyValue("--egg-offset-x")).toBe("0%");
    expect(lightSlot.style.getPropertyValue("--egg-slot-y")).toBe("54.2%");
    expect(lightSlot.style.getPropertyValue("--egg-width")).toBe("61%");
    expect(lightSlot.style.getPropertyValue("--egg-bottom")).toBe("28%");
    expect(lightSlot.style.getPropertyValue("--egg-offset-x")).toBe("-3%");
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

  it("keeps every Graceward element active", () => {
    const onComplete = vi.fn();

    render(
      <OnboardingEggSelection
        onComplete={onComplete}
        storyTone="epic_adventure"
        presetId="fox"
        spiritAnimal="Kitsune"
      />,
    );

    const stormSlot = screen.getByTestId("egg-slot-storm");
    expect(stormSlot).toBeEnabled();
    expect(stormSlot).toHaveAttribute("data-supported", "true");
    expect(screen.getByTestId("egg-slot-void")).toBeEnabled();
    expect(screen.getByTestId("egg-slot-light")).toBeEnabled();
    expect(screen.getByTestId("egg-slot-nature")).toBeEnabled();
    expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Select Dawn Gold element" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: "fox",
      favoriteColor: "#FACC15",
      spiritAnimal: "Kitsune",
      coreElement: "light",
      storyTone: "epic_adventure",
      companionName: null,
    });
  });

  it("marks only the selected element and submits the provided story tone unchanged", () => {
    const onComplete = vi.fn();

    render(
      <OnboardingEggSelection
        onComplete={onComplete}
        storyTone="dark_intense"
        presetId="phoenix"
        spiritAnimal="Phoenix"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Living Green element" }));

    expect(screen.getByTestId("egg-slot-nature")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("egg-slot-fire")).toHaveAttribute("data-selected", "false");
    expect(screen.getByTestId("egg-slot-light")).toHaveAttribute("data-selected", "false");

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: "phoenix",
      favoriteColor: "#34D399",
      spiritAnimal: "Phoenix",
      coreElement: "nature",
      storyTone: "dark_intense",
      companionName: null,
    });
  });

  it("trims and forwards a custom companion name when provided", () => {
    const onComplete = vi.fn();

    render(
      <OnboardingEggSelection
        onComplete={onComplete}
        storyTone="epic_adventure"
        presetId="dragon"
        spiritAnimal="Dragon"
      />,
    );

    fireEvent.change(screen.getByLabelText("Companion Name"), {
      target: { value: "  Nova  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select Dawn Gold element" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: "dragon",
      favoriteColor: "#FACC15",
      spiritAnimal: "Dragon",
      coreElement: "light",
      storyTone: "epic_adventure",
      companionName: "Nova",
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
