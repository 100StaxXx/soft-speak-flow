/**
 * GuildParticles Component
 * Ambient particle effects for guild cards and views
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type ParticleEffect = 'stars' | 'embers' | 'ice' | 'void' | 'divine' | 'dimensional' | 'none';

interface GuildParticlesProps {
  effect: string;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
  className?: string;
}

export const GuildParticles = ({
  effect,
  color,
  intensity = 'medium',
  className,
}: GuildParticlesProps) => {
  const particleCount = intensity === 'low' ? 4 : intensity === 'medium' ? 8 : 12;
  
  const particles = useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: Math.random() * 4,
      duration: 3 + Math.random() * 3,
      size: 0.5 + Math.random() * 0.5,
    }));
  }, [particleCount]);

  const getParticleContent = () => {
    switch (effect) {
      case 'stars':
        return '✦';
      case 'embers':
        return '●';
      case 'ice':
        return '❄';
      case 'void':
        return '◆';
      case 'divine':
        return '✧';
      case 'dimensional':
        return '◈';
      default:
        return '•';
    }
  };

  const getParticleColor = () => {
    if (color) return color;
    switch (effect) {
      case 'stars':
        return 'hsl(45, 100%, 70%)';
      case 'embers':
        return 'hsl(25, 100%, 60%)';
      case 'ice':
        return 'hsl(200, 90%, 80%)';
      case 'void':
        return 'hsl(280, 80%, 60%)';
      case 'divine':
        return 'hsl(45, 100%, 80%)';
      case 'dimensional':
        return 'hsl(300, 80%, 65%)';
      default:
        return 'hsl(var(--primary))';
    }
  };

  const getAnimationClass = () => {
    switch (effect) {
      case 'embers':
        return 'animate-particle-rise';
      case 'stars':
      case 'divine':
        return 'animate-guild-float';
      case 'ice':
      case 'crystal':
        return 'animate-crystal-sparkle';
      default:
        return 'animate-frame-particle';
    }
  };

  if (effect === 'none') return null;

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none z-5", className)}>
      {particles.map((particle) => (
        <span
          key={particle.id}
          className={cn("absolute text-xs opacity-0", getAnimationClass())}
          style={{
            left: particle.left,
            top: particle.top,
            animationDelay: `${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            color: getParticleColor(),
            textShadow: `0 0 8px ${getParticleColor()}, 0 0 16px ${getParticleColor()}`,
            fontSize: `${particle.size}rem`,
          }}
        >
          {getParticleContent()}
        </span>
      ))}
    </div>
  );
};

export default GuildParticles;
