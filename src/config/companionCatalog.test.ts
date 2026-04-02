import { describe, expect, it } from "vitest";
import {
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

  it("preserves full remote coverage for existing remote presets", () => {
    expect(
      hasRemoteCompanionPresetAssetCoverage({
        presetId: "dragon",
        tier: "t4_guardian",
        state: "dormant",
      }),
    ).toBe(true);
    expect(
      hasRemoteCompanionPresetStageAssetCoverage({
        presetId: "raven",
        stage: 0,
        state: "normal",
      }),
    ).toBe(true);
  });
});
