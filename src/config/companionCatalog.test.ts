import { describe, expect, it } from "vitest";
import {
  COMPANION_PICKER_PRESET_IDS,
  COMPANION_PICKER_PRESETS,
  getCompanionElement,
  getCompanionElementProductLabel,
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

  it("does not advertise legacy remote variants that have not shipped", () => {
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

  it("keeps canonical internal labels while exposing renamed product-facing labels", () => {
    expect(getCompanionElement("fire").label).toBe("Fire");
    expect(getCompanionElement("ice").label).toBe("Ice");
    expect(getCompanionElement("nature").label).toBe("Nature");

    expect(getCompanionElementProductLabel("fire")).toBe("Ember");
    expect(getCompanionElementProductLabel("ice")).toBe("Ice");
    expect(getCompanionElementProductLabel("nature")).toBe("Nature");
  });

  it("exposes the curated onboarding and personalization picker roster", () => {
    expect(COMPANION_PICKER_PRESET_IDS).toEqual([
      "leviathan",
      "phoenix",
      "fox",
      "dragon",
      "pegasus",
      "mechanicaldragon",
      "tanuki",
      "buttercat",
    ]);
    expect(COMPANION_PICKER_PRESETS.map((preset) => preset.displayName)).toEqual([
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
