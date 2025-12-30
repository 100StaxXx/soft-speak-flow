import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { data } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      return (data || []) as Habit[];
    },
    enabled: !!user,
  });

  // Fetch completions for today
  const { data: completions = [] } = useQuery({
    queryKey: ['habit-completions', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today);
      return (data || []) as HabitCompletion[];
    },
    enabled: !!user,
  });

  const maybeAwardAllHabitsComplete = async () => {
    if (!user?.id || habits.length === 0) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count } = await supabase
        .from('habit_completions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('date', today);

      if ((count ?? 0) < habits.length) {
        return;
      }

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data: existingBonus } = await supabase
        .from('xp_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_type', 'all_habits_complete')
        .gte('created_at', startOfDay.toISOString())
        .maybeSingle();

      if (existingBonus) {
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
      if (!user?.id) throw new Error('User not authenticated');
      
      // Database-level check for max habits
      const { count } = await supabase
        .from('habits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (count && count >= 2) {
        throw new Error('Maximum 2 habits allowed');
      }
      
      const { error } = await supabase.from('habits').insert({
        user_id: user.id,
        title,
        frequency: selectedDays.length === 7 ? 'daily' : 'custom',
        custom_days: selectedDays.length === 7 ? null : selectedDays,
        difficulty,
      });
      
      if (error) throw error;
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
      if (!user?.id) throw new Error('User not authenticated');
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      if (isCompleted) {
        // Unchecking - remove completion record but DON'T remove XP
        const { error } = await supabase
          .from('habit_completions')
          .delete()
          .eq('habit_id', habitId)
          .eq('user_id', user.id)
          .eq('date', today);
        if (error) throw error;
        return { isCompleting: false, isFirstCompletion: false };
      } else {
        // ATOMIC INSERT: Use unique constraint to prevent duplicates
        const { data: insertedData, error: insertError } = await supabase
          .from('habit_completions')
          .insert({ habit_id: habitId, user_id: user.id, date: today })
          .select();

        if (insertError) {
          if (insertError.code === '23505') {
            return { isCompleting: true, isFirstCompletion: false };
          }
          throw insertError;
        }
        
        const isFirstCompletion = insertedData && insertedData.length > 0;
        if (isFirstCompletion) {
          const habit = habits.find(h => h.id === habitId);
          if (!habit) throw new Error('Habit not found');
          
          const xpAmount = habit.difficulty ? getHabitXP(habit.difficulty as 'easy' | 'medium' | 'hard') : HABIT_XP_REWARDS.EASY;
          await awardCustomXP(xpAmount, 'habit_complete', 'Habit Complete!');
          await maybeAwardAllHabitsComplete();
          
          // Update companion attributes in background
          if (companion?.id) {
            updateMindFromHabit(companion.id).catch((e) => {
              console.warn('Failed to update mind from habit:', e);
            });
            updateBodyFromActivity(companion.id).catch((e) => {
              console.warn('Failed to update body from activity:', e);
            });
          }
          
          // Check for streak achievements
          if (profile?.current_habit_streak) {
            await checkStreakAchievements(profile.current_habit_streak);
          }
          
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
          haptics.success();
        }
        
        return { isCompleting: true, isFirstCompletion };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });

  // Update habit mutation
  const updateHabitMutation = useMutation({
    mutationFn: async ({ 
      habitId, 
      updates 
    }: { 
      habitId: string; 
      updates: {
        title?: string;
        description?: string | null;
        frequency?: string;
        estimated_minutes?: number | null;
        difficulty?: string;
      }
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('habits')
        .update(updates)
        .eq('id', habitId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['epics'] });
      toast({ title: "Habit updated successfully!" });
      haptics.success();
    },
    onError: (error) => {
      toast({ 
        title: error instanceof Error ? error.message : "Failed to update habit", 
        variant: "destructive" 
      });
    },
  });

  // Delete habit permanently
  const deleteHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', habitId)
        .eq('user_id', user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      toast({ title: "Habit deleted permanently" });
      haptics.success();
    },
    onError: (error) => {
      toast({ 
        title: error instanceof Error ? error.message : "Failed to delete habit", 
        variant: "destructive" 
      });
    },
  });

  // Reorder habits
  const reorderHabitsMutation = useMutation({
    mutationFn: async (reorderedHabits: { id: string; sort_order: number }[]) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      for (const habit of reorderedHabits) {
        const { error } = await supabase
          .from('habits')
          .update({ sort_order: habit.sort_order })
          .eq('id', habit.id)
          .eq('user_id', user.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
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
    updateHabit: updateHabitMutation.mutateAsync,
    isUpdatingHabit: updateHabitMutation.isPending,
    deleteHabit: deleteHabitMutation.mutate,
    isDeletingHabit: deleteHabitMutation.isPending,
    reorderHabits: reorderHabitsMutation.mutate,
    isReorderingHabits: reorderHabitsMutation.isPending,
  };
}
