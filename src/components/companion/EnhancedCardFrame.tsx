/**
 * Enhanced Card Frame Component
 * SMITE-inspired frame rendering with animations and corner decorations
 */

import { cn } from "@/lib/utils";
import type { RewardCssEffect } from "@/types/epicRewards";
import { FrameCornerDecorations } from "./FrameCornerDecorations";

interface EnhancedCardFrameProps {
  cssEffect: RewardCssEffect | null;
  children: React.ReactNode;
  className?: string;
  showParticles?: boolean;
}

export const EnhancedCardFrame = ({ 
  cssEffect, 
  children, 
  className,
  showParticles = true 
}: EnhancedCardFrameProps) => {
  if (!cssEffect) {
    return <div className={className}>{children}</div>;
  }

  const {
    borderColor,
    borderWidth,
    borderStyle,
    glowColor,
    glowAnimation,
    gradientBorder,
    animatedGradient,
    shimmer,
    particleEffect,
  } = cssEffect;

  // Determine glow animation class
  const glowAnimationClass = glowAnimation === 'pulse' ? 'animate-frame-pulse' :
                             glowAnimation === 'breathe' ? 'animate-frame-breathe' :
                             glowAnimation === 'flicker' ? 'animate-frame-flicker' :
                             glowAnimation === 'shift' ? 'animate-frame-shift' : '';

  // Build inline styles
  const frameStyles: React.CSSProperties = {
    borderColor: gradientBorder ? 'transparent' : borderColor,
    borderWidth: borderWidth || '4px',
    borderStyle: (borderStyle as React.CSSProperties['borderStyle']) || 'solid',
    background: gradientBorder ? gradientBorder : undefined,
    backgroundSize: animatedGradient ? '200% 200%' : undefined,
  };

  // Box shadow for glow
  const glowShadow = glowColor ? `0 0 20px ${glowColor}, 0 0 40px ${glowColor}40` : undefined;

  return (
    <div 
      className={cn(
        "relative overflow-hidden rounded-2xl",
        shimmer && 'animate-frame-shimmer',
        glowAnimationClass,
        animatedGradient && 'animate-gradient-border',
        className
      )}
      style={{
        ...frameStyles,
        boxShadow: glowShadow,
      }}
    >
      {/* Gradient border overlay for animated gradients */}
      {gradientBorder && (
        <div 
          className={cn(
            "absolute inset-0 rounded-2xl -z-10",
            animatedGradient && "animate-gradient-border"
          )}
          style={{
            background: gradientBorder,
            backgroundSize: '200% 200%',
          }}
        />
      )}

      {/* Corner Decorations */}
      <FrameCornerDecorations cssEffect={cssEffect} />

      {/* Shimmer overlay */}
      {shimmer && (
        <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 animate-frame-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" 
               style={{ transform: 'skewX(-20deg)', width: '200%', marginLeft: '-50%' }} />
        </div>
      )}

      {/* Particle effects */}
      {showParticles && particleEffect && (
        <FrameParticles effect={particleEffect} color={glowColor} />
      )}

      {/* Content */}
      {children}
    </div>
  );
};

interface FrameParticlesProps {
  effect: string;
  color?: string;
}

const FrameParticles = ({ effect, color }: FrameParticlesProps) => {
  const particleCount = 8;
  const particles = Array.from({ length: particleCount }, (_, i) => i);

  const getParticleStyle = (index: number): React.CSSProperties => {
    const delay = (index / particleCount) * 3;
    const duration = 2 + Math.random() * 2;
    
    // Position particles around the frame edges
    const positions = [
      { top: '10%', left: '5%' },
      { top: '30%', left: '2%' },
      { top: '50%', left: '3%' },
      { top: '70%', left: '5%' },
      { top: '10%', right: '5%' },
      { top: '40%', right: '3%' },
      { top: '60%', right: '4%' },
      { top: '85%', right: '6%' },
    ];

    return {
      ...positions[index % positions.length],
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    };
  };

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
    switch (effect) {
      case 'stars':
        return color || 'hsl(45, 100%, 70%)';
      case 'embers':
        return color || 'hsl(25, 100%, 60%)';
      case 'ice':
        return color || 'hsl(200, 90%, 80%)';
      case 'void':
        return color || 'hsl(280, 80%, 60%)';
      case 'divine':
        return color || 'hsl(45, 100%, 80%)';
      case 'dimensional':
        return color || 'hsl(300, 80%, 65%)';
      default:
        return color || 'hsl(var(--primary))';
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      {particles.map((_, index) => (
        <span
          key={index}
          className="absolute text-xs animate-frame-particle opacity-0"
          style={{
            ...getParticleStyle(index),
            color: getParticleColor(),
            textShadow: `0 0 8px ${getParticleColor()}`,
          }}
        >
          {getParticleContent()}
        </span>
      ))}
    </div>
  );
};

export default EnhancedCardFrame;
