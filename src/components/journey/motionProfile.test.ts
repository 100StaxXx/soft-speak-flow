import { describe, expect, it } from "vitest";
import { resolveJourneyMotionProfile } from "./motionProfile";

describe("resolveJourneyMotionProfile", () => {
  it("returns exact cinematic+balanced card defaults", () => {
    const profile = resolveJourneyMotionProfile({
      surface: "card",
      motionPreset: "cinematic",
      performanceMode: "balanced",
    });

    expect(profile).toMatchObject({
      bgStarsTotalDesktop: 14,
      bgStarsTotalMobile: 10,
      bgStarsAnimatedDesktop: 6,
      bgStarsAnimatedMobile: 4,
      pathSweepDurationSec: 3.4,
      pathSweepRepeatDelaySec: 1.2,
      companionBobAmplitudePx: 3,
      companionBobDurationSec: 2.6,
      currentMilestonePulseDurationSec: 1.8,
      revealParticleCount: 6,
      mysteryPopoverAmbientSparkles: 1,
    });
  });

  it("keeps drawer richer than card for the same profile", () => {
    const card = resolveJourneyMotionProfile({
      surface: "card",
      motionPreset: "cinematic",
      performanceMode: "balanced",
    });
    const drawer = resolveJourneyMotionProfile({
      surface: "drawer",
      motionPreset: "cinematic",
      performanceMode: "balanced",
    });

    expect(drawer.bgStarsTotalDesktop).toBeGreaterThan(card.bgStarsTotalDesktop);
    expect(drawer.bgStarsAnimatedDesktop).toBeGreaterThan(card.bgStarsAnimatedDesktop);
  });
});
