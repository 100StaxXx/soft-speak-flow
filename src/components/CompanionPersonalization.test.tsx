import { render, screen } from "@testing-library/react";
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
});
