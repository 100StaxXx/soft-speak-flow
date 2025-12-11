import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, setDocument, deleteDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useAchievements } from "@/hooks/useAchievements";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useProfile } from "@/hooks/useProfile";
import { getHabitXP } from "@/config/xpRewards";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { format } from "date-fns";
import type { Habit, HabitCompletion, HabitDifficulty } from "../types";

export function useHabits() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useProfile();
  const { companion } = useCompanion();
  const { updateMindFromHabit, updateBodyFromActivity } = useCompanionAttributes();
  const { awardCustomXP, awardAllHabitsComplete } = useXPRewards();
  const { checkStreakAchievements } = useAchievements();

  // Fetch habits
  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['habits', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error('User not authenticated');
      
      const data = await getDocuments<Habit>(
        'habits',
        [
          ['user_id', '==', user.uid],
          ['is_active', '==', true],
        ]
      );
      return data;
    },
    enabled: !!user,
  });

  // Fetch completions for today
  const { data: completions = [] } = useQuery({
    queryKey: ['habit-completions', user?.uid],
    queryFn: async () => {
      if (!user?.uid) throw new Error('User not authenticated');
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const data = await getDocuments<HabitCompletion>(
        'habit_completions',
        [
          ['user_id', '==', user.uid],
          ['date', '==', today],
        ]
      );
      return data;
    },
    enabled: !!user,
  });

  const maybeAwardAllHabitsComplete = async () => {
    if (!user?.uid || habits.length === 0) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayCompletions = await getDocuments(
        'habit_completions',
        [
          ['user_id', '==', user.uid],
          ['date', '==', today],
        ]
      );

      if (todayCompletions.length < habits.length) {
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const existingBonuses = await getDocuments(
        'xp_events',
        [
          ['user_id', '==', user.uid],
          ['event_type', '==', 'all_habits_complete'],
        ]
      );

      // Check if any bonus was created today
      const todayBonus = existingBonuses.find((bonus: any) => {
        const createdAt = timestampToISO(bonus.created_at as any) || bonus.created_at;
        return createdAt && new Date(createdAt) >= startOfDay;
      });

      if (todayBonus) {
        return;
      }

      awardAllHabitsComplete();
    } catch (error) {
      console.error('Failed to award all habits complete bonus:', error);
    }
  };

  // Add habit mutation
  const addHabitMutation = useMutation({
    mutationFn: async ({ 
      title, 
      difficulty, 
      selectedDays 
    }: { 
      title: string; 
      difficulty: HabitDifficulty; 
      selectedDays: number[] 
    }) => {
      if (!user?.uid) throw new Error('User not authenticated');
      
      // Check for max habits
      const existingHabits = await getDocuments(
        'habits',
        [
          ['user_id', '==', user.uid],
          ['is_active', '==', true],
        ]
      );
      
      if (existingHabits.length >= 2) {
        throw new Error('Maximum 2 habits allowed');
      }
      
      const habitId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await setDocument('habits', habitId, {
        id: habitId,
        user_id: user.uid,
        title,
        frequency: selectedDays.length === 7 ? 'daily' : 'custom',
        custom_days: selectedDays.length === 7 ? null : selectedDays,
        difficulty,
        is_active: true,
      }, false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast({ title: "Habit created successfully!" });
      haptics.success();
    },
    onError: (error) => {
      toast({ 
        title: error instanceof Error ? error.message : "Failed to create habit", 
        variant: "destructive" 
      });
    },
  });

  // Toggle habit completion
  const toggleHabitMutation = useMutation({
    mutationFn: async ({ habitId, isCompleted }: { habitId: string; isCompleted: boolean }) => {
      if (!user?.uid) throw new Error('User not authenticated');
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (isCompleted) {
        // Unchecking - remove completion record but DON'T remove XP
        const completions = await getDocuments(
          'habit_completions',
          [
            ['habit_id', '==', habitId],
            ['user_id', '==', user.uid],
            ['date', '==', today],
          ]
        );

        for (const completion of completions) {
          await deleteDocument('habit_completions', completion.id);
        }
        return { isCompleting: false, isFirstCompletion: false };
      } else {
        // Check if already completed (prevent duplicates)
        const existing = await getDocuments(
          'habit_completions',
          [
            ['habit_id', '==', habitId],
            ['user_id', '==', user.uid],
            ['date', '==', today],
          ]
        );

        if (existing.length > 0) {
          return { isCompleting: true, isFirstCompletion: false };
        }

        // Create completion record
        const completionId = `${user.uid}_${habitId}_${today}`;
        await setDocument('habit_completions', completionId, {
          id: completionId,
          habit_id: habitId,
          user_id: user.uid,
          date: today,
        }, false);
        
        const habit = habits.find(h => h.id === habitId);
        if (!habit) throw new Error('Habit not found');
        
        const xpAmount = habit.difficulty ? getHabitXP(habit.difficulty as 'easy' | 'medium' | 'hard') : 10;
        await awardCustomXP(xpAmount, 'habit_complete', 'Habit Complete!');
        await maybeAwardAllHabitsComplete();
        
        // Update companion attributes in background
        if (companion?.id) {
          updateMindFromHabit(companion.id).catch(() => {});
          updateBodyFromActivity(companion.id).catch(() => {});
        }
        
        // Check for streak achievements
        if (profile?.current_habit_streak) {
          await checkStreakAchievements(profile.current_habit_streak);
        }
        
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
        haptics.success();
        
        return { isCompleting: true, isFirstCompletion: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  const habitProgress = habits.length > 0 
    ? completions.length / habits.length 
    : 0;

  return {
    habits,
    completions,
    habitsLoading,
    habitProgress,
    addHabit: addHabitMutation.mutate,
    isAddingHabit: addHabitMutation.isPending,
    toggleHabit: toggleHabitMutation.mutate,
    isTogglingHabit: toggleHabitMutation.isPending,
  };
}
