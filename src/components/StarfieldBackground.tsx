import { useEffect, useMemo, useCallback, useRef, memo, type CSSProperties } from "react";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useTimeColors, type StarColor } from "@/hooks/useTimeColors";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { logger } from "@/utils/logger";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  animationDelay: number;
  animationDuration: number;
  colorSeed: number;
}

interface DustParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  driftDuration: number;
  driftDelay: number;
}

interface ShootingStar {
  id: number;
  delay: number;
  duration: number;
  startX: number;
  startY: number;
  angle: number;
}

export type StarfieldScene =
  | "default"
  | "quests-tempest"
  | "campaigns-summit"
  | "companion-sanctuary"
  | "profile-observatory";

interface StarfieldBackgroundProps {
  scene?: StarfieldScene;
}

interface ScenePreset {
  skyTint: string;
  accent: string;
  secondaryAccent: string;
  silhouette: string;
  detail: string;
  glow: string;
}

const SCENE_PRESETS: Record<StarfieldScene, ScenePreset> = {
  default: {
    skyTint: "hsl(236, 34%, 18%)",
    accent: "hsl(196, 70%, 58%)",
    secondaryAccent: "hsl(275, 72%, 62%)",
    silhouette: "hsl(238, 22%, 10%)",
    detail: "hsl(232, 26%, 14%)",
    glow: "hsl(45, 90%, 70%)",
  },
  "quests-tempest": {
    skyTint: "hsl(208, 46%, 24%)",
    accent: "hsl(193, 74%, 63%)",
    secondaryAccent: "hsl(226, 50%, 41%)",
    silhouette: "hsl(211, 26%, 10%)",
    detail: "hsl(208, 28%, 15%)",
    glow: "hsl(196, 78%, 72%)",
  },
  "campaigns-summit": {
    skyTint: "hsl(227, 40%, 22%)",
    accent: "hsl(156, 76%, 62%)",
    secondaryAccent: "hsl(45, 84%, 64%)",
    silhouette: "hsl(233, 22%, 10%)",
    detail: "hsl(227, 24%, 15%)",
    glow: "hsl(186, 72%, 68%)",
  },
  "companion-sanctuary": {
    skyTint: "hsl(251, 44%, 21%)",
    accent: "hsl(287, 82%, 70%)",
    secondaryAccent: "hsl(190, 78%, 64%)",
    silhouette: "hsl(245, 21%, 10%)",
    detail: "hsl(255, 27%, 16%)",
    glow: "hsl(44, 92%, 74%)",
  },
  "profile-observatory": {
    skyTint: "hsl(214, 31%, 20%)",
    accent: "hsl(169, 46%, 49%)",
    secondaryAccent: "hsl(35, 58%, 66%)",
    silhouette: "hsl(164, 24%, 9%)",
    detail: "hsl(206, 26%, 14%)",
    glow: "hsl(201, 70%, 64%)",
  },
};

const withAlpha = (color: string, alpha: number): string => (
  color.startsWith("hsl(") ? color.replace(")", ` / ${alpha})`) : color
);

const generateStars = (
  count: number,
  sizeMin: number,
  sizeMax: number,
  opacityMin: number,
  opacityMax: number,
): Star[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * (sizeMax - sizeMin) + sizeMin,
    opacity: Math.random() * (opacityMax - opacityMin) + opacityMin,
    animationDelay: Math.random() * 10,
    animationDuration: Math.random() * 4 + 4,
    colorSeed: Math.random(),
  }));
};

const generateDust = (count: number): DustParticle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 0.5 + 0.5,
    opacity: Math.random() * 0.15 + 0.1,
    driftDuration: Math.random() * 60 + 60,
    driftDelay: Math.random() * 30,
  }));
};

const generateShootingStars = (): ShootingStar[] => [
  { id: 1, delay: 5, duration: 90, startX: 15, startY: 10, angle: 35 },
  { id: 2, delay: 45, duration: 120, startX: 85, startY: 8, angle: 145 },
  { id: 3, delay: 75, duration: 150, startX: 50, startY: 5, angle: 80 },
];

const PARALLAX = {
  deepNebulae: 1,
  dust: 2,
  backgroundStars: 3,
  midNebulae: 4,
  midStars: 5,
  foregroundNebulae: 6,
  brightStars: 8,
};

