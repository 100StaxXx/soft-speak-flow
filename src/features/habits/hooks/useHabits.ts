import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useAchievements } from "@/hooks/useAchievements";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useProfile } from "@/hooks/useProfile";
import { getHabitXP, HABIT_XP_REWARDS } from "@/config/xpRewards";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import { categorizeQuest } from "@/utils/questCategorization";
import { useResilience } from "@/contexts/ResilienceContext";
import type { DailyTask } from "@/services/dailyTasksRemote";
import { getEpicsQueryKey } from "@/hooks/epicsQuery";
import { DAILY_PLAN_OPTIMIZATION_QUERY_KEY } from "@/hooks/useDailyPlanOptimization";
import {
  createOfflinePlannerId,
  getAllLocalTasksForUser,
  getLocalEpicHabits,
  getLocalHabitCompletions,
  removePlannerRecord,
  removePlannerRecords,
  upsertPlannerRecord,
  upsertPlannerRecords,
} from "@/utils/plannerLocalStore";
import {
  PLANNER_SYNC_EVENT,
  dispatchPlannerSyncFinished,
  loadLocalHabitCompletions,
  loadLocalHabits,
  loadLocalEpics,
  syncLocalHabitsFromRemote,
  withPlannerRemoteSyncLock,
} from "@/utils/plannerSync";
import { runDailyTaskCleanupUpdate } from "@/utils/supabaseDailyTaskCleanup";
import type { Habit, HabitCompletion, HabitDifficulty, HabitCategory } from "../types";

const getToday = () => format(new Date(), "yyyy-MM-dd");

type LocalEpicHabitRow = {
  id: string;
  epic_id: string;
  habit_id: string;
};

type LocalTaskHabitCleanupRow = {
  id: string;
  user_id: string;
  habit_source_id: string | null;
  epic_id: string | null;
  epic_title?: string | null;
  task_date: string | null;
  completed: boolean | null;
  completed_at?: string | null;
};

function scrubDeletedHabitTaskRows<T>(rows: T | undefined, habitId: string): T | undefined {
  if (!Array.isArray(rows)) return rows;

  let changed = false;
  const nextRows = (rows as DailyTask[]).reduce<DailyTask[]>((next, task) => {
    if (task.habit_source_id !== habitId) {
      next.push(task);
      return next;
    }

    changed = true;
    if (task.completed === true || task.completed_at) {
      next.push({
        ...task,
        epic_id: null,
        epic_title: null,
        habit_source_id: null,
      });
    }
    return next;
  }, []);

  return changed ? (nextRows as T) : rows;
}

function scrubDeletedHabitTaskCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  habitId: string,
) {
  queryClient.setQueriesData({ queryKey: ["daily-tasks"] }, (old) =>
    scrubDeletedHabitTaskRows(old, habitId)
  );
  queryClient.setQueriesData({ queryKey: ["calendar-tasks"] }, (old) =>
    scrubDeletedHabitTaskRows(old, habitId)
  );
}

async function applyLocalHabitDelete(userId: string, habitId: string) {
  const localEpics = await loadLocalEpics(userId);
  const [epicHabits, localTasks, habitCompletions] = await Promise.all([
    getLocalEpicHabits<LocalEpicHabitRow>(localEpics.map((epic) => epic.id)),
    getAllLocalTasksForUser<LocalTaskHabitCleanupRow>(userId),
    getLocalHabitCompletions<Array<{ id: string; habit_id: string | null; user_id: string; date: string }>[number]>(userId),
  ]);

  const linkIdsToDelete = epicHabits
    .filter((link) => link.habit_id === habitId)
    .map((link) => link.id);
  const linkedTasks = localTasks.filter((task) => task.habit_source_id === habitId);
  const tasksToDelete = linkedTasks
    .filter((task) => task.completed !== true && !task.completed_at)
    .map((task) => task.id);
  const taskIdsToDelete = new Set(tasksToDelete);
  const tasksToDetach = linkedTasks
    .filter((task) => !taskIdsToDelete.has(task.id))
    .map((task) => ({
      ...task,
      epic_id: null,
      epic_title: null,
      habit_source_id: null,
    }));
  const completionsToDelete = habitCompletions
    .filter((completion) => completion.habit_id === habitId)
    .map((completion) => completion.id);

  if (tasksToDetach.length > 0) {
    await upsertPlannerRecords("daily_tasks", tasksToDetach);
  }
  if (tasksToDelete.length > 0) {
    await removePlannerRecords("daily_tasks", tasksToDelete);
  }
  if (linkIdsToDelete.length > 0) {
    await removePlannerRecords("epic_habits", linkIdsToDelete);
  }
  if (completionsToDelete.length > 0) {
    await removePlannerRecords("habit_completions", completionsToDelete);
  }

  await removePlannerRecord("habits", habitId);
}

