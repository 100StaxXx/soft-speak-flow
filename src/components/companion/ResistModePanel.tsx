import { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Shield, Flame, Target, Zap } from 'lucide-react';
import { HabitResistCard } from './HabitResistCard';
import { AddBadHabitDialog } from './AddBadHabitDialog';
import { useResistMode, BadHabit } from '@/hooks/useResistMode';
import { useAstralEncounterContext } from '@/contexts/AstralEncounterContext';
import { AdversaryTheme } from '@/types/astralEncounters';

export const ResistModePanel = memo(() => {
  const { habits, stats, isLoading, addHabit, removeHabit, isAddingHabit } = useResistMode();
  const { checkEncounterTrigger } = useAstralEncounterContext();
  const [resistingHabitId, setResistingHabitId] = useState<string | null>(null);

  const handleResist = useCallback(async (habit: BadHabit) => {
    setResistingHabitId(habit.id);
    
    // Trigger astral encounter with urge_resist type
    // The theme is based on the habit's theme
    await checkEncounterTrigger(
      'urge_resist',
      habit.id,
      undefined,
      habit.habit_theme
    );
    
    setResistingHabitId(null);
  }, [checkEncounterTrigger]);

  const handleAddHabit = useCallback((params: { name: string; icon: string; theme: AdversaryTheme }) => {
    addHabit(params);
  }, [addHabit]);

  const handleRemoveHabit = useCallback((habitId: string) => {
    removeHabit(habitId);
  }, [removeHabit]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <GlassCard variant="subtle" className="p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-primary">
          <Shield className="h-5 w-5" />
          <span className="text-sm font-medium">Resist urges to grow stronger</span>
          <Shield className="h-5 w-5" />
        </div>
        <p className="text-xs text-muted-foreground">
          Beat a quick game instead of giving in to bad habits
        </p>
      </GlassCard>

      {/* Stats Row */}
      {(stats.totalResisted > 0 || stats.bestStreak > 0) && (
        <div className="grid grid-cols-3 gap-2">
          <GlassCard variant="inset" className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-primary mb-1">
              <Target className="h-3.5 w-3.5" />
            </div>
            <div className="text-lg font-bold">{stats.totalResisted}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </GlassCard>
          <GlassCard variant="inset" className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-orange-400 mb-1">
              <Flame className="h-3.5 w-3.5" />
            </div>
            <div className="text-lg font-bold">{stats.bestStreak}</div>
            <div className="text-xs text-muted-foreground">Best Streak</div>
          </GlassCard>
          <GlassCard variant="inset" className="p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-green-400 mb-1">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="text-lg font-bold">{stats.todayResists}</div>
            <div className="text-xs text-muted-foreground">Today</div>
          </GlassCard>
        </div>
      )}

      {/* Habits List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {habits?.map((habit) => (
            <HabitResistCard
              key={habit.id}
              habit={habit}
              onResist={() => handleResist(habit)}
              onRemove={() => handleRemoveHabit(habit.id)}
              isLoading={resistingHabitId === habit.id}
            />
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {!isLoading && (!habits || habits.length === 0) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center"
          >
            <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">No habits tracked yet</p>
            <p className="text-xs text-muted-foreground/70">
              Add a bad habit to start building resistance
            </p>
          </motion.div>
        )}
      </div>

      {/* Add Habit Button */}
      <AddBadHabitDialog onAdd={handleAddHabit} isLoading={isAddingHabit} />
    </div>
  );
});

ResistModePanel.displayName = 'ResistModePanel';
