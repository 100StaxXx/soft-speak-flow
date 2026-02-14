/**
 * GuildEmblem Component
 * Cinematic 3D-like guild emblem with glow effects and animations
 */

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { 
  Shield, Sword, Crown, Star, Flame, Snowflake,
  Zap, Moon, Diamond, Hexagon
} from "lucide-react";

export type EmblemIcon = 'shield' | 'sword' | 'dragon' | 'crown' | 'phoenix' | 'wolf' | 'star' | 'crystal' | 'flame' | 'ice' | 'lightning' | 'moon';

interface GuildEmblemProps {
  icon: EmblemIcon;
  color: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  glowEffect?: string;
  className?: string;
}

const EMBLEM_ICONS: Record<EmblemIcon, React.FC<{ className?: string }>> = {
  shield: Shield,
  sword: Sword,
  dragon: Hexagon, // Using Hexagon as dragon placeholder
  crown: Crown,
  phoenix: Flame,
  wolf: Diamond, // Using Diamond as wolf placeholder
  star: Star,
  crystal: Diamond,
  flame: Flame,
  ice: Snowflake,
  lightning: Zap,
  moon: Moon,
};

const SIZE_CLASSES = {
  sm: 'w-10 h-10',
  md: 'w-14 h-14',
  lg: 'w-20 h-20',
  xl: 'w-28 h-28',
};

const ICON_SIZE_CLASSES = {
  sm: 'h-5 w-5',
  md: 'h-7 w-7',
  lg: 'h-10 w-10',
  xl: 'h-14 w-14',
};

export const GuildEmblem = ({
  icon,
  color,
  size = 'md',
  animated = true,
  glowEffect = 'pulse',
  className,
}: GuildEmblemProps) => {
  const IconComponent = EMBLEM_ICONS[icon] || Shield;
  
  const glowAnimationClass = 
    glowEffect === 'pulse' ? 'animate-emblem-glow' :
    glowEffect === 'breathe' ? 'animate-frame-breathe' :
    glowEffect === 'shimmer' ? 'animate-frame-shimmer' :
    glowEffect === 'flicker' ? 'animate-frame-flicker' : '';

  return (
    <motion.div
      className={cn(
        "relative flex items-center justify-center rounded-2xl",
        SIZE_CLASSES[size],
        animated && glowAnimationClass,
        className
      )}
      style={{
        '--emblem-color': color,
        background: `linear-gradient(135deg, ${color} 0%, ${color}dd 50%, ${color}aa 100%)`,
        boxShadow: `0 0 20px ${color}60, 0 0 40px ${color}30, inset 0 2px 4px rgba(255,255,255,0.3)`,
      } as React.CSSProperties}
      whileHover={animated ? { scale: 1.1, rotate: 5 } : undefined}
      whileTap={animated ? { scale: 0.95 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      {/* Inner glow ring */}
      <div 
        className="absolute inset-1 rounded-xl opacity-50"
        style={{
          background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
        }}
      />
      
      {/* Decorative corners */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white/40 rounded-tl-lg" />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white/40 rounded-tr-lg" />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white/40 rounded-bl-lg" />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white/40 rounded-br-lg" />
      
      {/* Icon */}
      <IconComponent 
        className={cn(
          ICON_SIZE_CLASSES[size],
          "text-white drop-shadow-lg relative z-10"
        )} 
      />
      
      {/* Shine overlay */}
      <div 
        className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
        style={{
          background: `linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%, rgba(255,255,255,0.1) 100%)`,
        }}
      />
    </motion.div>
  );
};

export default GuildEmblem;
