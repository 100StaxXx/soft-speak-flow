import { memo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon, Star, Zap } from 'lucide-react';
import { MiniGameType } from '@/types/astralEncounters';
import { cn } from '@/lib/utils';
import { playArcadeSelect } from '@/utils/soundEffects';

interface ArcadeGameCardProps {
  gameType: MiniGameType;
  label: string;
  icon: LucideIcon;
  stat: 'mind' | 'body' | 'soul';
  highScoreDisplay?: string | null;
  onSelect: (gameType: MiniGameType) => void;
  index?: number;
}

const STAT_CONFIG = {
  mind: {
    gradient: 'from-cyan-400 via-blue-500 to-indigo-600',
    glow: 'rgba(34, 211, 238, 0.5)',
    bg: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    icon: '🧠',
  },
  body: {
    gradient: 'from-red-400 via-orange-500 to-amber-500',
    glow: 'rgba(239, 68, 68, 0.5)',
    bg: 'from-red-500/20 via-orange-500/10 to-transparent',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: '💪',
  },
  soul: {
    gradient: 'from-purple-400 via-fuchsia-500 to-pink-500',
    glow: 'rgba(168, 85, 247, 0.5)',
    bg: 'from-purple-500/20 via-fuchsia-500/10 to-transparent',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    icon: '✨',
  },
};

export const ArcadeGameCard = memo(({
  gameType,
  label,
  icon: Icon,
  stat,
  highScoreDisplay,
  onSelect,
  index: _index = 0,
}: ArcadeGameCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const config = STAT_CONFIG[stat];

  const handleClick = useCallback(() => {
    playArcadeSelect();
    onSelect(gameType);
  }, [gameType, onSelect]);

  return (
    <motion.button
      onClick={handleClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'relative group w-full rounded-2xl overflow-hidden',
        'bg-gradient-to-br from-white/[0.08] to-white/[0.02]',
        'backdrop-blur-xl border',
        config.border,
        'transition-all duration-300',
        'min-h-[180px]',
      )}
      style={{
        boxShadow: isHovered 
          ? `0 20px 40px -10px ${config.glow}, 0 0 60px -20px ${config.glow}`
          : `0 8px 30px -10px rgba(0,0,0,0.3)`,
      }}
    >
      {/* Animated background gradient */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br opacity-60 transition-opacity duration-500',
        config.bg,
        isHovered && 'opacity-80'
      )} />
      
      {/* Shine effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/40"
            style={{
              left: `${20 + i * 20}%`,
              bottom: '10%',
            }}
            animate={{
              y: isHovered ? [-0, -40, -60] : 0,
              opacity: isHovered ? [0, 0.8, 0] : 0,
              scale: isHovered ? [0.5, 1, 0.5] : 0.5,
            }}
            transition={{
              duration: 1.5,
              delay: i * 0.15,
              repeat: isHovered ? Infinity : 0,
              repeatDelay: 0.5,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center h-full p-4 justify-between">
        {/* Icon container with glow */}
        <motion.div 
          className={cn(
            'relative p-4 rounded-2xl bg-gradient-to-br',
            config.gradient,
            'shadow-lg'
          )}
          animate={{
            boxShadow: isHovered 
              ? `0 0 40px ${config.glow}, 0 10px 30px -5px ${config.glow}`
              : `0 4px 20px -5px ${config.glow}`,
          }}
          transition={{ duration: 0.3 }}
        >
          <Icon className="w-8 h-8 text-white drop-shadow-lg" />
          
          {/* Icon glow ring */}
          <motion.div 
            className={cn(
              'absolute inset-0 rounded-2xl bg-gradient-to-br',
              config.gradient,
              'opacity-50 blur-lg -z-10'
            )}
            animate={{ scale: isHovered ? 1.3 : 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.div>

        {/* Game name */}
        <div className="text-center mt-3">
          <h3 className="text-base font-bold text-white/95 leading-tight">
            {label}
          </h3>
          
          {/* Stat badge */}
          <div className={cn(
            'inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full',
            'bg-white/10 backdrop-blur-sm border border-white/10'
          )}>
            <span className="text-xs">{config.icon}</span>
            <span className={cn('text-[11px] font-semibold uppercase tracking-wider', config.text)}>
              {stat}
            </span>
          </div>
        </div>

        {/* High score display */}
        <div className="flex items-center gap-1.5 mt-3 min-h-[24px]">
          {highScoreDisplay ? (
            <motion.div 
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
            >
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-amber-300 font-mono tracking-wide">
                {highScoreDisplay}
              </span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5">
              <Zap className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/60 font-medium">
                No record yet
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Corner accent */}
      <div className={cn(
        'absolute top-0 right-0 w-16 h-16',
        'bg-gradient-to-bl from-white/10 to-transparent',
        'rounded-bl-3xl'
      )} />
      
      {/* Bottom border glow */}
      <motion.div 
        className={cn(
          'absolute bottom-0 left-0 right-0 h-1',
          'bg-gradient-to-r',
          config.gradient
        )}
        animate={{ opacity: isHovered ? 1 : 0.5 }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  );
});

ArcadeGameCard.displayName = 'ArcadeGameCard';
