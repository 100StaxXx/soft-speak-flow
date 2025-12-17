import { memo, useCallback } from 'react';
import { LucideIcon } from 'lucide-react';
import { MiniGameType } from '@/types/astralEncounters';
import { cn } from '@/lib/utils';
import { playArcadeSelect } from '@/utils/soundEffects';

interface ArcadeGameCardProps {
  gameType: MiniGameType;
  label: string;
  icon: LucideIcon;
  stat: 'mind' | 'body' | 'soul';
  highScore?: number | null;
  onSelect: (gameType: MiniGameType) => void;
}

const STAT_COLORS = {
  mind: 'from-cyan-500 to-blue-600',
  body: 'from-red-500 to-orange-600',
  soul: 'from-purple-500 to-pink-600',
};

const STAT_GLOW = {
  mind: 'shadow-[0_0_20px_rgba(34,211,238,0.4)]',
  body: 'shadow-[0_0_20px_rgba(239,68,68,0.4)]',
  soul: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]',
};

export const ArcadeGameCard = memo(({
  gameType,
  label,
  icon: Icon,
  stat,
  highScore,
  onSelect,
}: ArcadeGameCardProps) => {
  const handleClick = useCallback(() => {
    playArcadeSelect();
    onSelect(gameType);
  }, [gameType, onSelect]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        'relative group p-4 rounded-xl border border-white/10',
        'bg-gradient-to-br from-white/5 to-white/[0.02]',
        'backdrop-blur-sm transition-all duration-300',
        'hover:scale-105 hover:border-white/20',
        'active:scale-95',
        'min-h-[160px] w-full',
        STAT_GLOW[stat],
        'hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]'
      )}
    >
      {/* Animated border glow */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className={cn(
          'absolute inset-0 rounded-xl bg-gradient-to-r',
          STAT_COLORS[stat],
          'opacity-20 blur-sm'
        )} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-2 h-full justify-between">
        {/* Icon with glow */}
        <div className={cn(
          'p-3 rounded-lg bg-gradient-to-br',
          STAT_COLORS[stat],
          'shadow-lg'
        )}>
          <Icon className="w-6 h-6 text-white" />
        </div>

        {/* Game name */}
        <span className="text-sm font-semibold text-white/90 text-center leading-tight line-clamp-2">
          {label}
        </span>

        {/* Stat badge */}
        <span className={cn(
          'text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full',
          'bg-gradient-to-r',
          STAT_COLORS[stat],
          'text-white/90'
        )}>
          {stat}
        </span>

        {/* High score - always rendered for consistent height */}
        <div className="flex items-center gap-1 mt-1 h-4">
          {highScore !== null && highScore !== undefined ? (
            <>
              <span className="text-[10px] text-yellow-400/80">★</span>
              <span className="text-xs text-yellow-400 font-mono">{highScore}%</span>
            </>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">No record</span>
          )}
        </div>
      </div>
    </button>
  );
});

ArcadeGameCard.displayName = 'ArcadeGameCard';
