import { useMemo, type CSSProperties } from "react";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import {
  galaxyPortalBackground,
  getStaticBackgroundSrcSet,
  type StaticBackgroundAsset,
  welcomeBackground,
  cosmicPath1Background,
  cosmicPath2Background,
} from "@/assets/backgrounds";
import type { FactionType } from "./FactionSelector";

export type OnboardingBackdropStage =
  | "prologue"
  | "destiny"
  | "questionnaire"
  | "calculating"
  | "journey-begins";

export type OnboardingMotionLevel = "subtle" | "balanced" | "high";

export interface OnboardingBackdropPreset {
  background: StaticBackgroundAsset;
  mobileObjectPosition: string;
  desktopObjectPosition: string;
  hazeOpacity: number;
  accentStrength: number;
  centerMaskOpacity: number;
  vignetteOpacity: number;
  topScrimOpacity: number;
  bottomScrimOpacity: number;
}

export const ONBOARDING_BACKDROP_PRESETS: Record<OnboardingBackdropStage, OnboardingBackdropPreset> = {
  prologue: {
    background: welcomeBackground,
    mobileObjectPosition: "50% 36%",
    desktopObjectPosition: "50% 42%",
    hazeOpacity: 0.14,
    accentStrength: 0.12,
    centerMaskOpacity: 0.44,
    vignetteOpacity: 0.44,
    topScrimOpacity: 0.34,
    bottomScrimOpacity: 0.52,
  },
  destiny: {
    background: galaxyPortalBackground,
    mobileObjectPosition: "50% 34%",
    desktopObjectPosition: "50% 40%",
    hazeOpacity: 0.16,
    accentStrength: 0.12,
    centerMaskOpacity: 0.38,
    vignetteOpacity: 0.48,
    topScrimOpacity: 0.3,
    bottomScrimOpacity: 0.48,
  },
  questionnaire: {
    background: cosmicPath1Background,
    mobileObjectPosition: "50% 28%",
    desktopObjectPosition: "50% 34%",
    hazeOpacity: 0.18,
    accentStrength: 0.14,
    centerMaskOpacity: 0.46,
    vignetteOpacity: 0.56,
    topScrimOpacity: 0.42,
    bottomScrimOpacity: 0.58,
  },
  calculating: {
    background: cosmicPath1Background,
    mobileObjectPosition: "50% 24%",
    desktopObjectPosition: "50% 30%",
    hazeOpacity: 0.2,
    accentStrength: 0.16,
    centerMaskOpacity: 0.5,
    vignetteOpacity: 0.6,
    topScrimOpacity: 0.48,
    bottomScrimOpacity: 0.66,
  },
  "journey-begins": {
    background: cosmicPath2Background,
    mobileObjectPosition: "50% 26%",
    desktopObjectPosition: "50% 36%",
    hazeOpacity: 0.16,
    accentStrength: 0.12,
    centerMaskOpacity: 0.42,
    vignetteOpacity: 0.52,
    topScrimOpacity: 0.38,
    bottomScrimOpacity: 0.56,
  },
};

const FACTION_ACCENTS: Record<FactionType, string> = {
  starfall: "20 100% 58%",
  void: "272 78% 60%",
  stellar: "198 86% 62%",
};

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

  const particles = useMemo<Particle[]>(() => {
    const baseCount = motionLevel === "high" ? 8 : motionLevel === "subtle" ? 4 : 6;
    const particleCount = isReducedMotion ? 0 : Math.min(baseCount, capabilities.maxParticles);
    return Array.from({ length: particleCount }, (_, index) => ({
      id: index,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.4 + 0.8,
      opacity: Math.random() * 0.22 + 0.1,
      delay: Math.random() * 4,
      duration: Math.random() * 10 + 14,
      driftDistance: Math.random() * 20 + 12,
    }));
  }, [capabilities.maxParticles, isReducedMotion, motionLevel, stage]);

  const factionTintStyle = useMemo<CSSProperties | undefined>(() => {
    if (!factionAccent) return undefined;
    return {
      ["--onb-faction-accent" as string]: factionAccent,
      opacity: preset.accentStrength,
    };
  }, [factionAccent, preset.accentStrength]);

  const backgroundStyle = useMemo<CSSProperties>(
    () => ({
      ["--onb-photo-mobile-position" as string]: preset.mobileObjectPosition,
      ["--onb-photo-desktop-position" as string]: preset.desktopObjectPosition,
    }),
    [preset.desktopObjectPosition, preset.mobileObjectPosition],
  );

  const backgroundSrcSet = useMemo(
    () => getStaticBackgroundSrcSet(preset.background),
    [preset.background],
  );

  const scrimStyle = useMemo<CSSProperties>(
    () => ({
      ["--onb-top-scrim-opacity" as string]: `${preset.topScrimOpacity}`,
      ["--onb-bottom-scrim-opacity" as string]: `${preset.bottomScrimOpacity}`,
    }),
    [preset.bottomScrimOpacity, preset.topScrimOpacity],
  );

  return (
    <div
      className="onb-cosmic-backdrop absolute inset-0 z-0 overflow-hidden pointer-events-none"
      data-testid="onb-cosmic-backdrop"
      data-stage={stage}
      data-reduced-motion={isReducedMotion}
    >
      <div className="absolute inset-0 onb-cosmic-base" />
      <picture className="absolute inset-0">
        <source srcSet={backgroundSrcSet} />
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover onb-photo-backdrop"
          data-testid="onb-photo-backdrop"
          src={preset.background.src}
          style={backgroundStyle}
        />
      </picture>

      <div className="absolute inset-0 onb-photo-scrim" style={scrimStyle} />

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
