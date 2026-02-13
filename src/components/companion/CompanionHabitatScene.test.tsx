import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompanionHabitatScene } from "./CompanionHabitatScene";

describe("CompanionHabitatScene", () => {
  it("renders high quality effects with particles when motion is enabled", () => {
    const { queryAllByTestId } = render(
      <CompanionHabitatScene
        biome="cosmic_nest"
        ambiance="serene"
        qualityTier="high"
        companionImageUrl={null}
        companionName="Companion"
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId("habitat-scene")).toHaveAttribute("data-quality-tier", "high");
    expect(screen.getByTestId("habitat-particles")).toBeInTheDocument();
    expect(queryAllByTestId("habitat-particle").length).toBeGreaterThan(0);
    expect(screen.getByTestId("habitat-depth-orb")).toBeInTheDocument();
    expect(screen.getByTestId("habitat-bloom-orb")).toBeInTheDocument();
  });

  it("falls back to static minimal layers for low quality or reduced motion", () => {
    const { rerender } = render(
      <CompanionHabitatScene
        biome="cosmic_nest"
        ambiance="serene"
        qualityTier="low"
        companionImageUrl={null}
        companionName="Companion"
        reducedMotion={false}
      />,
    );

    expect(screen.queryByTestId("habitat-particles")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habitat-depth-orb")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habitat-bloom-orb")).not.toBeInTheDocument();

    rerender(
      <CompanionHabitatScene
        biome="cosmic_nest"
        ambiance="serene"
        qualityTier="high"
        companionImageUrl={null}
        companionName="Companion"
        reducedMotion
      />,
    );

    expect(screen.getByTestId("habitat-scene")).toHaveAttribute("data-reduced-motion", "true");
    expect(screen.queryByTestId("habitat-particles")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habitat-depth-orb")).not.toBeInTheDocument();
    expect(screen.queryByTestId("habitat-bloom-orb")).not.toBeInTheDocument();
  });

  it("caps particle rendering when a particle budget is provided", () => {
    const { queryAllByTestId } = render(
      <CompanionHabitatScene
        biome="cosmic_nest"
        ambiance="serene"
        qualityTier="high"
        companionImageUrl={null}
        companionName="Companion"
        reducedMotion={false}
        maxParticles={5}
      />,
    );

    expect(screen.getByTestId("habitat-scene")).toHaveAttribute("data-particle-count", "5");
    expect(queryAllByTestId("habitat-particle").length).toBe(5);
  });
});
