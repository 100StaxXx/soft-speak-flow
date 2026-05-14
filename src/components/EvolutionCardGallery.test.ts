import { describe, expect, it } from "vitest";
import { shouldUseCompanionSceneFramingForEvolutionCardImage } from "@/lib/evolutionCardImageFraming";

describe("shouldUseCompanionSceneFramingForEvolutionCardImage", () => {
  it("contains generated scene art when the card falls back to the evolution image", () => {
    expect(
      shouldUseCompanionSceneFramingForEvolutionCardImage({
        cardImageUrl: null,
        evolutionImageUrl: "https://assets.example.com/stage-5.png",
        evolutionStage: 5,
      }),
    ).toBe(true);
  });

  it("contains legacy card images copied from the evolution image", () => {
    expect(
      shouldUseCompanionSceneFramingForEvolutionCardImage({
        cardImageUrl: "https://assets.example.com/stage-0.png",
        evolutionImageUrl: "https://assets.example.com/stage-0.png",
        evolutionStage: 0,
      }),
    ).toBe(true);
  });

  it("contains legacy stage-zero companion images without an evolution lookup", () => {
    expect(
      shouldUseCompanionSceneFramingForEvolutionCardImage({
        cardImageUrl: "https://assets.example.com/initial-companion.png",
        evolutionImageUrl: null,
        evolutionStage: 0,
      }),
    ).toBe(true);
  });

  it("contains bundled stage-zero companion images copied from the initial image", () => {
    expect(
      shouldUseCompanionSceneFramingForEvolutionCardImage({
        cardImageUrl: "/companion-eggs/egg__t0_egg__normal__fire.png",
        evolutionImageUrl: null,
        evolutionStage: 0,
      }),
    ).toBe(true);
  });

  it("keeps standalone card art cropped", () => {
    expect(
      shouldUseCompanionSceneFramingForEvolutionCardImage({
        cardImageUrl: "https://assets.example.com/card-art.png",
        evolutionImageUrl: "https://assets.example.com/stage-5.png",
        evolutionStage: 5,
      }),
    ).toBe(false);
  });
});
