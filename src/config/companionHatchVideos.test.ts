import { describe, expect, it } from "vitest";

import { getCompanionHatchVideoUrl } from "./companionHatchVideos";

describe("companionHatchVideos", () => {
  it("does not use legacy clips with unverified endpoints in Graceward", () => {
    expect(getCompanionHatchVideoUrl({ presetId: "fox", element: "fire" })).toBeNull();
    expect(getCompanionHatchVideoUrl({ presetId: "fox", element: "ice" })).toBeNull();
    expect(getCompanionHatchVideoUrl({ presetId: "phoenix", element: "nature" })).toBeNull();
    expect(getCompanionHatchVideoUrl({ presetId: "leviathan", element: "fire" })).toBeNull();
  });

  it("returns null outside the supported launch matrix", () => {
    expect(getCompanionHatchVideoUrl({ presetId: "dragon", element: "fire" })).toBeNull();
    expect(getCompanionHatchVideoUrl({ presetId: "fox", element: "storm" })).toBeNull();
    expect(getCompanionHatchVideoUrl({ presetId: null, element: "fire" })).toBeNull();
  });
});