const ScenicOrb = ({
  style,
}: {
  style: CSSProperties;
}) => (
  <div
    className="absolute rounded-full transition-colors [transition-duration:4000ms]"
    style={style}
  />
);

const ScenicPlane = ({
  style,
}: {
  style: CSSProperties;
}) => (
  <div
    className="absolute transition-colors [transition-duration:4000ms]"
    style={style}
  />
);

export const StarfieldBackground = memo(({ scene = "default" }: StarfieldBackgroundProps) => {
  const { isTabActive } = useMainTabVisibility();
  const { capabilities, signals } = useMotionProfile();
  const backgroundRef = useRef<HTMLDivElement>(null);
  const parallaxRafRef = useRef<number | null>(null);
  const parallaxTargetRef = useRef({ x: 0, y: 0 });
  const loggedModeRef = useRef<string | null>(null);
  const isNativeIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    const capacitor = (window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    return Boolean(capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === "ios");
  }, []);

  const shouldAnimateBackground = isTabActive
    && capabilities.allowBackgroundAnimation
    && !signals.isBackgrounded
    && !signals.prefersReducedMotion
    && !isNativeIOS;
  const shouldRunParallax = isTabActive
    && capabilities.allowParallax
    && !signals.isBackgrounded
    && !signals.prefersReducedMotion
    && !isNativeIOS;
  const useLiteMode = !shouldAnimateBackground;
  const { gamma, beta, permitted } = useDeviceOrientation({ enabled: shouldRunParallax });
  const { period, colors, rotationHue, starDistribution, getStarHSL, getStarGlow } = useTimeColors();
  const { presence: companionPresence } = useCompanionPresence();
  const scenePreset = SCENE_PRESETS[scene];
  const sceneMotionMode = shouldAnimateBackground ? "animated" : "static";

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const mode = !isTabActive ? "inactive" : useLiteMode ? "lite" : "full";
    if (mode === loggedModeRef.current) return;
    loggedModeRef.current = mode;

    logger.debug("Starfield background mode changed", {
      mode,
      scene,
      isTabActive,
      shouldAnimateBackground,
      shouldRunParallax,
      maxParticles: capabilities.maxParticles,
    });
  }, [capabilities.maxParticles, isTabActive, scene, shouldAnimateBackground, shouldRunParallax, useLiteMode]);

  const moodHueShift = useMemo(() => {
    const { mood } = companionPresence;

    let hueShift = 0;

    switch (mood) {
      case "joyful":
        hueShift = 10;
        break;
      case "content":
        hueShift = 5;
        break;
      case "neutral":
        hueShift = 0;
        break;
      case "reserved":
        hueShift = -5;
        break;
      case "quiet":
        hueShift = -10;
        break;
      case "dormant":
        hueShift = 0;
        break;
    }

    return hueShift;
  }, [companionPresence]);

  const scheduleParallaxUpdate = useCallback((x: number, y: number) => {
    parallaxTargetRef.current = { x, y };
    if (parallaxRafRef.current !== null) return;

    parallaxRafRef.current = requestAnimationFrame(() => {
      parallaxRafRef.current = null;
      if (!backgroundRef.current) return;
      backgroundRef.current.style.setProperty("--parallax-x", String(parallaxTargetRef.current.x));
      backgroundRef.current.style.setProperty("--parallax-y", String(parallaxTargetRef.current.y));
    });
  }, []);

  useEffect(() => {
    if (!shouldRunParallax) {
      scheduleParallaxUpdate(0, 0);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      scheduleParallaxUpdate(x, y);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [scheduleParallaxUpdate, shouldRunParallax]);

  useEffect(() => {
    if (!shouldRunParallax || !permitted) return;

    const x = Math.max(-1, Math.min(1, gamma / 30));
    const y = Math.max(-1, Math.min(1, (beta - 45) / 30));
    scheduleParallaxUpdate(x, y);
  }, [beta, gamma, permitted, scheduleParallaxUpdate, shouldRunParallax]);

  useEffect(() => {
    return () => {
      if (parallaxRafRef.current !== null) {
        cancelAnimationFrame(parallaxRafRef.current);
      }
    };
  }, []);

  const getParallaxStyle = useCallback((multiplier: number): CSSProperties => {
    if (!shouldRunParallax) return {};
    return {
      transform: `translate(calc(var(--parallax-x, 0) * ${multiplier}px), calc(var(--parallax-y, 0) * ${multiplier}px))`,
      transition: "transform 0.22s ease-out",
      willChange: "transform",
    };
  }, [shouldRunParallax]);

  const getStarColorFromSeed = useCallback((seed: number): StarColor => {
    const dist = starDistribution;
    let cumulative = 0;
    if ((cumulative += dist.orange) > seed && dist.orange > 0) return "orange";
    if ((cumulative += dist.gold) > seed) return "gold";
    if ((cumulative += dist.teal) > seed) return "teal";
    if ((cumulative += dist.pink) > seed) return "pink";
    if ((cumulative += dist.blue) > seed) return "blue";
    return "white";
  }, [starDistribution]);

  const normalizedParticleBudget = Math.max(4, capabilities.maxParticles);
  const particleCounts = useMemo(() => {
    if (!isTabActive) {
      return { dust: 0, background: 4, mid: 0, bright: 0 };
    }
    if (useLiteMode) {
      return { dust: 2, background: 6, mid: 2, bright: 1 };
    }
    return {
      dust: Math.max(8, Math.round(normalizedParticleBudget * 0.55)),
      background: Math.max(12, Math.round(normalizedParticleBudget * 0.6)),
      mid: Math.max(6, Math.round(normalizedParticleBudget * 0.34)),
      bright: Math.max(3, Math.round(normalizedParticleBudget * 0.2)),
    };
  }, [isTabActive, normalizedParticleBudget, useLiteMode]);

  const dustParticles = useMemo(() => generateDust(particleCounts.dust), [particleCounts.dust]);
  const backgroundStars = useMemo(
    () => generateStars(particleCounts.background, 0.8, 1.5, 0.3, 0.5),
    [particleCounts.background],
  );
  const midLayerStars = useMemo(
    () => generateStars(particleCounts.mid, 1.5, 2.5, 0.4, 0.7),
    [particleCounts.mid],
  );
  const brightStars = useMemo(
    () => generateStars(particleCounts.bright, 2.5, 4, 0.7, 1),
    [particleCounts.bright],
  );
  const shootingStars = useMemo(
    () => (shouldAnimateBackground ? generateShootingStars() : []),
    [shouldAnimateBackground],
  );

  const baseGradient = useMemo(() => {
    const gradients: Record<string, string> = {
      dawn: "linear-gradient(to bottom, hsl(350, 30%, 12%), hsl(25, 25%, 10%), hsl(240, 15%, 8%))",
      morning: "linear-gradient(to bottom, hsl(200, 35%, 12%), hsl(190, 25%, 10%), hsl(240, 15%, 8%))",
      afternoon: "linear-gradient(to bottom, hsl(35, 30%, 12%), hsl(180, 20%, 10%), hsl(240, 15%, 8%))",
      sunset: "linear-gradient(to bottom, hsl(340, 35%, 15%), hsl(20, 30%, 12%), hsl(270, 25%, 10%))",
      night: "linear-gradient(to bottom, hsl(240, 30%, 10%), hsl(250, 20%, 8%), hsl(0, 0%, 5%))",
    };
    return gradients[period];
  }, [period]);

  const hueShift = rotationHue * 0.1 + moodHueShift;
  const mode = !isTabActive ? "inactive" : useLiteMode ? "lite" : "full";

  const sceneLayers = useMemo(() => {
    if (scene === "default") return null;

    const sharedTone = withAlpha(colors.nebula1, useLiteMode ? 0.12 : 0.18);
    const sharedAccent = withAlpha(colors.accent, useLiteMode ? 0.1 : 0.16);
    const sharedGlow = withAlpha(colors.primary, useLiteMode ? 0.1 : 0.14);
    const gentleBreath = shouldAnimateBackground ? "cosmiq-scene-breathe 18s ease-in-out infinite" : "none";
    const weatherSweep = shouldAnimateBackground ? "cosmiq-weather-sweep 20s linear infinite" : "none";
    const auroraSway = shouldAnimateBackground ? "cosmiq-aurora-sway 24s ease-in-out infinite" : "none";

    if (scene === "quests-tempest") {
      return (
        <div
          className="absolute inset-0"
          data-starfield-scene-layer={scene}
          data-starfield-scene-motion={sceneMotionMode}
        >
          <ScenicPlane
            style={{
              inset: 0,
              background: `linear-gradient(180deg, ${withAlpha(scenePreset.skyTint, 0.42)} 0%, ${sharedTone} 34%, transparent 74%)`,
            }}
          />
          <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.deepNebulae + 1)}>
            <ScenicOrb
              style={{
                top: "-14%",
                left: "-8%",
                width: "52%",
                height: "36%",
                filter: useLiteMode ? "blur(80px)" : "blur(120px)",
                background: `radial-gradient(circle at center, ${withAlpha(scenePreset.accent, 0.24)}, transparent 72%)`,
                opacity: 0.85,
                animation: gentleBreath,
              }}
            />
            <ScenicOrb
              style={{
                top: "2%",
                right: "-6%",
                width: "46%",
                height: "28%",
                filter: useLiteMode ? "blur(72px)" : "blur(110px)",
                background: `radial-gradient(circle at center, ${sharedAccent}, transparent 74%)`,
                opacity: 0.72,
                animation: gentleBreath,
                animationDelay: "6s",
              }}
            />
          </div>
          <ScenicPlane
            style={{
              inset: 0,
              opacity: useLiteMode ? 0.09 : 0.16,
              backgroundImage: `repeating-linear-gradient(118deg, transparent 0 16px, ${withAlpha(scenePreset.glow, 0.85)} 18px 19px, transparent 21px 48px)`,
              animation: weatherSweep,
            }}
          />
          <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.midNebulae + 1)}>
            <ScenicPlane
              style={{
                left: "-6%",
                right: "-6%",
                bottom: "16%",
                height: "18%",
                opacity: 0.9,
                clipPath: "polygon(0 76%, 12% 58%, 28% 70%, 43% 38%, 61% 69%, 79% 44%, 100% 74%, 100% 100%, 0 100%)",
                background: `linear-gradient(180deg, ${withAlpha(scenePreset.secondaryAccent, 0.15)}, ${withAlpha(scenePreset.silhouette, 0.95)} 80%)`,
              }}
            />
            <ScenicPlane
              style={{
                left: "-10%",
                right: "-4%",
                bottom: "4%",
                height: "26%",
                opacity: 1,
                clipPath: "polygon(0 84%, 9% 60%, 24% 76%, 41% 48%, 59% 74%, 76% 44%, 91% 67%, 100% 58%, 100% 100%, 0 100%)",
                background: `linear-gradient(180deg, ${withAlpha(scenePreset.detail, 0.12)}, ${withAlpha(scenePreset.detail, 0.94)} 74%)`,
              }}
            />
          </div>
          <ScenicPlane
            style={{
              inset: 0,
              background: `linear-gradient(180deg, transparent 52%, ${withAlpha(scenePreset.silhouette, 0.22)} 68%, ${withAlpha(scenePreset.silhouette, 0.82)} 100%)`,
            }}
          />
        </div>
      );
    }

    if (scene === "campaigns-summit") {
      return (
        <div
          className="absolute inset-0"
          data-starfield-scene-layer={scene}
          data-starfield-scene-motion={sceneMotionMode}
        >
          <ScenicPlane
            style={{
              inset: 0,
              background: `linear-gradient(180deg, ${withAlpha(scenePreset.skyTint, 0.36)} 0%, transparent 72%)`,
            }}
          />
          <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.deepNebulae + 1)}>
            <ScenicPlane
              style={{
                top: "8%",
                left: "-14%",
                width: "128%",
                height: "24%",
                transform: "rotate(-8deg)",
                filter: useLiteMode ? "blur(58px)" : "blur(76px)",
                background: `linear-gradient(90deg, transparent 0%, ${withAlpha(scenePreset.accent, 0.42)} 28%, ${withAlpha(scenePreset.secondaryAccent, 0.28)} 58%, transparent 100%)`,
                opacity: 0.78,
                animation: auroraSway,
              }}
            />
            <ScenicPlane
              style={{
                top: "18%",
                left: "-8%",
                width: "122%",
                height: "18%",
                transform: "rotate(6deg)",
                filter: useLiteMode ? "blur(52px)" : "blur(70px)",
                background: `linear-gradient(90deg, transparent 0%, ${withAlpha(scenePreset.glow, 0.24)} 22%, ${sharedGlow} 55%, transparent 100%)`,
                opacity: 0.62,
                animation: auroraSway,
                animationDelay: "7s",
              }}
            />
          </div>
          <ScenicOrb
            style={{
              top: "18%",
              left: "50%",
              width: "26%",
              height: "16%",
              transform: "translateX(-50%)",
              filter: useLiteMode ? "blur(52px)" : "blur(72px)",
              background: `radial-gradient(circle at center, ${withAlpha(scenePreset.glow, 0.26)}, transparent 72%)`,
              opacity: 0.75,
              animation: gentleBreath,
            }}
          />
          <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.midNebulae + 1)}>
            <ScenicPlane
              style={{
                left: "-8%",
                right: "-8%",
                bottom: "14%",
                height: "24%",
                clipPath: "polygon(0 90%, 14% 74%, 30% 82%, 44% 34%, 54% 84%, 68% 60%, 86% 78%, 100% 62%, 100% 100%, 0 100%)",
                background: `linear-gradient(180deg, ${withAlpha(scenePreset.accent, 0.1)}, ${withAlpha(scenePreset.silhouette, 0.92)} 78%)`,
                opacity: 0.96,
              }}
            />
            <ScenicPlane
              style={{
                left: "-4%",
                right: "-4%",
                bottom: "4%",
                height: "22%",
                clipPath: "polygon(0 100%, 0 74%, 18% 66%, 35% 76%, 49% 44%, 58% 72%, 77% 54%, 100% 70%, 100% 100%)",
                background: `linear-gradient(180deg, ${withAlpha(scenePreset.detail, 0.1)}, ${withAlpha(scenePreset.detail, 0.95)} 74%)`,
              }}
            />
            <ScenicPlane
              style={{
                left: "44%",
                bottom: "19%",
                width: "6%",
                height: "10%",
                clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
                background: `linear-gradient(180deg, ${withAlpha(scenePreset.secondaryAccent, 0.88)}, ${withAlpha(scenePreset.glow, 0.18)})`,
                boxShadow: `0 0 26px ${withAlpha(scenePreset.glow, 0.26)}`,
                opacity: 0.85,
              }}
            />
          </div>
          <ScenicPlane
            style={{
              inset: 0,
              background: `linear-gradient(180deg, transparent 54%, ${withAlpha(scenePreset.silhouette, 0.15)} 70%, ${withAlpha(scenePreset.detail, 0.76)} 100%)`,
            }}
          />
        </div>
      );
    }

    if (scene === "companion-sanctuary") {
      return (
        <div
          className="absolute inset-0"
          data-starfield-scene-layer={scene}
          data-starfield-scene-motion={sceneMotionMode}
        >
          <ScenicPlane
            style={{
              inset: 0,
              background: `linear-gradient(180deg, ${withAlpha(scenePreset.skyTint, 0.28)} 0%, transparent 74%)`,
            }}
          />
          <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.deepNebulae + 1)}>
            <ScenicOrb
              style={{
                top: "10%",
                left: "50%",
                width: useLiteMode ? "54%" : "58%",
                height: useLiteMode ? "26%" : "30%",
                transform: "translateX(-50%)",
                filter: useLiteMode ? "blur(68px)" : "blur(96px)",
                background: `radial-gradient(circle at center, ${withAlpha(scenePreset.accent, 0.22)} 0%, ${sharedAccent} 44%, transparent 76%)`,
                opacity: 0.96,
                animation: gentleBreath,
              }}
            />
            <ScenicOrb
              style={{
                top: "22%",
                left: "18%",
                width: "24%",
                height: "18%",
                filter: useLiteMode ? "blur(56px)" : "blur(76px)",
                background: `radial-gradient(circle at center, ${withAlpha(scenePreset.secondaryAccent, 0.2)}, transparent 76%)`,
                opacity: 0.72,
                animation: gentleBreath,
                animationDelay: "5s",
              }}
            />
            <ScenicOrb
              style={{
                top: "26%",
                right: "16%",
                width: "26%",
                height: "18%",
                filter: useLiteMode ? "blur(56px)" : "blur(76px)",
                background: `radial-gradient(circle at center, ${withAlpha(scenePreset.glow, 0.18)}, transparent 76%)`,
                opacity: 0.68,
                animation: gentleBreath,
                animationDelay: "8s",
              }}
            />
          </div>
          <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.midNebulae)}>
            <ScenicPlane
              style={{
                left: "50%",
                top: "17%",
                width: "44%",
                height: "22%",
                transform: "translateX(-50%)",
                borderRadius: "999px",
                border: `1px solid ${withAlpha(scenePreset.glow, 0.26)}`,
                boxShadow: `0 0 0 1px ${withAlpha(scenePreset.accent, 0.08)} inset, 0 0 60px ${withAlpha(scenePreset.accent, 0.14)}`,
                opacity: 0.66,
              }}
            />
            <ScenicPlane
              style={{
                left: "50%",
                top: "14%",
                width: "62%",
                height: "30%",
                transform: "translateX(-50%)",
                borderRadius: "999px",
                border: `1px solid ${withAlpha(scenePreset.secondaryAccent, 0.12)}`,
                opacity: 0.35,
              }}
            />
          </div>
          <ScenicPlane
            style={{
              left: "50%",
              bottom: "8%",
              width: "88%",
              height: "28%",
              transform: "translateX(-50%)",
              borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
              filter: useLiteMode ? "blur(34px)" : "blur(44px)",
              background: `linear-gradient(180deg, transparent 0%, ${withAlpha(scenePreset.detail, 0.26)} 40%, ${withAlpha(scenePreset.silhouette, 0.92)} 100%)`,
              opacity: 0.92,
            }}
          />
          <ScenicPlane
            style={{
              inset: 0,
              background: `radial-gradient(circle at 50% 28%, transparent 0%, transparent 24%, ${withAlpha(scenePreset.silhouette, 0.18)} 62%, ${withAlpha(scenePreset.detail, 0.62)} 100%)`,
            }}
          />
        </div>
      );
    }

    return (
      <div
        className="absolute inset-0"
        data-starfield-scene-layer={scene}
        data-starfield-scene-motion={sceneMotionMode}
      >
        <ScenicPlane
          style={{
            inset: 0,
            background: `linear-gradient(180deg, ${withAlpha(scenePreset.skyTint, 0.34)} 0%, transparent 68%)`,
          }}
        />
        <ScenicPlane
          style={{
            right: "9%",
            bottom: "13%",
            width: "20%",
            height: "12%",
            borderRadius: "999px 999px 22px 22px / 999px 999px 16px 16px",
            background: `linear-gradient(180deg, ${withAlpha(scenePreset.secondaryAccent, 0.08)}, ${withAlpha(scenePreset.detail, 0.92)} 76%)`,
            boxShadow: `0 0 0 1px ${withAlpha(scenePreset.glow, 0.08)} inset`,
            opacity: 0.96,
          }}
        />
        <ScenicPlane
          style={{
            right: "14%",
            bottom: "23%",
            width: "10%",
            height: "10%",
            borderRadius: "999px 999px 14px 14px",
            background: `linear-gradient(180deg, ${withAlpha(scenePreset.glow, 0.22)}, ${withAlpha(scenePreset.detail, 0.82)} 86%)`,
            opacity: 0.88,
          }}
        />
        <ScenicPlane
          style={{
            right: "18%",
            bottom: "26%",
            width: "3%",
            height: "3%",
            borderRadius: "999px",
            background: withAlpha(scenePreset.glow, 0.9),
            boxShadow: `0 0 18px ${withAlpha(scenePreset.glow, 0.48)}`,
            opacity: 0.95,
          }}
        />
        <ScenicPlane
          style={{
            right: "13%",
            bottom: "18%",
            width: "12%",
            height: "24%",
            clipPath: "polygon(50% 0%, 70% 54%, 100% 100%, 0 100%, 28% 54%)",
            background: `linear-gradient(180deg, ${withAlpha(scenePreset.glow, 0.18)} 0%, ${withAlpha(scenePreset.detail, 0.12)} 35%, transparent 100%)`,
            opacity: 0.32,
            animation: shouldAnimateBackground ? "cosmiq-scene-breathe 16s ease-in-out infinite" : "none",
          }}
        />
        <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.midNebulae)}>
          <ScenicPlane
            style={{
              left: "0%",
              bottom: "8%",
              width: "12%",
              height: "18%",
              clipPath: "polygon(50% 0%, 100% 100%, 0 100%)",
              background: `linear-gradient(180deg, ${withAlpha(scenePreset.detail, 0.2)}, ${withAlpha(scenePreset.silhouette, 0.92)} 78%)`,
              opacity: 0.92,
            }}
          />
          <ScenicPlane
            style={{
              left: "8%",
              bottom: "8%",
              width: "14%",
              height: "22%",
              clipPath: "polygon(50% 0%, 100% 100%, 0 100%)",
              background: `linear-gradient(180deg, ${withAlpha(scenePreset.detail, 0.18)}, ${withAlpha(scenePreset.silhouette, 0.94)} 78%)`,
              opacity: 0.88,
            }}
          />
          <ScenicPlane
            style={{
              left: "18%",
              bottom: "8%",
              width: "10%",
              height: "16%",
              clipPath: "polygon(50% 0%, 100% 100%, 0 100%)",
              background: `linear-gradient(180deg, ${withAlpha(scenePreset.detail, 0.16)}, ${withAlpha(scenePreset.silhouette, 0.96)} 78%)`,
              opacity: 0.8,
            }}
          />
        </div>
        <ScenicOrb
          style={{
            top: "16%",
            left: "16%",
            width: "26%",
            height: "18%",
            filter: useLiteMode ? "blur(58px)" : "blur(78px)",
            background: `radial-gradient(circle at center, ${withAlpha(scenePreset.accent, 0.16)}, transparent 76%)`,
            opacity: 0.7,
            animation: shouldAnimateBackground ? "cosmiq-scene-breathe 18s ease-in-out infinite" : "none",
          }}
        />
        <ScenicPlane
          style={{
            inset: 0,
            background: `linear-gradient(180deg, transparent 54%, ${withAlpha(scenePreset.silhouette, 0.16)} 72%, ${withAlpha(scenePreset.detail, 0.78)} 100%)`,
          }}
        />
      </div>
    );
  }, [
    colors.accent,
    colors.nebula1,
    colors.primary,
    getParallaxStyle,
    scene,
    sceneMotionMode,
    scenePreset,
    shouldAnimateBackground,
    useLiteMode,
  ]);

  return (
    <div
      ref={backgroundRef}
      className="fixed inset-0 overflow-hidden pointer-events-none -z-10"
      data-starfield-mode={mode}
      data-starfield-scene={scene}
      data-starfield-scene-motion={sceneMotionMode}
    >
      <div
        className="absolute inset-0 transition-all [transition-duration:3000ms]"
        style={{ background: baseGradient }}
      />

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.deepNebulae)}>
        <div
          className="absolute rounded-full transition-colors [transition-duration:5000ms]"
          style={{
            top: useLiteMode ? "-8%" : "-15%",
            right: useLiteMode ? "-6%" : "-10%",
            width: useLiteMode ? "560px" : "900px",
            height: useLiteMode ? "560px" : "900px",
            filter: useLiteMode ? "blur(90px)" : "blur(150px)",
            background: `radial-gradient(ellipse at center, ${withAlpha(colors.nebula1, 0.25)}, transparent 70%)`,
            animation: shouldAnimateBackground ? "nebula-drift-slow 55s ease-in-out infinite" : "none",
          }}
        />
        <div
          className="absolute rounded-full transition-colors [transition-duration:5000ms]"
          style={{
            bottom: useLiteMode ? "-10%" : "-20%",
            left: useLiteMode ? "-8%" : "-15%",
            width: useLiteMode ? "500px" : "800px",
            height: useLiteMode ? "500px" : "800px",
            filter: useLiteMode ? "blur(80px)" : "blur(140px)",
            background: `radial-gradient(ellipse at center, ${withAlpha(colors.nebula2, 0.2)}, transparent 70%)`,
            animation: shouldAnimateBackground ? "nebula-drift-slow 65s ease-in-out infinite reverse" : "none",
          }}
        />
      </div>

      {shouldAnimateBackground && dustParticles.length > 0 && (
        <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.dust)}>
          {dustParticles.map((particle) => (
            <div
              key={`dust-${particle.id}`}
              className="absolute rounded-full transition-colors [transition-duration:3000ms]"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                opacity: particle.opacity,
                backgroundColor: withAlpha(colors.nebula3, 0.4),
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.backgroundStars)}>
        {backgroundStars.map((star) => {
          const starColor = getStarColorFromSeed(star.colorSeed);
          return (
            <div
              key={`bg-star-${star.id}`}
              className="absolute rounded-full transition-colors [transition-duration:2000ms]"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
                backgroundColor: getStarHSL(starColor, hueShift),
                boxShadow: getStarGlow(starColor, star.opacity * 0.5, hueShift),
                animation: shouldAnimateBackground
                  ? `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite`
                  : "none",
              }}
            />
          );
        })}
      </div>

      {sceneLayers}

      {shouldAnimateBackground && (
        <div className="absolute inset-0 opacity-30" style={getParallaxStyle(PARALLAX.midNebulae)}>
          <div
            className="absolute w-[600px] h-[300px] blur-[100px] -rotate-12 transition-colors [transition-duration:5000ms]"
            style={{
              top: "10%",
              right: "5%",
              background: `linear-gradient(135deg, ${withAlpha(colors.nebula1, 0.35)}, ${withAlpha(colors.nebula3, 0.15)}, transparent)`,
            }}
          />
          <div
            className="absolute w-[500px] h-[250px] blur-[90px] rotate-12 transition-colors [transition-duration:5000ms]"
            style={{
              bottom: "15%",
              left: "10%",
              background: `linear-gradient(135deg, ${withAlpha(colors.nebula2, 0.3)}, ${withAlpha(colors.accent, 0.15)}, transparent)`,
            }}
          />
        </div>
      )}

      {shouldAnimateBackground && midLayerStars.length > 0 && (
        <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.midStars)}>
          {midLayerStars.map((star) => {
            const starColor = getStarColorFromSeed(star.colorSeed);
            return (
              <div
                key={`mid-star-${star.id}`}
                className="absolute rounded-full transition-colors [transition-duration:2000ms]"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: `${star.size}px`,
                  height: `${star.size}px`,
                  opacity: star.opacity,
                  backgroundColor: getStarHSL(starColor, hueShift),
                  boxShadow: getStarGlow(starColor, star.opacity, hueShift),
                }}
              />
            );
          })}
        </div>
      )}

      {shouldAnimateBackground && (
        <div className="absolute inset-0 opacity-25" style={getParallaxStyle(PARALLAX.foregroundNebulae)}>
          <div
            className="absolute w-[350px] h-[350px] rounded-full blur-[70px] transition-colors [transition-duration:5000ms]"
            style={{
              top: "25%",
              right: "20%",
              background: `radial-gradient(ellipse at center, ${withAlpha(colors.primary, 0.5)}, transparent 60%)`,
              animation: "nebula-pulse 25s ease-in-out infinite",
            }}
          />
          <div
            className="absolute w-[300px] h-[300px] rounded-full blur-[60px] transition-colors [transition-duration:5000ms]"
            style={{
              bottom: "30%",
              left: "25%",
              background: `radial-gradient(ellipse at center, ${withAlpha(colors.accent, 0.45)}, transparent 60%)`,
              animation: "nebula-pulse 30s ease-in-out 8s infinite reverse",
            }}
          />
        </div>
      )}

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.brightStars)}>
        {brightStars.map((star) => {
          const starColor = getStarColorFromSeed(star.colorSeed);
          const hsl = getStarHSL(starColor, hueShift);
          return (
            <div
              key={`bright-star-${star.id}`}
              className="absolute rounded-full transition-colors [transition-duration:2000ms]"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                backgroundColor: hsl,
                boxShadow: `${getStarGlow(starColor, 1, hueShift)}, 0 0 20px ${hsl}`,
              }}
            />
          );
        })}
      </div>

      {shouldAnimateBackground && shootingStars.map((shootingStar) => (
        <div
          key={`shooting-${shootingStar.id}`}
          className="absolute w-[3px] h-[3px] rounded-full"
          style={{
            left: `${shootingStar.startX}%`,
            top: `${shootingStar.startY}%`,
            background: "linear-gradient(to right, transparent, white, white)",
            boxShadow: "0 0 6px 2px rgba(255, 255, 255, 0.9), -20px 0 15px rgba(255, 255, 255, 0.4), -40px 0 25px rgba(255, 255, 255, 0.2)",
            animation: `shooting-star-${shootingStar.id} ${shootingStar.duration}s ease-out ${shootingStar.delay}s infinite`,
          }}
        />
      ))}

      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, ${withAlpha(scenePreset.skyTint, 0.12)} 0%, transparent 16%, transparent 66%, ${withAlpha(scenePreset.detail, 0.42)} 100%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at 50% 34%, transparent 0%, transparent 28%, ${withAlpha(scenePreset.silhouette, 0.14)} 72%, ${withAlpha(scenePreset.silhouette, 0.5)} 100%)`,
        }}
      />
    </div>
  );
});

StarfieldBackground.displayName = "StarfieldBackground";
