import { memo, useMemo, useState, useEffect } from "react";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  animationDelay: number;
  animationDuration: number;
  opacity: number;
}

const generateParticles = (count: number): Particle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 2, // 2-5px
    animationDelay: Math.random() * 10,
    animationDuration: Math.random() * 20 + 30, // 30-50s drift
    opacity: Math.random() * 0.4 + 0.3, // 0.3-0.7
  }));
};

export const CompanionAmbientParticles = memo(() => {
  const { presence, isLoading } = useCompanionPresence();
  const { particleColor } = useCompanionAuraColors();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const particles = useMemo(() => {
    return generateParticles(presence.particleCount);
  }, [presence.particleCount]);

  // Don't render if no particles, loading, or reduced motion
  if (isLoading || presence.particleCount === 0 || prefersReducedMotion) {
    return null;
  }

  const getAnimationStyle = (particle: Particle) => {
    const effect = presence.particleEffect;
    
    if (effect === 'sparkle') {
      return {
        animation: `
          companion-particle-drift ${particle.animationDuration}s ease-in-out ${particle.animationDelay}s infinite,
          companion-particle-twinkle ${3 + Math.random() * 2}s ease-in-out ${particle.animationDelay}s infinite
        `,
      };
    }
    
    if (effect === 'gentle') {
      return {
        animation: `companion-particle-drift ${particle.animationDuration * 1.5}s ease-in-out ${particle.animationDelay}s infinite`,
      };
    }
    
    // minimal
    return {
      animation: `companion-particle-drift ${particle.animationDuration * 2}s ease-in-out ${particle.animationDelay}s infinite`,
    };
  };

  return (
    <div 
      className="fixed inset-0 overflow-hidden pointer-events-none z-[1]"
      aria-hidden="true"
    >
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particleColor,
            opacity: particle.opacity * (presence.overallCare * 0.5 + 0.5),
            boxShadow: presence.particleEffect === 'sparkle' 
              ? `0 0 ${particle.size * 2}px ${particleColor}`
              : 'none',
            willChange: 'transform, opacity',
            ...getAnimationStyle(particle),
          }}
        />
      ))}

      <style>{`
        @keyframes companion-particle-drift {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(${20 + Math.random() * 30}px, ${-30 - Math.random() * 20}px) scale(1.1);
          }
          50% {
            transform: translate(${-10 - Math.random() * 20}px, ${-60 - Math.random() * 40}px) scale(0.9);
          }
          75% {
            transform: translate(${30 + Math.random() * 20}px, ${-30 - Math.random() * 20}px) scale(1.05);
          }
        }

        @keyframes companion-particle-twinkle {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
});

CompanionAmbientParticles.displayName = 'CompanionAmbientParticles';
