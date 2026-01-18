import { memo } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Flame, Shield, Trash2 } from 'lucide-react';
import { BadHabit } from '@/hooks/useResistMode';

interface HabitResistCardProps {
  habit: BadHabit;
  onResist: () => void;
  onRemove: () => void;
  isLoading?: boolean;
}

export const HabitResistCard = memo(({ habit, onResist, onRemove, isLoading }: HabitResistCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <GlassCard variant="subtle" className="p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Icon and Info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="text-2xl flex-shrink-0">{habit.icon}</div>
            <div className="min-w-0">
              <h4 className="font-medium text-sm text-foreground truncate">{habit.name}</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Resisted {habit.times_resisted}×</span>
                {habit.current_streak > 0 && (
                  <span className="flex items-center gap-1 text-orange-400">
                    <Flame className="h-3 w-3" />
                    {habit.current_streak} streak
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={onResist}
              disabled={isLoading}
              className="gap-1.5"
            >
              <Shield className="h-4 w-4" />
              Resist
            </Button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
});

HabitResistCard.displayName = 'HabitResistCard';
