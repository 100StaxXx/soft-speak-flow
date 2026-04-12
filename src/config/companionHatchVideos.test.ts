import { describe, expect, it } from "vitest";

import { getCompanionHatchVideoUrl } from "./companionHatchVideos";

describe("companionHatchVideos", () => {
  it("locks the supported 3x3 hatch video matrix", () => {
    expect(getCompanionHatchVideoUrl({ presetId: "fox", element: "fire" })).toBe(
      "/companion-hatch-videos/hatch__fox__fire__center-crop.mp4",
    );
    expect(getCompanionHatchVideoUrl({ presetId: "fox", element: "ice" })).toBe(
      "/companion-hatch-videos/hatch__fox__ice.mp4",
    );
    expect(getCompanionHatchVideoUrl({ presetId: "phoenix", element: "nature" })).toBe(
      "/companion-hatch-videos/hatch__phoenix__nature.mp4",
    );
    expect(getCompanionHatchVideoUrl({ presetId: "leviathan", element: "fire" })).toBe(
      "/companion-hatch-videos/hatch__leviathan__fire.mp4",
    );
  });

  it("returns null outside the supported launch matrix", () => {
    expect(getCompanionHatchVideoUrl({ presetId: "dragon", element: "fire" })).toBeNull();
    expect(getCompanionHatchVideoUrl({ presetId: "fox", element: "storm" })).toBeNull();
    expect(getCompanionHatchVideoUrl({ presetId: null, element: "fire" })).toBeNull();
  });
});
