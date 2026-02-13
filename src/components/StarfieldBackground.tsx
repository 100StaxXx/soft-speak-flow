import { useEffect, useMemo, useCallback, useRef, memo, useState } from "react";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useTimeColors, StarColor } from "@/hooks/useTimeColors";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useMotionProfile } from "@/hooks/useMotionProfile";
import { useMainTabVisibility } from "@/contexts/MainTabVisibilityContext";

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
}

interface ShootingStar {
  id: number;
  delay: number;
  duration: number;
  startX: number;
  startY: number;
  angle: number;
}

type StarfieldPalette = "time-adaptive" | "cool-night";
type StarfieldQuality = "auto" | "lite" | "full";
type StarfieldIntensity = "low" | "medium" | "high";
type StarfieldParallaxMode = "off" | "pointer" | "device";

interface StarfieldBackgroundProps {
  palette?: StarfieldPalette;
  quality?: StarfieldQuality;
  intensity?: StarfieldIntensity;
  parallax?: StarfieldParallaxMode;
}

interface StarfieldColorPalette {
  primary: string;
  accent: string;
  nebula1: string;
  nebula2: string;
  nebula3: string;
}

const COOL_NIGHT_GRADIENT =
  "linear-gradient(to bottom, hsl(240, 30%, 10%), hsl(250, 20%, 8%), hsl(0, 0%, 5%))";

const COOL_NIGHT_COLORS: StarfieldColorPalette = {
  primary: "hsl(252, 70%, 62%)",
  accent: "hsl(205, 80%, 66%)",
  nebula1: "hsl(265, 72%, 58%)",
  nebula2: "hsl(224, 68%, 56%)",
  nebula3: "hsl(286, 60%, 62%)",
};

const COOL_NIGHT_STAR_DISTRIBUTION = {
  white: 0.45,
  blue: 0.3,
  pink: 0.15,
  gold: 0,
  teal: 0.1,
  orange: 0,
};

const INTENSITY_SCALE: Record<StarfieldIntensity, number> = {
  low: 0.72,
  medium: 1,
  high: 1.24,
};

const QUALITY_COUNTS = {
  lite: {
    dust: 8,
    backgroundStars: 10,
    midLayerStars: 5,
    brightStars: 2,
    shootingStars: 0,
  },
  full: {
    dust: 14,
    backgroundStars: 14,
    midLayerStars: 8,
    brightStars: 4,
    shootingStars: 3,
  },
};

const PARALLAX = {
  deepNebulae: 1,
  dust: 2,
  backgroundStars: 3,
  midNebulae: 4,
  midStars: 5,
  foregroundNebulae: 6,
  brightStars: 8,
};

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
  }));
};

const generateShootingStars = (): ShootingStar[] => [
  { id: 1, delay: 5, duration: 90, startX: 15, startY: 10, angle: 35 },
  { id: 2, delay: 45, duration: 120, startX: 85, startY: 8, angle: 145 },
  { id: 3, delay: 75, duration: 150, startX: 50, startY: 5, angle: 80 },
];