async function applyRemoteHabitDelete(userId: string, habitId: string) {
  const { data: matchingLinks, error: linkLookupError } = await supabase
    .from("epic_habits")
    .select("id")
    .eq("habit_id", habitId);
  if (linkLookupError) throw linkLookupError;

  await runDailyTaskCleanupUpdate({
      epic_id: null,
      habit_source_id: null,
    }, (update) =>
      supabase
        .from("daily_tasks")
        .update(update)
        .eq("habit_source_id", habitId)
        .eq("user_id", userId)
        .or("completed.eq.true,completed_at.not.is.null")
    );

  const { error: deleteIncompleteTasksError } = await supabase
    .from("daily_tasks")
    .delete()
    .eq("habit_source_id", habitId)
    .eq("user_id", userId)
    .is("completed_at", null)
    .or("completed.is.null,completed.eq.false");
  if (deleteIncompleteTasksError) throw deleteIncompleteTasksError;

  const { error: completionError } = await supabase
    .from("habit_completions")
    .delete()
    .eq("habit_id", habitId)
    .eq("user_id", userId);
  if (completionError) throw completionError;

  const linkIds = (matchingLinks ?? []).map((link) => link.id);
  if (linkIds.length > 0) {
    const { error: linkDeleteError } = await supabase
      .from("epic_habits")
      .delete()
      .in("id", linkIds);
    if (linkDeleteError) throw linkDeleteError;
  }

  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", habitId)
    .eq("user_id", userId);
  if (error) throw error;
}

