import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COMPANION_CATALOG_PRESETS } from "@/config/companionCatalog";
import { CompanionPersonalization } from "./CompanionPersonalization";

const getVisibleSpeciesOrder = () => {
  const speciesNames = COMPANION_CATALOG_PRESETS.map((preset) => preset.displayName);

  return screen
    .getAllByRole("button")
    .map((button) => button.textContent ?? "")
    .flatMap((text) => speciesNames.filter((name) => text.includes(name)))
    .filter((name, index, values) => values.indexOf(name) === index);
};

describe("CompanionPersonalization", () => {
  it("constrains the migration carousel to the phone viewport so it can scroll horizontally", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="migration"
      />,
    );

    expect(screen.getByTestId("companion-preset-carousel")).toHaveClass(
      "w-full",
      "min-w-0",
      "max-w-full",
      "overflow-x-auto",
      "overflow-y-hidden",
    );
  });

  it("renders egg selection cards with focal-aware contain images", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="onboarding"
        layout="compact"
      />,
    );

    const eggImage = screen.getAllByRole("img", { name: "Fire Egg" }).find((image) =>
      image.getAttribute("data-companion-image-fit") === "contain"
      && image.getAttribute("data-companion-image-focal-source") === "manifest"
      && image.getAttribute("data-companion-image-asset-key") === "companion-eggs/v2/egg__t0_egg__normal__fire.webp"
    );

    expect(eggImage).toBeDefined();
    expect(eggImage!).toHaveStyle({ objectPosition: "center center" });
  });

  it("limits Cosmiq egg selection to Fire, Ice, and Nature", () => {
    const onComplete = vi.fn();

    render(
      <CompanionPersonalization
        onComplete={onComplete}
        mode="onboarding"
        layout="compact"
      />,
    );

    const stormButton = screen.getByRole("button", { name: /Storm Egg/i });
    expect(stormButton).toBeDisabled();
    expect(stormButton).toHaveAttribute("data-supported", "false");
    expect(screen.getAllByText("Legacy").length).toBeGreaterThan(0);
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Nature Egg/i }));
    fireEvent.click(screen.getByRole("button", { name: "Begin My Daily Path" }));

    expect(onComplete).toHaveBeenCalledWith({
      presetId: null,
      favoriteColor: "#34D399",
      spiritAnimal: "Egg",
      coreElement: "nature",
      storyTone: "epic_adventure",
      companionName: null,
    });
  });

  it("allows only Kitsune, Phoenix, and Leviathan during Cosmiq hatch selection", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="hatch"
        layout="compact"
      />,
    );

    const dragonButton = screen.getByText("Dragon").closest("button");
    expect(dragonButton).not.toBeNull();
    expect(dragonButton).toBeDisabled();
    expect(dragonButton).toHaveAttribute("data-supported", "false");

    const griffinButton = screen.getByText("Griffin").closest("button");
    expect(griffinButton).not.toBeNull();
    expect(griffinButton).toBeDisabled();

    const phoenixButton = screen.getByText("Phoenix").closest("button");
    expect(phoenixButton).not.toBeNull();
    expect(phoenixButton).toBeEnabled();
    fireEvent.click(phoenixButton);
    expect(screen.queryByText("Selected")).not.toBeInTheDocument();
    expect(screen.getAllByText("Legacy").length).toBeGreaterThan(0);
  });

  it("renders the active species roster in hatch mode", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="hatch"
        layout="compact"
      />,
    );

    expect(getVisibleSpeciesOrder()).toEqual(COMPANION_CATALOG_PRESETS.map((preset) => preset.displayName));
    expect(screen.getByText("Raven").closest("button")).toBeDisabled();
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

    expect(screen.getAllByText("Symbolic Creature").length).toBeGreaterThan(0);

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
    fireEvent.click(screen.getByRole("button", { name: "Reveal Companion" }));

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
