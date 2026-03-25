import { memo, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '@/components/ui/glass-card';
import { Shield, Flame, Target, Zap, Smartphone } from 'lucide-react';
import { HabitResistCard } from './HabitResistCard';
import { AddBadHabitDialog } from './AddBadHabitDialog';
import { useResistMode, BadHabit } from '@/hooks/useResistMode';
import { useAstralEncounterContext } from '@/contexts/AstralEncounterContext';
import { AdversaryTheme } from '@/types/astralEncounters';
import { isMacSession } from '@/utils/platformTargets';

export const ResistModePanel = memo(() => {
  const { habits, stats, isLoading, addHabit, removeHabit, isAddingHabit } = useResistMode();
  const { checkEncounterTrigger, isTriggeringEncounter } = useAstralEncounterContext();
  const [resistingHabitId, setResistingHabitId] = useState<string | null>(null);
  const [isStartingEncounter, setIsStartingEncounter] = useState(false);
  const isMacBlockedSession = isMacSession();

  const handleResist = useCallback(async (habit: BadHabit) => {
    if (isMacBlockedSession || isStartingEncounter || isTriggeringEncounter) return;

    setResistingHabitId(habit.id);
    setIsStartingEncounter(true);

    try {
      // Trigger astral encounter with urge_resist type
      // The theme is based on the habit's theme
      await checkEncounterTrigger(
        'urge_resist',
        habit.id,
        undefined,
        habit.habit_theme
      );
    } finally {
      setResistingHabitId(null);
      setIsStartingEncounter(false);
    }
  }, [checkEncounterTrigger, isMacBlockedSession, isStartingEncounter, isTriggeringEncounter]);

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
          {isMacBlockedSession
            ? 'Track your habits here, then continue Astral Encounters on iPhone or iPad.'
            : 'Beat a quick game instead of giving in to bad habits'}
        </p>
      </GlassCard>

      {isMacBlockedSession && (
        <GlassCard variant="inset" className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                Astral Encounters are only available on iPhone and iPad.
              </p>
              <p className="text-xs text-muted-foreground">
                Open Soft Speak Flow on your iPhone or iPad to play Astral Encounters.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

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
              isLoading={isStartingEncounter || isTriggeringEncounter || resistingHabitId === habit.id}
              resistDisabled={isMacBlockedSession}
              resistLabel={isMacBlockedSession ? 'iPhone/iPad only' : 'Resist'}
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
