import { useEffect, useState, useMemo, useCallback, useRef, memo } from "react";
import { useDeviceOrientation } from "@/hooks/useDeviceOrientation";
import { useTimeColors, StarColor } from "@/hooks/useTimeColors";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  animationDelay: number;
  animationDuration: number;
  colorSeed: number; // Use seed instead of fixed color for dynamic updates
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

// Generate stars for a specific layer
const generateStars = (count: number, sizeMin: number, sizeMax: number, opacityMin: number, opacityMax: number): Star[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * (sizeMax - sizeMin) + sizeMin,
    opacity: Math.random() * (opacityMax - opacityMin) + opacityMin,
    animationDelay: Math.random() * 10,
    animationDuration: Math.random() * 4 + 4,
    colorSeed: Math.random(), // Store seed for color determination
  }));
};

// Generate dust particles
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

// Generate shooting stars with varied directions - long cycles so they appear rarely
const generateShootingStars = (): ShootingStar[] => [
  { id: 1, delay: 5, duration: 90, startX: 15, startY: 10, angle: 35 },
  { id: 2, delay: 45, duration: 120, startX: 85, startY: 8, angle: 145 },
  { id: 3, delay: 75, duration: 150, startX: 50, startY: 5, angle: 80 },
];

// Parallax multipliers for each layer (deeper = slower)
const PARALLAX = {
  deepNebulae: 1,
  dust: 2,
  backgroundStars: 3,
  midNebulae: 4,
  midStars: 5,
  foregroundNebulae: 6,
  brightStars: 8,
};

