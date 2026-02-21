import { useMemo, type CSSProperties } from "react";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import type { FactionType } from "./FactionSelector";

export type OnboardingBackdropStage =
  | "prologue"
  | "destiny"
  | "questionnaire"
  | "calculating"
  | "journey-begins";

export type OnboardingMotionLevel = "subtle" | "balanced" | "high";

export interface OnboardingBackdropPreset {
  ringScale: number;
  ringOpacity: number;
  ringSpread: number;
  hazeOpacity: number;
  particleDensity: number;
  accentStrength: number;
  centerMaskOpacity: number;
  vignetteOpacity: number;
}

export const ONBOARDING_BACKDROP_PRESETS: Record<OnboardingBackdropStage, OnboardingBackdropPreset> = {
  prologue: {
    ringScale: 0.92,
    ringOpacity: 0.18,
    ringSpread: 0.16,
    hazeOpacity: 0.52,
    particleDensity: 12,
    accentStrength: 0.2,
    centerMaskOpacity: 0.42,
    vignetteOpacity: 0.48,
  },
  destiny: {
    ringScale: 0.98,
    ringOpacity: 0.24,
    ringSpread: 0.18,
    hazeOpacity: 0.62,
    particleDensity: 14,
    accentStrength: 0.28,
    centerMaskOpacity: 0.35,
    vignetteOpacity: 0.5,
  },
  questionnaire: {
    ringScale: 1.02,
    ringOpacity: 0.23,
    ringSpread: 0.2,
    hazeOpacity: 0.56,
    particleDensity: 13,
    accentStrength: 0.28,
    centerMaskOpacity: 0.36,
    vignetteOpacity: 0.48,
  },
  calculating: {
    ringScale: 1.16,
    ringOpacity: 0.34,
    ringSpread: 0.26,
    hazeOpacity: 0.62,
    particleDensity: 16,
    accentStrength: 0.3,
    centerMaskOpacity: 0.34,
    vignetteOpacity: 0.52,
  },
  "journey-begins": {
    ringScale: 1.1,
    ringOpacity: 0.3,
    ringSpread: 0.22,
    hazeOpacity: 0.64,
    particleDensity: 15,
    accentStrength: 0.32,
    centerMaskOpacity: 0.3,
    vignetteOpacity: 0.54,
  },
};

const FACTION_ACCENTS: Record<FactionType, string> = {
  starfall: "20 100% 58%",
  void: "272 78% 60%",
  stellar: "198 86% 62%",
};

const MOTION_MULTIPLIER: Record<OnboardingMotionLevel, number> = {
  subtle: 0.72,
  balanced: 1,
  high: 1.25,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const resolveOnboardingBackdropPreset = (stage: OnboardingBackdropStage): OnboardingBackdropPreset =>
  ONBOARDING_BACKDROP_PRESETS[stage];

export const resolveFactionAccent = (faction?: FactionType | null): string | null => {
  if (!faction) return null;
  return FACTION_ACCENTS[faction];
};

interface OnboardingCosmicBackdropProps {
  stage: OnboardingBackdropStage;
  faction?: FactionType | null;
  motionLevel?: OnboardingMotionLevel;
}

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  duration: number;
  driftDistance: number;
};

export const OnboardingCosmicBackdrop = ({
  stage,
  faction = null,
  motionLevel = "balanced",
}: OnboardingCosmicBackdropProps) => {
  const preset = resolveOnboardingBackdropPreset(stage);
  const { capabilities, signals } = useMotionProfile();
  const factionAccent = resolveFactionAccent(faction);

  const allowsAnimation =
    capabilities.allowBackgroundAnimation && !signals.prefersReducedMotion && !signals.isBackgrounded;
  const isReducedMotion = !allowsAnimation;
  const animationEnabled = allowsAnimation && motionLevel !== "subtle";

  const particleCount = useMemo(() => {
    const scaledCount = Math.round(preset.particleDensity * MOTION_MULTIPLIER[motionLevel]);
    const liteCap = Math.max(4, Math.floor(capabilities.maxParticles * 0.45));
    const maxCount = isReducedMotion ? liteCap : capabilities.maxParticles;
    return clamp(scaledCount, 4, maxCount);
  }, [capabilities.maxParticles, isReducedMotion, motionLevel, preset.particleDensity]);

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: particleCount }, (_, index) => ({
      id: index,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.8 + 0.8,
      opacity: Math.random() * 0.45 + 0.25,
      delay: Math.random() * 4,
      duration: Math.random() * 9 + 12,
      driftDistance: Math.random() * 32 + 18,
    }));
  }, [particleCount, stage]);

  const ringLayers = useMemo(
    () =>
      Array.from({ length: 4 }, (_, index) => {
        const spread = 1 + preset.ringSpread * index;
        return {
          id: index,
          size: (56 + index * 16) * preset.ringScale * spread,
          opacity: Math.max(0.08, preset.ringOpacity - index * 0.04),
          duration: 16 + index * 4,
          delay: index * 1.3,
        };
      }),
    [preset.ringOpacity, preset.ringScale, preset.ringSpread],
  );

  const factionTintStyle = useMemo<CSSProperties | undefined>(() => {
    if (!factionAccent) return undefined;
    return {
      ["--onb-faction-accent" as string]: factionAccent,
      opacity: preset.accentStrength,
    };
  }, [factionAccent, preset.accentStrength]);

  return (
    <div
      className="onb-cosmic-backdrop absolute inset-0 z-0 overflow-hidden pointer-events-none"
      data-testid="onb-cosmic-backdrop"
      data-stage={stage}
      data-reduced-motion={isReducedMotion}
    >
      <div className="absolute inset-0 onb-cosmic-base" />

      <div
        className={`absolute inset-0 onb-nebula-haze ${animationEnabled ? "onb-animate-nebula-drift onb-animated" : ""}`}
        style={{ opacity: preset.hazeOpacity }}
      />

      {factionTintStyle && (
        <div
          className="absolute inset-0 onb-faction-tint"
          data-testid="onb-faction-tint"
          style={factionTintStyle}
        />
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        {ringLayers.map((ring) => (
          <div
            key={`ring-${ring.id}`}
            className={`onb-cosmic-ring ${animationEnabled ? "onb-animate-ring-breathe onb-animated" : ""}`}
            style={{
              width: `${ring.size}vmax`,
              height: `${ring.size}vmax`,
              opacity: ring.opacity,
              animationDuration: `${ring.duration}s`,
              animationDelay: `${ring.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0">
        {particles.map((particle) => (
          <div
            key={`particle-${particle.id}`}
            className={`onb-cosmic-particle ${animationEnabled ? "onb-animate-particle-float onb-animated" : ""}`}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              animationDuration: `${particle.duration}s`,
              animationDelay: `${particle.delay}s`,
              ["--onb-drift-distance" as string]: `${particle.driftDistance}px`,
            }}
          />
        ))}
      </div>

      <div
        className="absolute left-1/2 top-1/2 onb-readability-mask"
        style={{ opacity: preset.centerMaskOpacity }}
      />
      <div className="absolute inset-0 onb-vignette" style={{ opacity: preset.vignetteOpacity }} />
    </div>
  );
};
