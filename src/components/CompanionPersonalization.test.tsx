import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COMPANION_PRESETS } from "@/config/companionCatalog";
import { CompanionPersonalization } from "./CompanionPersonalization";

const getVisibleSpeciesOrder = () => {
  const speciesNames = COMPANION_PRESETS.map((preset) => preset.displayName);

  return screen
    .getAllByRole("button")
    .map((button) => button.textContent ?? "")
    .flatMap((text) => speciesNames.filter((name) => text.includes(name)))
    .filter((name, index, values) => values.indexOf(name) === index);
};

describe("CompanionPersonalization", () => {
  it("keeps contained egg art centered while preserving manifest metadata", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="onboarding"
        layout="compact"
      />,
    );

    const eggImage = screen.getAllByRole("img", { name: "Ember Egg" }).find((image) =>
      image.getAttribute("data-companion-image-fit") === "contain"
      && image.getAttribute("data-companion-image-focal-source") === "manifest"
      && image.getAttribute("data-companion-image-asset-key") === "companion-eggs/v2/egg__t0_egg__normal__fire.webp"
    );

    expect(eggImage).toBeDefined();
    expect(eggImage!.style.transform).toBe("");
  });

  it("allows every egg element during onboarding mode without status labels", () => {
    const onComplete = vi.fn();

    render(
      <CompanionPersonalization
        onComplete={onComplete}
        mode="onboarding"
        layout="compact"
      />,
    );

    const stormButton = screen.getByRole("button", { name: /Storm Egg/i });
    expect(stormButton).toBeEnabled();
    expect(stormButton).toHaveAttribute("data-supported", "true");
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();
    expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();

    fireEvent.click(stormButton);
    fireEvent.click(screen.getByRole("button", { name: "Begin Your Journey" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: null,
      favoriteColor: "#38BDF8",
      spiritAnimal: "Egg",
      coreElement: "storm",
      storyTone: "epic_adventure",
      companionName: null,
    });
  });

  it("allows all active species during hatch mode without status labels", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="hatch"
        layout="compact"
      />,
    );

    const dragonButton = screen.getByText("Dragon").closest("button");
    expect(dragonButton).not.toBeNull();
    expect(dragonButton).toBeEnabled();
    expect(dragonButton).toHaveAttribute("data-supported", "true");

    const griffinButton = screen.getByText("Griffin").closest("button");
    expect(griffinButton).not.toBeNull();
    expect(griffinButton).toBeEnabled();

    const phoenixButton = screen.getByText("Phoenix").closest("button");
    expect(phoenixButton).not.toBeNull();
    expect(phoenixButton).toBeEnabled();
    fireEvent.click(phoenixButton);
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();
    expect(screen.queryByText("Coming Soon")).not.toBeInTheDocument();
  });

  it("renders the active species roster in hatch mode", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="hatch"
        layout="compact"
      />,
    );

    expect(getVisibleSpeciesOrder()).toEqual(COMPANION_PRESETS.map((preset) => preset.displayName));
  });

  it("lets reset mode lock a species while keeping the stage 0 egg flow", () => {
    const onComplete = vi.fn();

    render(
      <CompanionPersonalization
        onComplete={onComplete}
        mode="reset"
        layout="compact"
      />,
    );

    expect(screen.getAllByText("Sleeping Species").length).toBeGreaterThan(0);

    const phoenixButton = screen.getByText("Phoenix").closest("button");
    expect(phoenixButton).not.toBeNull();
    expect(phoenixButton).toBeEnabled();
    fireEvent.click(phoenixButton!);

    fireEvent.click(screen.getByRole("button", { name: "Begin Again" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: "phoenix",
      favoriteColor: "#F97316",
      spiritAnimal: "Phoenix",
      coreElement: "fire",
      storyTone: "epic_adventure",
      companionName: null,
    });
  });

  it("submits a trimmed custom companion name when provided", () => {
    const onComplete = vi.fn();

    render(
      <CompanionPersonalization
        onComplete={onComplete}
        mode="hatch"
        layout="compact"
      />,
    );

    fireEvent.change(screen.getByLabelText("Companion Name"), {
      target: { value: "  Zephyr  " },
    });
    fireEvent.click(screen.getByText("Phoenix").closest("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Hatch Companion" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: "phoenix",
      favoriteColor: "#F97316",
      spiritAnimal: "Phoenix",
      coreElement: "fire",
      storyTone: "epic_adventure",
      companionName: "Zephyr",
    });
  });
});
