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
import { createOfflinePlannerId, removePlannerRecord, upsertPlannerRecord } from "@/utils/plannerLocalStore";
import {
  PLANNER_SYNC_EVENT,
  loadLocalHabitCompletions,
  loadLocalHabits,
  syncLocalHabitsFromRemote,
} from "@/utils/plannerSync";
import type { Habit, HabitCompletion, HabitDifficulty, HabitCategory } from "../types";

const getToday = () => format(new Date(), "yyyy-MM-dd");

export function useHabits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { companion } = useCompanion();
  const { updateWisdomFromLearning, updateDisciplineFromRitual } = useCompanionAttributes();
  const { awardCustomXP, awardAllHabitsComplete } = useXPRewards();
  const { checkStreakAchievements } = useAchievements();
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

      if (habits.length >= 2) {
        throw new Error("Maximum 2 habits allowed");
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
            updateDisciplineFromRitual(companion.id).catch((e) => {
              console.warn("Failed to update discipline from habit:", e);
            });
            updateWisdomFromLearning(companion.id).catch((e) => {
              console.warn("Failed to update wisdom from learning:", e);
            });
          }

          if (profile?.current_habit_streak) {
            await checkStreakAchievements(profile.current_habit_streak);
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

      await removePlannerRecord("habits", habitId);

      if (shouldQueueWrites) {
        await queueAction({
          actionKind: "HABIT_DELETE",
          entityType: "habit",
          entityId: habitId,
          payload: { habitId },
        });
        return { queued: true };
      }

      const { error } = await supabase
        .from("habits")
        .delete()
        .eq("id", habitId)
        .eq("user_id", user.id);

      if (error) {
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
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
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
