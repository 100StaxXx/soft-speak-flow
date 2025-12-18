/**
 * SMITE-inspired Frame Corner Decorations
 * SVG and CSS corner flourishes for evolution card frames
 */

import { cn } from "@/lib/utils";
import type { RewardCssEffect } from "@/types/epicRewards";

interface FrameCornerDecorationsProps {
  cssEffect: RewardCssEffect;
  className?: string;
}

export const FrameCornerDecorations = ({ cssEffect, className }: FrameCornerDecorationsProps) => {
  const { cornerStyle, glowColor, glowAnimation } = cssEffect;
  
  if (!cornerStyle) return null;

  const glowClass = glowAnimation === 'pulse' ? 'animate-frame-pulse' :
                    glowAnimation === 'breathe' ? 'animate-frame-breathe' :
                    glowAnimation === 'flicker' ? 'animate-frame-flicker' : '';

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-30", className)}>
      {/* Top Left */}
      <CornerDecoration 
        position="top-left" 
        cornerStyle={cornerStyle} 
        glowColor={glowColor}
        glowClass={glowClass}
      />
      {/* Top Right */}
      <CornerDecoration 
        position="top-right" 
        cornerStyle={cornerStyle} 
        glowColor={glowColor}
        glowClass={glowClass}
      />
      {/* Bottom Left */}
      <CornerDecoration 
        position="bottom-left" 
        cornerStyle={cornerStyle} 
        glowColor={glowColor}
        glowClass={glowClass}
      />
      {/* Bottom Right */}
      <CornerDecoration 
        position="bottom-right" 
        cornerStyle={cornerStyle} 
        glowColor={glowColor}
        glowClass={glowClass}
      />
    </div>
  );
};

interface CornerDecorationProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  cornerStyle: string;
  glowColor?: string;
  glowClass?: string;
}

const CornerDecoration = ({ position, cornerStyle, glowColor, glowClass }: CornerDecorationProps) => {
  const positionClasses = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0',
  };

  const rotations = {
    'top-left': 'rotate-0',
    'top-right': 'rotate-90',
    'bottom-left': '-rotate-90',
    'bottom-right': 'rotate-180',
  };

  const cornerSvg = getCornerSvg(cornerStyle, glowColor);

  return (
    <div 
      className={cn(
        "absolute w-14 h-14",
        positionClasses[position],
        rotations[position],
        glowClass
      )}
      style={{
        filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined,
      }}
    >
      {cornerSvg}
    </div>
  );
};