export function useHabits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { companion } = useCompanion();
  const { awardBehaviorStat, awardDisciplineForHabitCompletion } = useCompanionAttributes();
  const { awardCustomXP, awardAllHabitsComplete } = useXPRewards();
  const { checkDailyCompletionAchievement, checkFirstTimeAchievements, checkStreakAchievements } = useAchievements();
  const { queueAction, shouldQueueWrites, retryNow } = useResilience();

  const habitsQuery = useQuery({
    queryKey: ["habits", user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      return loadLocalHabits(user.id);
    },
    enabled: !!user?.id,
  });

  const completionsQuery = useQuery({
    queryKey: ["habit-completions", user?.id, getToday()],
    queryFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      return loadLocalHabitCompletions(user.id, getToday());
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user?.id) return;

    let disposed = false;

    const refreshFromRemote = async () => {
      try {
        await syncLocalHabitsFromRemote(user.id, getToday());
        if (disposed) return;

        queryClient.setQueryData(["habits", user.id], await loadLocalHabits(user.id));
        queryClient.setQueryData(["habit-completions", user.id, getToday()], await loadLocalHabitCompletions(user.id, getToday()));
      } catch (error) {
        console.warn("Failed to sync local habits from remote:", error);
      }
    };

    void refreshFromRemote();

    const handlePlannerSync = () => {
      void refreshFromRemote();
    };

    window.addEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    return () => {
      disposed = true;
      window.removeEventListener(PLANNER_SYNC_EVENT, handlePlannerSync);
    };
  }, [queryClient, user?.id]);

  const habits = habitsQuery.data ?? [];
  const completions = completionsQuery.data ?? [];

  const maybeAwardAllHabitsComplete = async () => {
    if (!user?.id || habits.length === 0) return;

    try {
      const today = getToday();
      const completionCount = (await loadLocalHabitCompletions(user.id, today)).length;

      if (completionCount < habits.length) {
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: existingBonus } = await supabase
        .from("xp_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_type", "all_habits_complete")
        .gte("created_at", startOfDay.toISOString())
        .maybeSingle();

      if (existingBonus) {
        return;
      }

      awardAllHabitsComplete();
      await checkDailyCompletionAchievement(today);
    } catch (error) {
      console.error("Failed to award all habits complete bonus:", error);
    }
  };

  const addHabitMutation = useMutation({
    mutationFn: async ({
      title,
      difficulty,
      selectedDays,
      preferredTime,
    }: {
      title: string;
      difficulty: HabitDifficulty;
      selectedDays: number[];
      preferredTime?: string;
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      if (habits.length >= 3) {
        throw new Error("Maximum 3 rhythms allowed");
      }

      const habitId = createOfflinePlannerId("habit");
      const autoCategory = categorizeQuest(title) as HabitCategory | null;
      const nowIso = new Date().toISOString();
      const habitRow: Habit & {
        description?: string | null;
        estimated_minutes?: number | null;
        preferred_time?: string | null;
        reminder_enabled?: boolean | null;
        reminder_minutes_before?: number | null;
        sort_order?: number | null;
      } = {
        id: habitId,
        user_id: user.id,
        title,
        frequency: selectedDays.length === 7 ? "daily" : "custom",
        custom_days: selectedDays.length === 7 ? null : selectedDays,
        custom_month_days: null,
        difficulty,
        category: autoCategory || "soul",
        preferred_time: preferredTime || null,
        reminder_enabled: false,
        reminder_minutes_before: 15,
        is_active: true,
        current_streak: 0,
        longest_streak: 0,
        created_at: nowIso,
        sort_order: habits.length,
      };

      await upsertPlannerRecord("habits", habitRow);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "HABIT_CREATE",
          entityType: "habit",
          entityId: habitId,
          payload: habitRow,
        });
        return { queued: true };
      }

      const { error } = await supabase.from("habits").insert(habitRow);
      if (error) {
        await queueAction({
          actionKind: "HABIT_CREATE",
          entityType: "habit",
          entityId: habitId,
          payload: habitRow,
        });
        void retryNow();
        return { queued: true };
      }

      return { queued: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      toast({
        title: result.queued ? "Habit saved offline" : "Habit created successfully!",
        description: result.queued ? "We'll sync it when you're back online." : undefined,
      });
      haptics.success();
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Failed to create habit",
        variant: "destructive",
      });
    },
  });

  const toggleHabitMutation = useMutation({
    mutationFn: async ({ habitId, isCompleted }: { habitId: string; isCompleted: boolean }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const today = getToday();
      const existingCompletion = completions.find((completion) => completion.habit_id === habitId);

      if (isCompleted) {
        if (existingCompletion?.id) {
          await removePlannerRecord("habit_completions", existingCompletion.id);
        }

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "HABIT_COMPLETION_SET",
            entityType: "habit_completion",
            entityId: habitId,
            payload: {
              habitId,
              date: today,
              completed: false,
            },
          });
          return { isCompleting: false, isFirstCompletion: false, queued: true };
        }

        const { error } = await supabase
          .from("habit_completions")
          .delete()
          .eq("habit_id", habitId)
          .eq("user_id", user.id)
          .eq("date", today);

        if (error) {
          await queueAction({
            actionKind: "HABIT_COMPLETION_SET",
            entityType: "habit_completion",
            entityId: habitId,
            payload: {
              habitId,
              date: today,
              completed: false,
            },
          });
          void retryNow();
          return { isCompleting: false, isFirstCompletion: false, queued: true };
        }

        return { isCompleting: false, isFirstCompletion: false, queued: false };
      }

      const completionId = existingCompletion?.id ?? createOfflinePlannerId("habit-completion");
      const completionRow: HabitCompletion = {
        id: completionId,
        habit_id: habitId,
        user_id: user.id,
        date: today,
        completed_at: new Date().toISOString(),
      };

      await upsertPlannerRecord("habit_completions", completionRow);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "HABIT_COMPLETION_SET",
          entityType: "habit_completion",
          entityId: habitId,
          payload: {
            completionId,
            habitId,
            date: today,
            completed: true,
          },
        });
        return { isCompleting: true, isFirstCompletion: true, queued: true };
      }

      const { data: insertedData, error: insertError } = await supabase
        .from("habit_completions")
        .insert({
          id: completionId,
          habit_id: habitId,
          user_id: user.id,
          date: today,
        })
        .select();

      if (insertError) {
        if (insertError.code !== "23505") {
          await queueAction({
            actionKind: "HABIT_COMPLETION_SET",
            entityType: "habit_completion",
            entityId: habitId,
            payload: {
              completionId,
              habitId,
              date: today,
              completed: true,
            },
          });
          void retryNow();
          return { isCompleting: true, isFirstCompletion: true, queued: true };
        }

        return { isCompleting: true, isFirstCompletion: false, queued: false };
      }

      const isFirstCompletion = Boolean(insertedData && insertedData.length > 0);
      if (isFirstCompletion) {
        const habit = habits.find((candidate) => candidate.id === habitId);
        if (habit) {
          const xpAmount = habit.difficulty ? getHabitXP(habit.difficulty as "easy" | "medium" | "hard") : HABIT_XP_REWARDS.EASY;
          await awardCustomXP(xpAmount, "habit_complete", "Habit Complete!");
          await maybeAwardAllHabitsComplete();

          if (companion?.id) {
            awardDisciplineForHabitCompletion({
              companionId: companion.id,
              habitId,
              date: today,
            }).catch((e) => {
              console.warn("Failed to update discipline from habit:", e);
            });
            awardBehaviorStat({
              companionId: companion.id,
              source: "habit",
              sourceId: habitId,
              title: habit.title,
              date: today,
              category: habit.category,
              difficulty: habit.difficulty,
            }).catch((e) => {
              console.warn("Failed to update companion stat from habit behavior:", e);
            });
          }

          if (profile?.current_habit_streak) {
            await checkStreakAchievements(profile.current_habit_streak);
          }

          const { count: completionCount } = await supabase
            .from("habit_completions")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id);

          if ((completionCount ?? 0) === 1) {
            await checkFirstTimeAchievements("habit");
          }

          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
          haptics.success();
        }
      }

      return { isCompleting: true, isFirstCompletion, queued: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["habit-completions"] });
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      if (result?.queued) {
        toast({
          title: "Habit saved offline",
          description: "We'll sync this habit completion when you're back online.",
        });
      }
    },
  });

  const updateHabitMutation = useMutation({
    mutationFn: async ({
      habitId,
      updates,
    }: {
      habitId: string;
      updates: {
        title?: string;
        description?: string | null;
        frequency?: string;
        estimated_minutes?: number | null;
        difficulty?: string;
        preferred_time?: string | null;
        category?: HabitCategory | null;
        custom_days?: number[] | null;
        custom_month_days?: number[] | null;
        reminder_enabled?: boolean | null;
        reminder_minutes_before?: number | null;
        sort_order?: number | null;
      };
    }) => {
      if (!user?.id) throw new Error("User not authenticated");

      const existingHabit = habits.find((habit) => habit.id === habitId);
      if (!existingHabit) throw new Error("Habit not found");

      await upsertPlannerRecord("habits", {
        ...existingHabit,
        ...updates,
      });

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "HABIT_UPDATE",
          entityType: "habit",
          entityId: habitId,
          payload: {
            habitId,
            updates,
          },
        });
        return { queued: true };
      }

      const { error } = await supabase
        .from("habits")
        .update(updates)
        .eq("id", habitId)
        .eq("user_id", user.id);

      if (error) {
        await queueAction({
          actionKind: "HABIT_UPDATE",
          entityType: "habit",
          entityId: habitId,
          payload: {
            habitId,
            updates,
          },
        });
        void retryNow();
        return { queued: true };
      }

      return { queued: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      toast({
        title: result.queued ? "Habit saved offline" : "Habit updated successfully!",
        description: result.queued ? "We'll sync this update when you're back online." : undefined,
      });
      haptics.success();
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Failed to update habit",
        variant: "destructive",
      });
    },
  });

  const deleteHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      if (!user?.id) throw new Error("User not authenticated");

      return withPlannerRemoteSyncLock(user.id, async () => {
        await applyLocalHabitDelete(user.id, habitId);
        queryClient.setQueryData(["habits", user.id], await loadLocalHabits(user.id));
        queryClient.setQueryData(
          ["habit-completions", user.id, getToday()],
          await loadLocalHabitCompletions(user.id, getToday()),
        );
        queryClient.setQueryData(getEpicsQueryKey(user.id), await loadLocalEpics(user.id));
        scrubDeletedHabitTaskCaches(queryClient, habitId);

        if (shouldQueueWrites) {
          await queueAction({
            actionKind: "HABIT_DELETE",
            entityType: "habit",
            entityId: habitId,
            payload: { habitId },
          });
          return { queued: true };
        }

        try {
          await applyRemoteHabitDelete(user.id, habitId);
        } catch (error) {
          await queueAction({
            actionKind: "HABIT_DELETE",
            entityType: "habit",
            entityId: habitId,
            payload: { habitId },
          });
          void retryNow();
          return { queued: true };
        }

        return { queued: false };
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["habit-completions"] });
      queryClient.invalidateQueries({ queryKey: ["epics"] });
      queryClient.invalidateQueries({ queryKey: ["daily-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["habit-surfacing"] });
      queryClient.invalidateQueries({ queryKey: ["user-ai-context"] });
      queryClient.resetQueries({ queryKey: DAILY_PLAN_OPTIMIZATION_QUERY_KEY });
      dispatchPlannerSyncFinished();
      toast({
        title: result.queued ? "Habit deleted offline" : "Habit deleted permanently",
        description: result.queued ? "We'll remove it from the server when you're back online." : undefined,
      });
      haptics.success();
    },
    onError: (error) => {
      toast({
        title: error instanceof Error ? error.message : "Failed to delete habit",
        variant: "destructive",
      });
    },
  });

  const reorderHabitsMutation = useMutation({
    mutationFn: async (reorderedHabits: { id: string; sort_order: number }[]) => {
      if (!user?.id) throw new Error("User not authenticated");

      const habitsById = new Map(habits.map((habit) => [habit.id, habit]));
      await Promise.all(
        reorderedHabits.map(async (habit) => {
          const existing = habitsById.get(habit.id);
          if (!existing) return;

          await upsertPlannerRecord("habits", {
            ...existing,
            sort_order: habit.sort_order,
          });
        }),
      );

      if (shouldQueueWrites) {
        await Promise.all(
          reorderedHabits.map((habit) =>
            queueAction({
              actionKind: "HABIT_UPDATE",
              entityType: "habit",
              entityId: habit.id,
              payload: {
                habitId: habit.id,
                updates: { sort_order: habit.sort_order },
              },
            }),
          ),
        );
        return { queued: true };
      }

      for (const habit of reorderedHabits) {
        const { error } = await supabase
          .from("habits")
          .update({ sort_order: habit.sort_order })
          .eq("id", habit.id)
          .eq("user_id", user.id);

        if (error) {
          await queueAction({
            actionKind: "HABIT_UPDATE",
            entityType: "habit",
            entityId: habit.id,
            payload: {
              habitId: habit.id,
              updates: { sort_order: habit.sort_order },
            },
          });
        }
      }

      return { queued: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });

  const habitProgress = habits.length > 0
    ? completions.length / habits.length
    : 0;

  return {
    habits,
    completions,
    habitsLoading: habitsQuery.isLoading,
    habitProgress,
    addHabit: addHabitMutation.mutate,
    addHabitAsync: addHabitMutation.mutateAsync,
    isAddingHabit: addHabitMutation.isPending,
    toggleHabit: toggleHabitMutation.mutate,
    isTogglingHabit: toggleHabitMutation.isPending,
    updateHabit: updateHabitMutation.mutateAsync,
    isUpdatingHabit: updateHabitMutation.isPending,
    deleteHabit: deleteHabitMutation.mutate,
    isDeletingHabit: deleteHabitMutation.isPending,
    reorderHabits: reorderHabitsMutation.mutate,
    isReorderingHabits: reorderHabitsMutation.isPending,
  };
}
