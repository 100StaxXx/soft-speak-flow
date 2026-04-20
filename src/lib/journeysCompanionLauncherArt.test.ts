import { describe, expect, it } from "vitest";
import {
  buildJourneysCompanionLauncherAwayAssetPath,
  resolveJourneysCompanionLauncherAwayAssetUrl,
} from "./journeysCompanionLauncherArt";

describe("journeysCompanionLauncherArt", () => {
  it("builds bundled launcher-away asset paths for known presets", () => {
    expect(buildJourneysCompanionLauncherAwayAssetPath({
      presetId: "dragon",
      element: "fire",
    })).toBe("companion-launcher-away/dragon/dragon__launcher-away__fire.png");
  });

  it("falls back when the preset cannot resolve", () => {
    expect(resolveJourneysCompanionLauncherAwayAssetUrl({
      presetId: "unknown-companion",
      element: "fire",
      fallbackUrl: "/front-facing.png",
    })).toBe("/front-facing.png");
  });
});
