import { describe, expect, it } from "vitest";

import {
  COSMIQ_PRODUCTION_ELEMENTS,
  COSMIQ_PRODUCTION_SPECIES,
  resolveCosmiqProductionCombination,
} from "./cosmiqProductionCatalog";
import {
  COMPANION_ELEMENTS,
  COMPANION_PRESETS,
  COMPANION_PRESETS_WITH_BUNDLED_YOUTH_ASSETS,
} from "./companionCatalog";

describe("cosmiqProductionCatalog", () => {
  it("covers every non-legacy species and all six elements", () => {
    expect(COSMIQ_PRODUCTION_SPECIES).toHaveLength(13);
    expect(COSMIQ_PRODUCTION_ELEMENTS).toHaveLength(6);
    expect(COSMIQ_PRODUCTION_SPECIES).toContain("buttercat");
    expect(COSMIQ_PRODUCTION_ELEMENTS).toContain("storm");
    expect(COSMIQ_PRODUCTION_SPECIES).toEqual(
      COMPANION_PRESETS.map((preset) => preset.id),
    );
    expect(COSMIQ_PRODUCTION_SPECIES).toEqual(
      COMPANION_PRESETS_WITH_BUNDLED_YOUTH_ASSETS,
    );
    expect(COSMIQ_PRODUCTION_ELEMENTS).toEqual(
      COMPANION_ELEMENTS.map((element) => element.id),
    );
  });

  it("normalizes production aliases without admitting the frozen legacy raven", () => {
    expect(resolveCosmiqProductionCombination({
      species: "Kitsune",
      element: "Light",
    })).toEqual({ species: "fox", element: "light" });
    expect(resolveCosmiqProductionCombination({
      species: "Mechanical Dragon",
      element: "Void",
    })).toEqual({ species: "mechanicaldragon", element: "void" });
    expect(resolveCosmiqProductionCombination({
      species: "raven",
      element: "fire",
    })).toBeNull();
  });
});
