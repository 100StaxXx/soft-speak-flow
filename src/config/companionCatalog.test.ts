import { describe, expect, it } from "vitest";
import {
  COMPANION_PICKER_PRESET_IDS,
  COMPANION_PICKER_PRESETS,
  getCosmiqCompanionAvailability,
  getCompanionElement,
  getCompanionElementProductLabel,
  hasCompanionPresetStageExpressiveAssetCoverage,
  hasRemoteCompanionPresetAssetCoverage,
  hasRemoteCompanionPresetStageAssetCoverage,
} from "./companionCatalog";

describe("companion preset asset coverage", () => {
  it("covers Initiate normal art for the active roster and supports the Kitsune alias", () => {
    for (const presetId of [
      "dragon",
      "wolf",
      "fox",
      "owl",
      "lion",
      "phoenix",
      "pegasus",
      "griffin",
      "sphinx",
      "leviathan",
      "mechanicaldragon",
      "tanuki",
      "buttercat",
    ]) {
      expect(
        hasRemoteCompanionPresetAssetCoverage({
          presetId,
          tier: "t2_initiate",
          state: "normal",
        }),
      ).toBe(true);
    }

    expect(
      hasRemoteCompanionPresetAssetCoverage({
        presetId: "Kitsune",
        tier: "t2_initiate",
        state: "normal",
      }),
    ).toBe(true);
    expect(
      hasRemoteCompanionPresetStageAssetCoverage({
        presetId: "kitsune",
        stage: 5,
        state: "normal",
      }),
    ).toBe(true);
  });

  it("does not mark unsupported Initiate states as remotely covered for the new batch", () => {
    expect(
      hasRemoteCompanionPresetAssetCoverage({
        presetId: "griffin",
        tier: "t2_initiate",
        state: "neglected",
      }),
    ).toBe(false);
    expect(
      hasRemoteCompanionPresetAssetCoverage({
        presetId: "mechanicaldragon",
        tier: "t2_initiate",
        state: "dormant",
      }),
    ).toBe(false);
    expect(
      hasRemoteCompanionPresetStageAssetCoverage({
        presetId: "tanuki",
        stage: 13,
        state: "normal",
      }),
    ).toBe(false);
  });

  it("does not advertise later-stage or care-state art until the files exist", () => {
    expect(
      hasRemoteCompanionPresetAssetCoverage({
        presetId: "dragon",
        tier: "t4_guardian",
        state: "dormant",
      }),
    ).toBe(false);
    expect(
      hasRemoteCompanionPresetStageAssetCoverage({
        presetId: "raven",
        stage: 0,
        state: "normal",
      }),
    ).toBe(false);
  });

  it("does not request expressive portraits from empty local or remote packs", () => {
    expect(hasCompanionPresetStageExpressiveAssetCoverage({
      presetId: "phoenix",
      stage: 1,
    })).toBe(false);
    expect(hasCompanionPresetStageExpressiveAssetCoverage({
      presetId: "phoenix",
      stage: 5,
    })).toBe(false);
  });

  it("exposes grounded visual-nature labels without changing the stable element ids", () => {
    expect(getCompanionElement("fire").label).toBe("Fire");
    expect(getCompanionElement("fire").productLabel).toBe("Ember");
    expect(getCompanionElement("ice").label).toBe("Ice");
    expect(getCompanionElement("ice").productLabel).toBe("Clear Water");
    expect(getCompanionElement("nature").label).toBe("Nature");
    expect(getCompanionElement("nature").productLabel).toBe("Living Green");

    expect(getCompanionElementProductLabel("fire")).toBe("Ember");
    expect(getCompanionElementProductLabel("ice")).toBe("Clear Water");
    expect(getCompanionElementProductLabel("nature")).toBe("Living Green");
  });

  it("exposes the curated onboarding and personalization picker roster", () => {
    expect(COMPANION_PICKER_PRESET_IDS).toEqual([
      "leviathan",
      "phoenix",
      "fox",
    ]);
    expect(COMPANION_PICKER_PRESETS.map((preset) => preset.displayName)).toEqual([
      "Leviathan",
      "Phoenix",
      "Kitsune",
    ]);
    expect(getCosmiqCompanionAvailability("Kitsune")).toBe("current_selection");
    expect(getCosmiqCompanionAvailability("dragon")).toBe("legacy_frozen");
  });
});
