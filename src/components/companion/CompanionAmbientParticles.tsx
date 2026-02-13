import { memo, useMemo } from "react";
import { useCompanionPresence } from "@/contexts/CompanionPresenceContext";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";
import { useMotionProfile } from "@/hooks/useMotionProfile";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  animationDelay: number;
  animationDuration: number;
  twinkleDuration: number;
  opacity: number;
}

const generateParticles = (count: number): Particle[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 2,
    animationDelay: Math.random() * 10,
    animationDuration: Math.random() * 20 + 30,
    twinkleDuration: Math.random() * 2 + 3,
    opacity: Math.random() * 0.4 + 0.3,
  }));
};

const getCompanionParticleCap = (profile: "reduced" | "balanced" | "enhanced") => {
  switch (profile) {
    case "enhanced":
      return 12;
    case "balanced":
      return 8;
    default:
      return 0;
  }
};

export const CompanionAmbientParticles = memo(() => {
  const { presence, isLoading } = useCompanionPresence();
  const { particleColor } = useCompanionAuraColors();
  const { profile, capabilities } = useMotionProfile();

  const particleCount = Math.min(
    presence.particleCount,
    getCompanionParticleCap(profile),
  );

  const particles = useMemo(() => {
    return generateParticles(particleCount);
  }, [particleCount]);

  if (
    isLoading
    || particleCount === 0
    || !capabilities.allowBackgroundAnimation
    || !presence.isPresent
  ) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-[1]"
      aria-hidden="true"
    >
      {particles.map((particle) => {
        const effectClass =
          presence.particleEffect === "sparkle"
            ? "companion-particle-sparkle"
            : presence.particleEffect === "gentle"
              ? "companion-particle-gentle"
              : "companion-particle-minimal";

        return (
          <div
            key={particle.id}
            className={`absolute rounded-full companion-particle-base ${effectClass}`}
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              backgroundColor: particleColor,
              opacity: particle.opacity * (presence.overallCare * 0.5 + 0.5),
              boxShadow:
                presence.particleEffect === "sparkle"
                  ? `0 0 ${particle.size * 2}px ${particleColor}`
                  : "none",
              animationDelay: `${particle.animationDelay}s`,
              animationDuration: `${particle.animationDuration}s, ${particle.twinkleDuration}s`,
            }}
          />
        );
      })}
    </div>
  );
});

CompanionAmbientParticles.displayName = "CompanionAmbientParticles";
