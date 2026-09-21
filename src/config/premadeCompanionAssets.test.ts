import { describe, expect, it } from "vitest";
import {
  GRACEWARD_PREMADE_COMPANION_SPECIES,
  GRACEWARD_PREMADE_COMPANION_ELEMENTS,
  GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS,
  PREMADE_COMPANION_BOUNDARY_LEVELS,
  PREMADE_COMPANION_PRODUCT_BOUNDARY_LEVELS,
  PREMADE_COMPANION_PRODUCT_ELEMENTS,
  PREMADE_COMPANION_PRODUCT_SPECIES,
  getExpectedPremadeCompanionEvolutionAssets,
  getExpectedPremadeGracewardFormationAssets,
  getPremadeCompanionEvolutionAssetDescriptor,
  getPremadeGracewardFormationAssetDescriptor,
  getPremadeCompanionPortraitDescriptorForStage,
} from "./premadeCompanionAssets";
import { PILOT_CHRISTIAN_COMPANION_FORM_IDS } from "./companionPilotAvailability";

describe("premade companion asset contract", () => {
  it("covers each product's release-scoped species, element, and visual boundaries", () => {
    const expectedAssetCount = Object.entries(PREMADE_COMPANION_PRODUCT_SPECIES)
      .reduce((total, [productMode, species]) => (
        total + species.length *
          PREMADE_COMPANION_PRODUCT_ELEMENTS[
            productMode as keyof typeof PREMADE_COMPANION_PRODUCT_ELEMENTS
          ].length *
          PREMADE_COMPANION_PRODUCT_BOUNDARY_LEVELS[
            productMode as keyof typeof PREMADE_COMPANION_PRODUCT_BOUNDARY_LEVELS
          ].length
      ), 0);
    const assets = getExpectedPremadeCompanionEvolutionAssets();

    expect(assets).toHaveLength(expectedAssetCount);
    expect(assets.filter((asset) => asset.productMode === "graceward"))
      .toHaveLength(72);
    expect(assets.filter((asset) => asset.productMode === "cosmiq"))
      .toHaveLength(546);
    expect(new Set(assets.map((asset) => asset.portraitStoragePath)).size)
      .toBe(assets.length);
    expect(new Set(assets.map((asset) => asset.videoStoragePath)).size)
      .toBe(assets.length);
  });

  it("limits the Graceward launch pack to the visual forms through Level 5", () => {
    expect(GRACEWARD_PREMADE_COMPANION_BOUNDARY_LEVELS).toEqual([1, 5]);
    expect(PREMADE_COMPANION_BOUNDARY_LEVELS).toEqual([1, 5, 13, 21, 36, 56, 81]);
    expect(
      getPremadeCompanionEvolutionAssetDescriptor({
        productMode: "graceward",
        species: "lion",
        element: "light",
        boundaryLevel: 13,
      }),
    ).toBeNull();
  });

  it("keeps the Graceward manifest aligned with the selectable forms", () => {
    expect(GRACEWARD_PREMADE_COMPANION_SPECIES)
      .toEqual(PILOT_CHRISTIAN_COMPANION_FORM_IDS);
    expect(GRACEWARD_PREMADE_COMPANION_ELEMENTS).toEqual([
      "fire",
      "ice",
      "storm",
      "nature",
      "void",
      "light",
    ]);
  });

  it("uses deterministic Higgsfield import destinations", () => {
    expect(
      getPremadeCompanionEvolutionAssetDescriptor({
        productMode: "graceward",
        species: "Lion",
        element: "Light",
        boundaryLevel: 1,
      }),
    ).toMatchObject({
      species: "lion",
      element: "light",
      previousBoundaryLevel: 0,
      portraitStoragePath:
        "premade/v1/graceward/lion/light/portraits/level-1.webp",
      videoStoragePath:
        "premade/v1/graceward/lion/light/videos/level-0-to-1.mp4",
    });
  });

  it("resolves gameplay levels only inside the Graceward launch scope", () => {
    expect(
      getPremadeCompanionPortraitDescriptorForStage({
        productMode: "graceward",
        species: "Dove",
        element: "nature",
        stage: 4,
      })?.boundaryLevel,
    ).toBe(1);
    expect(
      getPremadeCompanionPortraitDescriptorForStage({
        productMode: "graceward",
        species: "Dove",
        element: "nature",
        stage: 5,
      })?.boundaryLevel,
    ).toBe(5);
    expect(
      getPremadeCompanionPortraitDescriptorForStage({
        productMode: "graceward",
        species: "Dove",
        element: "nature",
        stage: 13,
      }),
    ).toBeNull();
  });

  it("publishes only reviewed formation JPG/video pairs in the launch manifest", () => {
    const assets = getExpectedPremadeGracewardFormationAssets();
    expect(assets).toHaveLength(49);
    expect(new Set(assets.map((asset) => asset.videoStoragePath)).size)
      .toBe(assets.length);
    expect(new Set(assets.map((asset) => asset.stillStoragePath)).size)
      .toBe(assets.length);

    expect(getPremadeGracewardFormationAssetDescriptor({
      species: "wolf",
      element: "nature",
      stage: 3,
      category: "Mind",
      variant: 2,
    })).toMatchObject({
      boundaryLevel: 1,
      videoStoragePath:
        "premade/v1/graceward/wolf/nature/formation/level-1/mind-2.mp4",
      stillStoragePath:
        "premade/v1/graceward/wolf/nature/formation/level-1/mind-2.jpg",
    });
  });

  it("covers formerly locked Graceward species and elements", () => {
    expect(getPremadeCompanionEvolutionAssetDescriptor({
      productMode: "graceward",
      species: "lamb",
      element: "light",
      boundaryLevel: 1,
    })).not.toBeNull();
    expect(getPremadeCompanionEvolutionAssetDescriptor({
      productMode: "graceward",
      species: "wolf",
      element: "storm",
      boundaryLevel: 1,
    })).not.toBeNull();
    expect(getPremadeGracewardFormationAssetDescriptor({
      species: "wolf",
      element: "fire",
      stage: 1,
      category: "Mind",
      variant: 1,
    })).toBeNull();
    expect(getPremadeGracewardFormationAssetDescriptor({
      species: "wolf",
      element: "nature",
      stage: 1,
      category: "Mind",
      variant: 1,
    })).not.toBeNull();
  });

  it("rejects species outside the selected product and non-boundary claims", () => {
    expect(
      getPremadeCompanionEvolutionAssetDescriptor({
        productMode: "graceward",
        species: "phoenix",
        element: "fire",
        boundaryLevel: 1,
      }),
    ).toBeNull();
    expect(
      getPremadeCompanionEvolutionAssetDescriptor({
        productMode: "cosmiq",
        species: "fox",
        element: "fire",
        boundaryLevel: 2,
      }),
    ).toBeNull();
  });
});
