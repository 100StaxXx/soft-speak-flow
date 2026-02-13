import { describe, expect, it } from "vitest";
import { mapGuidanceToneToIntensity } from "./StoryOnboarding";

describe("mapGuidanceToneToIntensity", () => {
  it("maps plain-text guidance tones to the expected intensity", () => {
    expect(mapGuidanceToneToIntensity("Direct & demanding")).toBe("high");
    expect(mapGuidanceToneToIntensity("Gentle & compassionate")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("Calm & grounded")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("Encouraging & supportive")).toBe("medium");
  });

  it("supports legacy emoji-prefixed variants and falls back safely", () => {
    expect(mapGuidanceToneToIntensity("⚔️ Direct & demanding")).toBe("high");
    expect(mapGuidanceToneToIntensity("🌱 Gentle & compassionate")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("🧘 Calm & grounded")).toBe("gentle");
    expect(mapGuidanceToneToIntensity("🤝 Encouraging & supportive")).toBe("medium");
    expect(mapGuidanceToneToIntensity("something unexpected")).toBe("medium");
  });
});
