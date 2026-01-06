import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PlanContext, HabitWithStreak, UpcomingMilestone, ExistingTask } from '@/hooks/useSmartDayPlanner';
import { Flame, Target, Calendar, Loader2, Shield, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnchorsStepProps {
  context: PlanContext;
  updateContext: (updates: Partial<PlanContext>) => void;
  habitsWithStreaks: HabitWithStreak[];
  upcomingMilestones: UpcomingMilestone[];
  existingTasks: ExistingTask[];
  isLoading: boolean;
  onNext: () => void;
}

export function AnchorsStep({
  context,
  updateContext,
  habitsWithStreaks,
  upcomingMilestones,
  existingTasks,
  isLoading,
  onNext,
}: AnchorsStepProps) {
  const toggleHabit = (habitId: string) => {
    const current = context.protectedHabitIds;
    const updated = current.includes(habitId)
      ? current.filter(id => id !== habitId)
      : [...current, habitId];
    updateContext({ protectedHabitIds: updated });
  };

  const toggleEpic = (epicId: string) => {
    const current = context.prioritizedEpicIds;
    const updated = current.includes(epicId)
      ? current.filter(id => id !== epicId)
      : [...current, epicId];
    updateContext({ prioritizedEpicIds: updated });
  };

  const selectAllHabits = () => {
    updateContext({ protectedHabitIds: habitsWithStreaks.map(h => h.id) });
  };

  // Get unique epics from milestones
  const uniqueEpics = React.useMemo(() => {
    const epicMap = new Map<string, { id: string; title: string; milestoneCount: number }>();
    upcomingMilestones.forEach(m => {
      const existing = epicMap.get(m.epicId);
      if (existing) {
        existing.milestoneCount++;
      } else {
        epicMap.set(m.epicId, { id: m.epicId, title: m.epicTitle, milestoneCount: 1 });
      }
    });
    return Array.from(epicMap.values());
  }, [upcomingMilestones]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">Detecting your anchors...</p>
      </div>
    );
  }

  const hasNoAnchors = habitsWithStreaks.length === 0 && uniqueEpics.length === 0;

  return (
    <div className="space-y-5">
      {hasNoAnchors ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-8"
        >
          <Sparkles className="h-10 w-10 text-primary/50 mx-auto mb-3" />
          <h3 className="font-medium text-foreground mb-1">Fresh Start!</h3>
          <p className="text-sm text-muted-foreground">
            No active streaks or milestones yet. We'll create a balanced plan for you.
          </p>
        </motion.div>
      ) : (
        <>
          {/* Habits with Streaks */}
          {habitsWithStreaks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  Protect These Streaks
                </label>
                {habitsWithStreaks.length > 1 && (
                  <button
                    onClick={selectAllHabits}
                    className="text-xs text-primary hover:underline"
                  >
                    Select all
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {habitsWithStreaks.map((habit, index) => {
                  const isSelected = context.protectedHabitIds.includes(habit.id);
                  return (
                    <motion.div
                      key={habit.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => toggleHabit(habit.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected
                          ? "border-orange-500/50 bg-orange-500/10"
                          : "border-border hover:border-orange-500/30"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleHabit(habit.id)}
                        className="border-orange-500 data-[state=checked]:bg-orange-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{habit.name}</p>
                        {habit.preferredTime && (
                          <p className="text-xs text-muted-foreground">
                            Usually at {habit.preferredTime}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-orange-500">
                        <Flame className="h-3.5 w-3.5" />
                        <span className="text-sm font-bold">{habit.streak}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Epic Priorities */}
          {uniqueEpics.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Epic Priorities
              </label>
              <div className="space-y-2">
                {uniqueEpics.map((epic, index) => {
                  const isSelected = context.prioritizedEpicIds.includes(epic.id);
                  return (
                    <motion.div
                      key={epic.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.05 }}
                      onClick={() => toggleEpic(epic.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEpic(epic.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{epic.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {epic.milestoneCount} milestone{epic.milestoneCount > 1 ? 's' : ''} upcoming
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Existing tasks info */}
      {existingTasks.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border/50"
        >
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {existingTasks.length} existing task{existingTasks.length > 1 ? 's' : ''} will be preserved
          </p>
        </motion.div>
      )}

      {/* Summary */}
      {(context.protectedHabitIds.length > 0 || context.prioritizedEpicIds.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20"
        >
          <Shield className="h-4 w-4 text-primary" />
          <p className="text-xs text-primary">
            Protecting {context.protectedHabitIds.length} streak{context.protectedHabitIds.length !== 1 ? 's' : ''} 
            {context.prioritizedEpicIds.length > 0 && ` + ${context.prioritizedEpicIds.length} epic${context.prioritizedEpicIds.length !== 1 ? 's' : ''}`}
          </p>
        </motion.div>
      )}

      {/* Continue button */}
      <Button
        onClick={onNext}
        className="w-full mt-4"
        size="lg"
      >
        Continue
      </Button>
    </div>
  );
}
