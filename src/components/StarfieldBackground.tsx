import { useEffect, useState } from "react";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  animationDelay: number;
  animationDuration: number;
}

export const StarfieldBackground = () => {
  const [stars, setStars] = useState<Star[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    // Generate 80 random stars
    const generatedStars: Star[] = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1, // 1-3px
      opacity: Math.random() * 0.5 + 0.3, // 0.3-0.8
      animationDelay: Math.random() * 10,
      animationDuration: Math.random() * 6 + 8, // 8-14s (much slower twinkle)
    }));

    setStars(generatedStars);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Deep space gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--deep-space))] via-[hsl(var(--midnight))] to-[hsl(var(--obsidian))]" />
      
      {/* Nebula gradients */}
      <div className="absolute inset-0 opacity-30">
        <div 
          className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px] bg-gradient-to-br from-[hsl(var(--nebula-pink))] to-transparent"
          style={{ animation: prefersReducedMotion ? 'none' : 'nebula-shift 60s ease-in-out infinite' }}
        />
        <div 
          className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px] bg-gradient-to-tr from-[hsl(var(--celestial-blue))] to-transparent"
          style={{ animation: prefersReducedMotion ? 'none' : 'nebula-shift 75s ease-in-out infinite reverse' }}
        />
        <div 
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px] bg-gradient-to-br from-[hsl(var(--cosmiq-glow))] to-transparent"
          style={{ animation: prefersReducedMotion ? 'none' : 'nebula-shift 90s ease-in-out infinite' }}
        />
      </div>

      {/* Twinkling stars */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            opacity: star.opacity,
            animation: prefersReducedMotion 
              ? 'none' 
              : `twinkle ${star.animationDuration}s ease-in-out ${star.animationDelay}s infinite`,
            boxShadow: `0 0 ${star.size * 2}px rgba(255, 255, 255, ${star.opacity})`,
          }}
        />
      ))}

      {/* Occasional shooting star */}
      {!prefersReducedMotion && (
        <div
          className="absolute w-[2px] h-[2px] bg-white rounded-full"
          style={{
            animation: 'shooting-star 4s ease-out 20s infinite',
            boxShadow: '0 0 4px 2px rgba(255, 255, 255, 0.8)',
          }}
        />
      )}
    </div>
  );
};
