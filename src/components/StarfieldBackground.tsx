import { useEffect, useState, useMemo } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  animationDelay: number;
  animationDuration: number;
  color: 'white' | 'blue' | 'pink' | 'gold';
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
  return Array.from({ length: count }, (_, i) => {
    const colorRoll = Math.random();
    let color: Star['color'] = 'white';
    if (colorRoll > 0.85) color = 'gold';
    else if (colorRoll > 0.75) color = 'pink';
    else if (colorRoll > 0.60) color = 'blue';
    
    return {
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * (sizeMax - sizeMin) + sizeMin,
      opacity: Math.random() * (opacityMax - opacityMin) + opacityMin,
      animationDelay: Math.random() * 10,
      animationDuration: Math.random() * 4 + 4,
      color,
    };
  });
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

// Generate shooting stars with varied directions
const generateShootingStars = (): ShootingStar[] => [
  { id: 1, delay: 60, duration: 2, startX: 15, startY: 10, angle: 35 },     // Top-left → Bottom-right
  { id: 2, delay: 120, duration: 1.8, startX: 85, startY: 8, angle: 145 },  // Top-right → Bottom-left
  { id: 3, delay: 180, duration: 2.2, startX: 50, startY: 5, angle: 80 },   // Top-center → Bottom (near vertical)
];

const getStarColor = (color: Star['color']) => {
  switch (color) {
    case 'blue': return 'hsl(200, 85%, 70%)';
    case 'pink': return 'hsl(320, 60%, 75%)';
    case 'gold': return 'hsl(45, 100%, 65%)';
    default: return 'hsl(0, 0%, 100%)';
  }
};

const getStarGlow = (color: Star['color'], opacity: number) => {
  switch (color) {
    case 'blue': return `0 0 8px hsla(200, 85%, 70%, ${opacity}), 0 0 16px hsla(200, 85%, 70%, ${opacity * 0.5})`;
    case 'pink': return `0 0 8px hsla(320, 60%, 75%, ${opacity}), 0 0 16px hsla(320, 60%, 75%, ${opacity * 0.5})`;
    case 'gold': return `0 0 8px hsla(45, 100%, 65%, ${opacity}), 0 0 16px hsla(45, 100%, 65%, ${opacity * 0.5})`;
    default: return `0 0 6px hsla(0, 0%, 100%, ${opacity})`;
  }
};

export const StarfieldBackground = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Memoize all generated elements - reduced counts for calmer effect
  const dustParticles = useMemo(() => generateDust(20), []);
  const backgroundStars = useMemo(() => generateStars(20, 0.8, 1.5, 0.3, 0.5), []);
  const midLayerStars = useMemo(() => generateStars(10, 1.5, 2.5, 0.4, 0.7), []);
  const brightStars = useMemo(() => generateStars(5, 2.5, 4, 0.7, 1), []);
  const shootingStars = useMemo(() => generateShootingStars(), []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Layer 1: Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--deep-space))] via-[hsl(var(--midnight))] to-[hsl(var(--obsidian))]" />

      {/* Layer 2: Deep background nebulae (largest, slowest) */}
      <div className="absolute inset-0">
        <div 
          className="absolute w-[900px] h-[900px] rounded-full blur-[150px]"
          style={{
            top: '-15%',
            right: '-10%',
            background: 'radial-gradient(ellipse at center, hsla(270, 50%, 30%, 0.25), transparent 70%)',
            animation: prefersReducedMotion ? 'none' : 'nebula-drift-slow 55s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute w-[800px] h-[800px] rounded-full blur-[140px]"
          style={{
            bottom: '-20%',
            left: '-15%',
            background: 'radial-gradient(ellipse at center, hsla(220, 60%, 25%, 0.2), transparent 70%)',
            animation: prefersReducedMotion ? 'none' : 'nebula-drift-slow 65s ease-in-out infinite reverse',
          }}
        />
      </div>

      {/* Layer 3: Cosmic dust particles (static - no animation) */}
      {dustParticles.map((particle) => (
        <div
          key={`dust-${particle.id}`}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            backgroundColor: 'hsla(210, 30%, 80%, 0.5)',
          }}
        />
      ))}

      {/* Layer 4: Background stars (gentle twinkle) */}
      {backgroundStars.map((star) => (
        <div
          key={`bg-star-${star.id}`}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            backgroundColor: getStarColor(star.color),
            boxShadow: getStarGlow(star.color, star.opacity * 0.5),
            animation: prefersReducedMotion 
              ? 'none' 
              : `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite`,
          }}
        />
      ))}

      {/* Layer 5: Mid-layer nebula wisps (static - no animation) */}
      <div className="absolute inset-0 opacity-25">
        <div 
          className="absolute w-[600px] h-[300px] blur-[100px] -rotate-12"
          style={{
            top: '10%',
            right: '5%',
            background: 'linear-gradient(135deg, hsla(330, 70%, 50%, 0.3), hsla(280, 60%, 45%, 0.15), transparent)',
          }}
        />
        <div 
          className="absolute w-[500px] h-[250px] blur-[90px] rotate-12"
          style={{
            bottom: '15%',
            left: '10%',
            background: 'linear-gradient(135deg, hsla(195, 80%, 50%, 0.25), hsla(210, 70%, 45%, 0.15), transparent)',
          }}
        />
      </div>

      {/* Layer 6: Mid-layer stars (static glow - no animation) */}
      {midLayerStars.map((star) => (
        <div
          key={`mid-star-${star.id}`}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            backgroundColor: getStarColor(star.color),
            boxShadow: getStarGlow(star.color, star.opacity),
          }}
        />
      ))}

      {/* Layer 7: Foreground nebula highlights */}
      <div className="absolute inset-0 opacity-25">
        <div 
          className="absolute w-[350px] h-[350px] rounded-full blur-[70px]"
          style={{
            top: '25%',
            right: '20%',
            background: 'radial-gradient(ellipse at center, hsla(var(--nebula-pink), 0.5), transparent 60%)',
            animation: prefersReducedMotion ? 'none' : 'nebula-pulse 25s ease-in-out infinite',
          }}
        />
        <div 
          className="absolute w-[300px] h-[300px] rounded-full blur-[60px]"
          style={{
            bottom: '30%',
            left: '25%',
            background: 'radial-gradient(ellipse at center, hsla(var(--celestial-blue), 0.45), transparent 60%)',
            animation: prefersReducedMotion ? 'none' : 'nebula-pulse 30s ease-in-out 8s infinite reverse',
          }}
        />
      </div>

      {/* Layer 8: Bright stars (static glow - no sparkle animation) */}
      {brightStars.map((star) => (
        <div
          key={`bright-star-${star.id}`}
          className="absolute rounded-full"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: getStarColor(star.color),
            boxShadow: `${getStarGlow(star.color, 1)}, 0 0 20px ${getStarColor(star.color)}`,
          }}
        />
      ))}

      {/* Layer 9: Shooting stars with varied directions */}
      {!prefersReducedMotion && shootingStars.map((shootingStar) => (
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
};