const getCornerSvg = (style: string, glowColor?: string) => {
  const color = glowColor || 'hsl(var(--primary))';
  
  switch (style) {
    case 'ornate':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M4 4 L20 4 Q28 4 28 12 L28 20 Q28 28 20 28 L12 28 Q4 28 4 20 Z"
            fill="none"
            stroke={color}
            strokeWidth="2"
            className="animate-frame-shimmer"
          />
          <circle cx="8" cy="8" r="3" fill={color} />
          <path d="M12 4 Q16 8 12 12 Q8 8 12 4" fill={color} opacity="0.6" />
        </svg>
      );
    
    case 'crystal':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <polygon points="4,4 20,4 4,20" fill={color} opacity="0.3" />
          <polygon points="4,4 16,4 4,16" fill={color} opacity="0.5" />
          <polygon points="4,4 12,4 4,12" fill={color} opacity="0.7" />
          <line x1="4" y1="4" x2="24" y2="24" stroke={color} strokeWidth="1" opacity="0.4" />
        </svg>
      );
    
    case 'flame':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M8 28 Q8 16 16 8 Q12 16 16 20 Q16 12 24 8 Q20 16 20 24 Q28 16 28 8"
            fill="none"
            stroke={color}
            strokeWidth="2"
            className="animate-frame-flicker"
          />
          <circle cx="12" cy="20" r="2" fill={color} opacity="0.8" />
          <circle cx="20" cy="12" r="1.5" fill={color} opacity="0.6" />
        </svg>
      );
    
    case 'circuit':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M4 24 L4 8 L8 4 L24 4"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
          <circle cx="8" cy="8" r="3" fill={color} />
          <path d="M8 16 L16 16 L16 8" fill="none" stroke={color} strokeWidth="1.5" opacity="0.6" />
          <circle cx="16" cy="16" r="2" fill={color} opacity="0.6" />
        </svg>
      );
    
    case 'scale':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <ellipse cx="8" cy="8" rx="6" ry="4" fill={color} opacity="0.3" transform="rotate(-45 8 8)" />
          <ellipse cx="16" cy="8" rx="6" ry="4" fill={color} opacity="0.4" transform="rotate(-45 16 8)" />
          <ellipse cx="8" cy="16" rx="6" ry="4" fill={color} opacity="0.4" transform="rotate(-45 8 16)" />
          <ellipse cx="16" cy="16" rx="6" ry="4" fill={color} opacity="0.5" transform="rotate(-45 16 16)" />
        </svg>
      );

    case 'deity':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M4 4 C12 4 16 8 20 4 C16 12 20 16 16 24 L8 28 L4 20 Z"
            fill={color}
            opacity="0.4"
          />
          <circle cx="12" cy="12" r="4" fill={color} opacity="0.7" />
          <path
            d="M4 8 L8 4 M8 8 L12 4 M12 8 L16 4"
            stroke={color}
            strokeWidth="1"
            opacity="0.5"
          />
        </svg>
      );

    case 'dimensional':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <defs>
            <linearGradient id="dimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(300, 80%, 55%)" />
              <stop offset="50%" stopColor="hsl(180, 80%, 55%)" />
              <stop offset="100%" stopColor="hsl(60, 80%, 55%)" />
            </linearGradient>
          </defs>
          <path
            d="M4 4 L24 4 M4 4 L4 24"
            stroke="url(#dimGrad)"
            strokeWidth="3"
            className="animate-frame-shift"
          />
          <polygon points="4,4 12,8 8,12" fill="url(#dimGrad)" opacity="0.6" />
          <circle cx="16" cy="16" r="3" fill="url(#dimGrad)" opacity="0.4" />
        </svg>
      );

    case 'treasure':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M4 16 L4 4 L16 4"
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
          <polygon points="8,8 12,4 16,8 12,12" fill={color} />
          <circle cx="12" cy="8" r="2" fill="hsl(45, 100%, 80%)" />
        </svg>
      );

    case 'mystery':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <circle cx="16" cy="16" r="10" fill="none" stroke={color} strokeWidth="2" opacity="0.4" />
          <circle cx="16" cy="16" r="6" fill="none" stroke={color} strokeWidth="2" opacity="0.6" />
          <line x1="4" y1="4" x2="10" y2="10" stroke={color} strokeWidth="3" />
          <circle cx="6" cy="6" r="3" fill={color} />
        </svg>
      );

    case 'lotus':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <ellipse cx="12" cy="16" rx="6" ry="10" fill={color} opacity="0.3" transform="rotate(-30 12 16)" />
          <ellipse cx="16" cy="12" rx="6" ry="10" fill={color} opacity="0.4" transform="rotate(-60 16 12)" />
          <circle cx="10" cy="10" r="4" fill={color} opacity="0.6" />
        </svg>
      );

    case 'heroic':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M4 4 L4 20 L8 24 L12 20 L12 8 L20 4 L4 4"
            fill={color}
            opacity="0.4"
          />
          <path d="M8 8 L8 16 L12 12 L12 8 Z" fill={color} opacity="0.6" />
          <line x1="8" y1="4" x2="8" y2="12" stroke={color} strokeWidth="2" />
        </svg>
      );

    case 'shield':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M12 4 L4 8 L4 20 L12 28 L20 20 L20 8 L12 4"
            fill={color}
            opacity="0.3"
          />
          <path
            d="M12 8 L8 10 L8 18 L12 22 L16 18 L16 10 Z"
            fill={color}
            opacity="0.5"
          />
        </svg>
      );

    case 'compass':
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="1" opacity="0.3" />
          <line x1="16" y1="4" x2="16" y2="28" stroke={color} strokeWidth="1" opacity="0.4" />
          <line x1="4" y1="16" x2="28" y2="16" stroke={color} strokeWidth="1" opacity="0.4" />
          <polygon points="16,8 14,16 16,14 18,16" fill={color} />
          <circle cx="16" cy="16" r="2" fill={color} />
        </svg>
      );

    // Default simple corners
    default:
      return (
        <svg viewBox="0 0 56 56" className="w-full h-full">
          <path
            d="M4 20 L4 4 L20 4"
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        </svg>
      );
  }
};

export default FrameCornerDecorations;
