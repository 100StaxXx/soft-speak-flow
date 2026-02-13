export type TrailSurface = "card" | "drawer";
export type TrailMotionPreset = "cinematic" | "playful" | "arcade";
export type TrailPerformanceMode = "balanced" | "max_visuals" | "strict_smoothness";

export interface JourneyMotionProfile {
  bgStarsTotalDesktop: number;
  bgStarsTotalMobile: number;
  bgStarsAnimatedDesktop: number;
  bgStarsAnimatedMobile: number;
  pathSweepDurationSec: number;
  pathSweepRepeatDelaySec: number;
  companionBobAmplitudePx: number;
  companionBobDurationSec: number;
  currentMilestonePulseDurationSec: number;
  revealParticleCount: number;
  mysteryPopoverAmbientSparkles: number;
}

const CINEMATIC_BALANCED_CARD: JourneyMotionProfile = {
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
};

const clampInt = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const withPresetAdjustments = (
  profile: JourneyMotionProfile,
  preset: TrailMotionPreset,
): JourneyMotionProfile => {
  if (preset === "playful") {
    return {
      ...profile,
      bgStarsTotalDesktop: profile.bgStarsTotalDesktop + 2,
      bgStarsTotalMobile: profile.bgStarsTotalMobile + 2,
      bgStarsAnimatedDesktop: profile.bgStarsAnimatedDesktop + 1,
      bgStarsAnimatedMobile: profile.bgStarsAnimatedMobile + 1,
      pathSweepDurationSec: 3.0,
      companionBobAmplitudePx: profile.companionBobAmplitudePx + 1,
      mysteryPopoverAmbientSparkles: 2,
    };
  }

  if (preset === "arcade") {
    return {
      ...profile,
      bgStarsTotalDesktop: profile.bgStarsTotalDesktop + 4,
      bgStarsTotalMobile: profile.bgStarsTotalMobile + 3,
      bgStarsAnimatedDesktop: profile.bgStarsAnimatedDesktop + 3,
      bgStarsAnimatedMobile: profile.bgStarsAnimatedMobile + 2,
      pathSweepDurationSec: 2.4,
      pathSweepRepeatDelaySec: 0.6,
      companionBobAmplitudePx: profile.companionBobAmplitudePx + 2,
      companionBobDurationSec: 2.0,
      currentMilestonePulseDurationSec: 1.4,
      revealParticleCount: profile.revealParticleCount + 2,
      mysteryPopoverAmbientSparkles: 3,
    };
  }

  return profile;
};

const withPerformanceAdjustments = (
  profile: JourneyMotionProfile,
  mode: TrailPerformanceMode,
): JourneyMotionProfile => {
  if (mode === "max_visuals") {
    return {
      ...profile,
      bgStarsTotalDesktop: profile.bgStarsTotalDesktop + 2,
      bgStarsTotalMobile: profile.bgStarsTotalMobile + 1,
      bgStarsAnimatedDesktop: profile.bgStarsAnimatedDesktop + 1,
      bgStarsAnimatedMobile: profile.bgStarsAnimatedMobile + 1,
      revealParticleCount: profile.revealParticleCount + 1,
      mysteryPopoverAmbientSparkles: profile.mysteryPopoverAmbientSparkles + 1,
    };
  }

  if (mode === "strict_smoothness") {
    return {
      ...profile,
      bgStarsTotalDesktop: profile.bgStarsTotalDesktop - 3,
      bgStarsTotalMobile: profile.bgStarsTotalMobile - 2,
      bgStarsAnimatedDesktop: profile.bgStarsAnimatedDesktop - 2,
      bgStarsAnimatedMobile: profile.bgStarsAnimatedMobile - 1,
      companionBobAmplitudePx: Math.max(1, profile.companionBobAmplitudePx - 1),
      revealParticleCount: Math.max(3, profile.revealParticleCount - 2),
      mysteryPopoverAmbientSparkles: 1,
    };
  }

  return profile;
};

const withSurfaceAdjustments = (
  profile: JourneyMotionProfile,
  surface: TrailSurface,
): JourneyMotionProfile => {
  if (surface !== "drawer") return profile;

  return {
    ...profile,
    bgStarsTotalDesktop: profile.bgStarsTotalDesktop + 2,
    bgStarsTotalMobile: profile.bgStarsTotalMobile + 1,
    bgStarsAnimatedDesktop: profile.bgStarsAnimatedDesktop + 1,
    bgStarsAnimatedMobile: profile.bgStarsAnimatedMobile + 1,
  };
};

export interface ResolveJourneyMotionProfileOptions {
  surface?: TrailSurface;
  motionPreset?: TrailMotionPreset;
  performanceMode?: TrailPerformanceMode;
}

export const resolveJourneyMotionProfile = ({
  surface = "card",
  motionPreset = "cinematic",
  performanceMode = "balanced",
}: ResolveJourneyMotionProfileOptions = {}): JourneyMotionProfile => {
  let profile = { ...CINEMATIC_BALANCED_CARD };
  profile = withPresetAdjustments(profile, motionPreset);
  profile = withPerformanceAdjustments(profile, performanceMode);
  profile = withSurfaceAdjustments(profile, surface);

  profile.bgStarsTotalDesktop = clampInt(profile.bgStarsTotalDesktop, 4, 28);
  profile.bgStarsTotalMobile = clampInt(profile.bgStarsTotalMobile, 4, 20);
  profile.bgStarsAnimatedDesktop = clampInt(
    profile.bgStarsAnimatedDesktop,
    1,
    profile.bgStarsTotalDesktop,
  );
  profile.bgStarsAnimatedMobile = clampInt(
    profile.bgStarsAnimatedMobile,
    1,
    profile.bgStarsTotalMobile,
  );
  profile.revealParticleCount = clampInt(profile.revealParticleCount, 3, 14);
  profile.mysteryPopoverAmbientSparkles = clampInt(
    profile.mysteryPopoverAmbientSparkles,
    1,
    4,
  );

  return profile;
};
