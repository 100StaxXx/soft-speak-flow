import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  COSMIQ_CANONICAL_ELEMENTS,
  COSMIQ_CANONICAL_SPECIES,
  getCosmiqCanonicalCompanionAssetDescriptor,
  getCosmiqCanonicalCompanionAssetUrl,
  isBundledCosmiqCanonicalCompanionAssetUrl,
  resolveCosmiqCanonicalCombination,
} from "@/config/cosmiqCanonicalCompanionAssets";

describe("cosmiqCanonicalCompanionAssets", () => {
  it("recognizes the nine approved species and element combinations", () => {
    const combinations = COSMIQ_CANONICAL_SPECIES.flatMap((species) => (
      COSMIQ_CANONICAL_ELEMENTS.map((element) => (
        resolveCosmiqCanonicalCombination({ species, element })
      ))
    ));

    expect(combinations).toHaveLength(9);
    expect(combinations.every(Boolean)).toBe(true);
  });

  it("maps Kitsune to the fox art folder", () => {
    expect(getCosmiqCanonicalCompanionAssetUrl({
      species: "Kitsune",
      element: "Ice",
      stage: 20,
    })).toBe("/companion-presets/fox/t3_awakened/normal/fox__t3_awakened__normal__ice.png");
  });

  it("selects later-stage boundaries without exposing unsupported combinations", () => {
    expect(getCosmiqCanonicalCompanionAssetUrl({
      species: "phoenix",
      element: "nature",
      stage: 81,
    })).toBe("/companion-presets/phoenix/t7_ascended/normal/phoenix__t7_ascended__normal__nature.png");
    expect(getCosmiqCanonicalCompanionAssetUrl({
      species: "dragon",
      element: "fire",
      stage: 81,
    })).toBeNull();
    expect(getCosmiqCanonicalCompanionAssetUrl({
      species: "leviathan",
      element: "fire",
      stage: 12,
    })).toBeNull();
  });

  it("fully describes every boundary for the supported 3x3 matrix", () => {
    const boundaries = [1, 5, 13, 21, 36, 56, 81] as const;
    const descriptors = COSMIQ_CANONICAL_SPECIES.flatMap((species) =>
      COSMIQ_CANONICAL_ELEMENTS.flatMap((element) =>
        boundaries.map((stage) =>
          getCosmiqCanonicalCompanionAssetDescriptor({ species, element, stage })
        )
      )
    );

    expect(descriptors).toHaveLength(63);
    expect(descriptors.every(Boolean)).toBe(true);
    expect(descriptors.filter((asset) => asset?.source === "remote")).toHaveLength(9);
    expect(descriptors.filter((asset) => asset?.source === "bundled")).toHaveLength(54);

    for (const descriptor of descriptors) {
      if (!descriptor || descriptor.source !== "bundled") continue;
      expect(existsSync(resolve(process.cwd(), "public/companion-presets", descriptor.storagePath))).toBe(true);
      expect(isBundledCosmiqCanonicalCompanionAssetUrl(
        `/companion-presets/${descriptor.storagePath}`,
      )).toBe(true);
    }
  });
});