export const StarfieldBackground = memo(({
  palette = "time-adaptive",
  quality = "auto",
  intensity = "medium",
  parallax = "pointer",
}: StarfieldBackgroundProps) => {
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const backgroundRef = useRef<HTMLDivElement>(null);
  const parallaxRafRef = useRef<number | null>(null);
  const parallaxTargetRef = useRef({ x: 0, y: 0 });
  const { profile, capabilities } = useMotionProfile();
  const { isTabActive } = useMainTabVisibility();
  const shouldUseDeviceParallax =
    parallax === "device"
    && capabilities.allowParallax
    && profile !== "reduced"
    && isDocumentVisible
    && isTabActive;
  const { gamma, beta, permitted } = useDeviceOrientation({ enabled: shouldUseDeviceParallax });
  const { period, colors, rotationHue, starDistribution, getStarHSL, getStarGlow } = useTimeColors();
  const { presence: companionPresence } = useCompanionPresence();

  const isSceneActive = isDocumentVisible && isTabActive;

  const resolvedQuality = useMemo<"lite" | "full">(() => {
    if (quality === "lite" || quality === "full") return quality;
    if (profile === "enhanced") return "full";
    return "lite";
  }, [profile, quality]);

  const parallaxMode = useMemo<StarfieldParallaxMode>(() => {
    if (!capabilities.allowParallax || !isSceneActive || profile === "reduced") {
      return "off";
    }
    return parallax;
  }, [capabilities.allowParallax, isSceneActive, parallax, profile]);

  const activeColors = useMemo<StarfieldColorPalette>(
    () => (palette === "cool-night" ? COOL_NIGHT_COLORS : colors),
    [palette, colors],
  );

  const activeStarDistribution = useMemo(
    () => (palette === "cool-night" ? COOL_NIGHT_STAR_DISTRIBUTION : starDistribution),
    [palette, starDistribution],
  );

  const layerCounts = useMemo(() => {
    const base = QUALITY_COUNTS[resolvedQuality];
    const scale = INTENSITY_SCALE[intensity];

    const scaled = {
      dust: Math.round(base.dust * scale),
      backgroundStars: Math.round(base.backgroundStars * scale),
      midLayerStars: Math.round(base.midLayerStars * scale),
      brightStars: Math.round(base.brightStars * scale),
      shootingStars: Math.max(0, Math.round(base.shootingStars * scale)),
    };

    const totalParticles = scaled.dust + scaled.backgroundStars + scaled.midLayerStars + scaled.brightStars;
    if (capabilities.maxParticles <= 0 || totalParticles <= 0) {
      return {
        dust: 0,
        backgroundStars: 0,
        midLayerStars: 0,
        brightStars: 0,
        shootingStars: 0,
      };
    }

    if (totalParticles <= capabilities.maxParticles) {
      return scaled;
    }

    const ratio = capabilities.maxParticles / totalParticles;
    return {
      dust: Math.max(1, Math.floor(scaled.dust * ratio)),
      backgroundStars: Math.max(1, Math.floor(scaled.backgroundStars * ratio)),
      midLayerStars: Math.max(1, Math.floor(scaled.midLayerStars * ratio)),
      brightStars: Math.max(1, Math.floor(scaled.brightStars * ratio)),
      shootingStars: Math.max(0, Math.floor(scaled.shootingStars * ratio)),
    };
  }, [capabilities.maxParticles, intensity, resolvedQuality]);

  const allowAnimation = capabilities.allowBackgroundAnimation && isSceneActive && profile !== "reduced";

  const moodHueShift = useMemo(() => {
    const { mood } = companionPresence;
    switch (mood) {
      case "joyful":
        return 10;
      case "content":
        return 5;
      case "reserved":
        return -5;
      case "quiet":
        return -10;
      default:
        return 0;
    }
  }, [companionPresence]);

  useEffect(() => {
    const handleVisibility = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

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
    if (parallaxMode !== "pointer") {
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
  }, [parallaxMode, scheduleParallaxUpdate]);

  useEffect(() => {
    if (parallaxMode !== "device" || !permitted || !isSceneActive) {
      return;
    }

    const x = Math.max(-1, Math.min(1, gamma / 30));
    const y = Math.max(-1, Math.min(1, (beta - 45) / 30));
    scheduleParallaxUpdate(x, y);
  }, [beta, gamma, isSceneActive, parallaxMode, permitted, scheduleParallaxUpdate]);

  useEffect(() => {
    return () => {
      if (parallaxRafRef.current !== null) {
        cancelAnimationFrame(parallaxRafRef.current);
      }
    };
  }, []);

  const getParallaxStyle = useCallback((multiplier: number) => {
    if (parallaxMode === "off") return {};

    return {
      transform: `translate(calc(var(--parallax-x, 0) * ${multiplier}px), calc(var(--parallax-y, 0) * ${multiplier}px))`,
      transition: "transform 0.22s ease-out",
      willChange: "transform" as const,
    };
  }, [parallaxMode]);

  const getStarColorFromSeed = useCallback((seed: number): StarColor => {
    const dist = activeStarDistribution;
    let cumulative = 0;
    if ((cumulative += dist.orange) > seed && dist.orange > 0) return "orange";
    if ((cumulative += dist.gold) > seed) return "gold";
    if ((cumulative += dist.teal) > seed) return "teal";
    if ((cumulative += dist.pink) > seed) return "pink";
    if ((cumulative += dist.blue) > seed) return "blue";
    return "white";
  }, [activeStarDistribution]);

  const dustParticles = useMemo(
    () => generateDust(layerCounts.dust),
    [layerCounts.dust],
  );
  const backgroundStars = useMemo(
    () => generateStars(layerCounts.backgroundStars, 0.8, 1.5, 0.3, 0.5),
    [layerCounts.backgroundStars],
  );
  const midLayerStars = useMemo(
    () => generateStars(layerCounts.midLayerStars, 1.5, 2.5, 0.4, 0.7),
    [layerCounts.midLayerStars],
  );
  const brightStars = useMemo(
    () => generateStars(layerCounts.brightStars, 2.5, 4, 0.7, 1),
    [layerCounts.brightStars],
  );
  const shootingStars = useMemo(
    () => (layerCounts.shootingStars > 0 ? generateShootingStars().slice(0, layerCounts.shootingStars) : []),
    [layerCounts.shootingStars],
  );

  const baseGradient = useMemo(() => {
    if (palette === "cool-night") {
      return COOL_NIGHT_GRADIENT;
    }

    const gradients: Record<string, string> = {
      dawn: "linear-gradient(to bottom, hsl(350, 30%, 12%), hsl(25, 25%, 10%), hsl(240, 15%, 8%))",
      morning: "linear-gradient(to bottom, hsl(200, 35%, 12%), hsl(190, 25%, 10%), hsl(240, 15%, 8%))",
      afternoon: "linear-gradient(to bottom, hsl(35, 30%, 12%), hsl(180, 20%, 10%), hsl(240, 15%, 8%))",
      sunset: "linear-gradient(to bottom, hsl(340, 35%, 15%), hsl(20, 30%, 12%), hsl(270, 25%, 10%))",
      night: "linear-gradient(to bottom, hsl(240, 30%, 10%), hsl(250, 20%, 8%), hsl(0, 0%, 5%))",
    };
    return gradients[period];
  }, [palette, period]);

  const hueShift = (palette === "cool-night" ? 0 : rotationHue * 0.1) + Math.max(-8, Math.min(8, moodHueShift));

  return (
    <div
      ref={backgroundRef}
      className="fixed inset-0 overflow-hidden pointer-events-none -z-10"
      data-starfield-active={isSceneActive}
      data-starfield-quality={resolvedQuality}
      data-starfield-intensity={intensity}
      data-starfield-parallax={parallaxMode}
      data-starfield-animated={allowAnimation}
    >
      <div
        className="absolute inset-0 transition-all [transition-duration:3000ms]"
        style={{ background: baseGradient }}
      />

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.deepNebulae)}>
        <div
          className="absolute w-[900px] h-[900px] rounded-full blur-[150px] transition-colors [transition-duration:5000ms]"
          style={{
            top: "-15%",
            right: "-10%",
            background: `radial-gradient(ellipse at center, ${activeColors.nebula1.replace(")", " / 0.25)")}, transparent 70%)`,
            animation: allowAnimation ? "nebula-drift-slow 55s ease-in-out infinite" : "none",
          }}
        />
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[140px] transition-colors [transition-duration:5000ms]"
          style={{
            bottom: "-20%",
            left: "-15%",
            background: `radial-gradient(ellipse at center, ${activeColors.nebula2.replace(")", " / 0.2)")}, transparent 70%)`,
            animation: allowAnimation ? "nebula-drift-slow 65s ease-in-out infinite reverse" : "none",
          }}
        />
      </div>

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.dust)}>
        {dustParticles.map((particle) => (
          <div
            key={`dust-${particle.id}`}
            data-star-layer="dust"
            className="absolute rounded-full transition-colors [transition-duration:3000ms]"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity,
              backgroundColor: `${activeColors.nebula3.replace(")", " / 0.4)")}`,
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.backgroundStars)}>
        {backgroundStars.map((star) => {
          const starColor = getStarColorFromSeed(star.colorSeed);
          return (
            <div
              key={`bg-star-${star.id}`}
              data-star-layer="background-star"
              className="absolute rounded-full transition-colors [transition-duration:2000ms]"
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                width: `${star.size}px`,
                height: `${star.size}px`,
                opacity: star.opacity,
                backgroundColor: getStarHSL(starColor, hueShift),
                boxShadow: getStarGlow(starColor, star.opacity * 0.5, hueShift),
                animation: allowAnimation
                  ? `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite`
                  : "none",
              }}
            />
          );
        })}
      </div>

      <div className="absolute inset-0 opacity-30" style={getParallaxStyle(PARALLAX.midNebulae)}>
        <div
          className="absolute w-[600px] h-[300px] blur-[100px] -rotate-12 transition-colors [transition-duration:5000ms]"
          style={{
            top: "10%",
            right: "5%",
            background: `linear-gradient(135deg, ${activeColors.nebula1.replace(")", " / 0.35)")}, ${activeColors.nebula3.replace(")", " / 0.15)")}, transparent)`,
          }}
        />
        <div
          className="absolute w-[500px] h-[250px] blur-[90px] rotate-12 transition-colors [transition-duration:5000ms]"
          style={{
            bottom: "15%",
            left: "10%",
            background: `linear-gradient(135deg, ${activeColors.nebula2.replace(")", " / 0.3)")}, ${activeColors.accent.replace(")", " / 0.15)")}, transparent)`,
          }}
        />
      </div>

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.midStars)}>
        {midLayerStars.map((star) => {
          const starColor = getStarColorFromSeed(star.colorSeed);
          return (
            <div
              key={`mid-star-${star.id}`}
              data-star-layer="mid-star"
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

      <div className="absolute inset-0 opacity-25" style={getParallaxStyle(PARALLAX.foregroundNebulae)}>
        <div
          className="absolute w-[350px] h-[350px] rounded-full blur-[70px] transition-colors [transition-duration:5000ms]"
          style={{
            top: "25%",
            right: "20%",
            background: `radial-gradient(ellipse at center, ${activeColors.primary.replace(")", " / 0.5)")}, transparent 60%)`,
            animation: allowAnimation ? "nebula-pulse 25s ease-in-out infinite" : "none",
          }}
        />
        <div
          className="absolute w-[300px] h-[300px] rounded-full blur-[60px] transition-colors [transition-duration:5000ms]"
          style={{
            bottom: "30%",
            left: "25%",
            background: `radial-gradient(ellipse at center, ${activeColors.accent.replace(")", " / 0.45)")}, transparent 60%)`,
            animation: allowAnimation ? "nebula-pulse 30s ease-in-out 8s infinite reverse" : "none",
          }}
        />
      </div>

      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.brightStars)}>
        {brightStars.map((star) => {
          const starColor = getStarColorFromSeed(star.colorSeed);
          const hsl = getStarHSL(starColor, hueShift);
          return (
            <div
              key={`bright-star-${star.id}`}
              data-star-layer="bright-star"
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

      {allowAnimation && shootingStars.map((shootingStar) => (
        <div
          key={`shooting-${shootingStar.id}`}
          data-star-layer="shooting-star"
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
    </div>
  );
});

StarfieldBackground.displayName = "StarfieldBackground";