export const StarfieldBackground = memo(() => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const parallaxRafRef = useRef<number | null>(null);
  const parallaxTargetRef = useRef({ x: 0, y: 0 });
  const isNativeIOS = useMemo(() => {
    if (typeof window === "undefined") return false;
    const capacitor = (window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    return Boolean(capacitor?.isNativePlatform?.() && capacitor?.getPlatform?.() === "ios");
  }, []);
  const useLiteMode = prefersReducedMotion || isNativeIOS;
  const { gamma, beta, permitted } = useDeviceOrientation({ enabled: !useLiteMode });
  const { period, colors, rotationHue, starDistribution, getStarHSL, getStarGlow } = useTimeColors();
  const { presence: companionPresence } = useCompanionPresence();
  
  // Companion mood-based visual modifiers
  const moodHueShift = useMemo(() => {
    const { mood } = companionPresence;

    // Hue shift: warm when joyful, cool when quiet, none when neutral
    let hueShift = 0;
    
    switch (mood) {
      case 'joyful':
        hueShift = 10;
        break;
      case 'content':
        hueShift = 5;
        break;
      case 'neutral':
        hueShift = 0;
        break;
      case 'reserved':
        hueShift = -5;
        break;
      case 'quiet':
        hueShift = -10;
        break;
      case 'dormant':
        hueShift = 0;
        break;
    }
    
    return hueShift;
  }, [companionPresence]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
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

  // Mouse movement handler for desktop (without rerendering)
  useEffect(() => {
    if (useLiteMode) {
      scheduleParallaxUpdate(0, 0);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      scheduleParallaxUpdate(x, y);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [scheduleParallaxUpdate, useLiteMode]);

  // Use device orientation for mobile tilt parallax (disabled in lite mode)
  useEffect(() => {
    if (useLiteMode || !permitted) return;

    const x = Math.max(-1, Math.min(1, gamma / 30));
    const y = Math.max(-1, Math.min(1, (beta - 45) / 30));
    scheduleParallaxUpdate(x, y);
  }, [gamma, beta, permitted, scheduleParallaxUpdate, useLiteMode]);

  useEffect(() => {
    return () => {
      if (parallaxRafRef.current !== null) {
        cancelAnimationFrame(parallaxRafRef.current);
      }
    };
  }, []);

  // Get transform style for a layer
  const getParallaxStyle = useCallback((multiplier: number) => {
    if (useLiteMode) return {};
    return {
      transform: `translate(calc(var(--parallax-x, 0) * ${multiplier}px), calc(var(--parallax-y, 0) * ${multiplier}px))`,
      transition: 'transform 0.22s ease-out',
      willChange: 'transform' as const,
    };
  }, [useLiteMode]);

  // Convert seed to star color based on current period distribution
  const getStarColorFromSeed = useCallback((seed: number): StarColor => {
    const dist = starDistribution;
    let cumulative = 0;
    if ((cumulative += dist.orange) > seed && dist.orange > 0) return 'orange';
    if ((cumulative += dist.gold) > seed) return 'gold';
    if ((cumulative += dist.teal) > seed) return 'teal';
    if ((cumulative += dist.pink) > seed) return 'pink';
    if ((cumulative += dist.blue) > seed) return 'blue';
    return 'white';
  }, [starDistribution]);

  // Memoize all generated elements
  const dustParticles = useMemo(() => generateDust(useLiteMode ? 10 : 20), [useLiteMode]);
  const backgroundStars = useMemo(() => generateStars(useLiteMode ? 12 : 20, 0.8, 1.5, 0.3, 0.5), [useLiteMode]);
  const midLayerStars = useMemo(() => generateStars(useLiteMode ? 6 : 10, 1.5, 2.5, 0.4, 0.7), [useLiteMode]);
  const brightStars = useMemo(() => generateStars(useLiteMode ? 3 : 5, 2.5, 4, 0.7, 1), [useLiteMode]);
  const shootingStars = useMemo(() => (useLiteMode ? [] : generateShootingStars()), [useLiteMode]);

  // Dynamic gradient based on time period
  const baseGradient = useMemo(() => {
    const gradients: Record<string, string> = {
      dawn: 'linear-gradient(to bottom, hsl(350, 30%, 12%), hsl(25, 25%, 10%), hsl(240, 15%, 8%))',
      morning: 'linear-gradient(to bottom, hsl(200, 35%, 12%), hsl(190, 25%, 10%), hsl(240, 15%, 8%))',
      afternoon: 'linear-gradient(to bottom, hsl(35, 30%, 12%), hsl(180, 20%, 10%), hsl(240, 15%, 8%))',
      sunset: 'linear-gradient(to bottom, hsl(340, 35%, 15%), hsl(20, 30%, 12%), hsl(270, 25%, 10%))',
      night: 'linear-gradient(to bottom, hsl(240, 30%, 10%), hsl(250, 20%, 8%), hsl(0, 0%, 5%))',
    };
    return gradients[period];
  }, [period]);

  // Small hue shift for variety + companion mood influence
  const hueShift = rotationHue * 0.1 + moodHueShift;

  return (
    <div ref={backgroundRef} className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Layer 1: Time-based deep space gradient */}
      <div 
        className="absolute inset-0 transition-all [transition-duration:3000ms]"
        style={{ background: baseGradient }}
      />

      {/* Layer 2: Deep background nebulae with time-based colors */}
      <div className="absolute inset-0" style={getParallaxStyle(PARALLAX.deepNebulae)}>
        <div 
          className="absolute w-[900px] h-[900px] rounded-full blur-[150px] transition-colors [transition-duration:5000ms]"
          style={{
            top: '-15%',
            right: '-10%',
            background: `radial-gradient(ellipse at center, ${colors.nebula1.replace(')', ' / 0.25)')}, transparent 70%)`,
            animation: useLiteMode ? 'none' : 'nebula-drift-slow 55s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute w-[800px] h-[800px] rounded-full blur-[140px] transition-colors [transition-duration:5000ms]"
          style={{
            bottom: '-20%',
            left: '-15%',
            background: `radial-gradient(ellipse at center, ${colors.nebula2.replace(')', ' / 0.2)')}, transparent 70%)`,
            animation: useLiteMode ? 'none' : 'nebula-drift-slow 65s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Layer 3: Cosmic dust particles */}
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
              backgroundColor: `${colors.nebula3.replace(')', ' / 0.4)')}`,
            }}
          />
        ))}
      </div>

      {/* Layer 4: Background stars with time-based colors */}
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
                animation: useLiteMode
                  ? 'none' 
                  : `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite`,
              }}
            />
          );
        })}
      </div>

      {/* Layer 5: Mid-layer nebula wisps with time-based colors */}
      <div className="absolute inset-0 opacity-30" style={getParallaxStyle(PARALLAX.midNebulae)}>
        <div 
          className="absolute w-[600px] h-[300px] blur-[100px] -rotate-12 transition-colors [transition-duration:5000ms]"
          style={{
            top: '10%',
            right: '5%',
            background: `linear-gradient(135deg, ${colors.nebula1.replace(')', ' / 0.35)')}, ${colors.nebula3.replace(')', ' / 0.15)')}, transparent)`,
          }}
        />
        <div 
          className="absolute w-[500px] h-[250px] blur-[90px] rotate-12 transition-colors [transition-duration:5000ms]"
          style={{
            bottom: '15%',
            left: '10%',
            background: `linear-gradient(135deg, ${colors.nebula2.replace(')', ' / 0.3)')}, ${colors.accent.replace(')', ' / 0.15)')}, transparent)`,
          }}
        />
      </div>

      {/* Layer 6: Mid-layer stars */}
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

      {/* Layer 7: Foreground nebula highlights */}
      <div className="absolute inset-0 opacity-25" style={getParallaxStyle(PARALLAX.foregroundNebulae)}>
        <div 
          className="absolute w-[350px] h-[350px] rounded-full blur-[70px] transition-colors [transition-duration:5000ms]"
          style={{
            top: '25%',
            right: '20%',
            background: `radial-gradient(ellipse at center, ${colors.primary.replace(')', ' / 0.5)')}, transparent 60%)`,
            animation: useLiteMode ? 'none' : 'nebula-pulse 25s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute w-[300px] h-[300px] rounded-full blur-[60px] transition-colors [transition-duration:5000ms]"
          style={{
            bottom: '30%',
            left: '25%',
            background: `radial-gradient(ellipse at center, ${colors.accent.replace(')', ' / 0.45)')}, transparent 60%)`,
            animation: useLiteMode ? 'none' : 'nebula-pulse 30s ease-in-out 8s infinite reverse',
          }}
        />
      </div>

      {/* Layer 8: Bright stars (fastest parallax) */}
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

      {/* Layer 9: Shooting stars */}
      {!useLiteMode && shootingStars.map((shootingStar) => (
        <div
          key={`shooting-${shootingStar.id}`}
          className="absolute w-[3px] h-[3px] rounded-full"
          style={{
            left: `${shootingStar.startX}%`,
            top: `${shootingStar.startY}%`,
            background: 'linear-gradient(to right, transparent, white, white)',
            boxShadow: '0 0 6px 2px rgba(255, 255, 255, 0.9), -20px 0 15px rgba(255, 255, 255, 0.4), -40px 0 25px rgba(255, 255, 255, 0.2)',
            animation: `shooting-star-${shootingStar.id} ${shootingStar.duration}s ease-out ${shootingStar.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
});

StarfieldBackground.displayName = 'StarfieldBackground';
