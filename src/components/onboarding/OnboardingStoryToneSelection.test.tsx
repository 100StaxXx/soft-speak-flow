import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { COMPANION_PICKER_PRESETS } from "@/config/companionCatalog";
import { OnboardingStoryToneSelection } from "./OnboardingStoryToneSelection";

const getVisibleSpeciesOrder = () => {
  const speciesNames = COMPANION_PICKER_PRESETS.map((preset) => preset.displayName);

  return screen
    .getAllByRole("button")
    .map((button) => button.textContent ?? "")
    .flatMap((text) => speciesNames.filter((name) => text.includes(name)))
    .filter((name, index, values) => values.indexOf(name) === index);
};

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === "string" ? key : "div";
        return ({ children, ...props }: any) => React.createElement(tag, props, children);
      },
    },
  );

  return { motion };
});

describe("OnboardingStoryToneSelection", () => {
  it("requires a species selection before continuing and submits the chosen tone and species", () => {
    const onComplete = vi.fn();

    render(<OnboardingStoryToneSelection onComplete={onComplete} initialTone="epic_adventure" />);

    expect(screen.getByRole("button", { name: /Epic Adventure/i })).toHaveAttribute("data-selected", "true");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(getVisibleSpeciesOrder().slice(0, 3)).toEqual(["Leviathan", "Phoenix", "Kitsune"]);
    for (const removedSpecies of ["Wolf", "Owl", "Lion", "Griffin", "Sphinx"]) {
      expect(screen.queryByText(removedSpecies)).not.toBeInTheDocument();
    }
    for (const preset of COMPANION_PICKER_PRESETS) {
      expect(screen.getByTestId(`species-silhouette-${preset.id}`)).toHaveAttribute(
        "src",
        expect.stringContaining(`/onboarding/locked-species-silhouettes/`),
      );
    }
    expect(screen.queryByTestId("locked-species-silhouette")).not.toBeInTheDocument();
    expect(screen.queryByTestId("locked-species-silhouette-frame")).not.toBeInTheDocument();

    const dragonCard = screen.getByText("Dragon").closest("button");
    expect(dragonCard).not.toBeNull();
    expect(dragonCard).toBeDisabled();
    expect(screen.getAllByText("Awaiting Awakening").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Kitsune/i }));
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
    expect(screen.getByTestId("species-silhouette-fox")).toHaveAttribute(
      "src",
      "/onboarding/locked-species-silhouettes/fox.png",
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onComplete).toHaveBeenCalledWith({
      storyTone: "epic_adventure",
      presetId: "fox",
    });
  });

  it("lets the user change the tone and select phoenix as a supported species while keeping unsupported species blocked", () => {
    const onComplete = vi.fn();
    const onBack = vi.fn();

    render(
      <OnboardingStoryToneSelection
        onComplete={onComplete}
        onBack={onBack}
        initialTone="epic_adventure"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Whimsical & Playful/i }));
    fireEvent.click(screen.getByRole("button", { name: /Kitsune/i }));
    expect(screen.getByTestId("species-silhouette-fox")).toHaveAttribute(
      "src",
      "/onboarding/locked-species-silhouettes/fox.png",
    );
    fireEvent.click(screen.getByRole("button", { name: /Phoenix/i }));
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onBack).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledWith({
      storyTone: "whimsical_playful",
      presetId: "phoenix",
    });
  });

  it("keeps the onboarding picker roster aligned with the curated species order", () => {
    render(<OnboardingStoryToneSelection onComplete={vi.fn()} initialTone="epic_adventure" />);

    expect(getVisibleSpeciesOrder()).toEqual([
      "Leviathan",
      "Phoenix",
      "Kitsune",
      "Dragon",
      "Pegasus",
      "Mechanical Dragon",
      "Tanuki",
      "Buttercat",
    ]);
  });
});
