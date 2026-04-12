import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompanionPersonalization } from "./CompanionPersonalization";

describe("CompanionPersonalization", () => {
  it("renders egg selection cards with focal-aware contain images", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="onboarding"
        layout="compact"
      />,
    );

    const eggImages = screen.getAllByRole("img", { name: "Fire Egg" });
    expect(eggImages.some((image) =>
      image.getAttribute("data-companion-image-fit") === "contain"
      && image.getAttribute("data-companion-image-focal-source") === "manifest"
      && image.getAttribute("style")?.includes("scale(1.08)")
    )).toBe(true);
  });

  it("dims unsupported egg elements during onboarding mode", () => {
    render(
      <CompanionPersonalization
        onComplete={vi.fn()}
        mode="onboarding"
        layout="compact"
      />,
    );

    const stormButton = screen.getByRole("button", { name: /Storm Egg/i });
    expect(stormButton).toBeDisabled();
    expect(stormButton).toHaveAttribute("data-supported", "false");
    expect(screen.getAllByText("Awaiting Awakening").length).toBeGreaterThan(0);
  });

  it("dims unsupported presets during hatch mode and keeps supported presets selectable", () => {
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

    const phoenixButton = screen.getByText("Phoenix").closest("button");
    expect(phoenixButton).not.toBeNull();
    expect(phoenixButton).toBeEnabled();
    fireEvent.click(phoenixButton);
    expect(screen.getAllByText("Selected").length).toBeGreaterThan(0);
  });
});
