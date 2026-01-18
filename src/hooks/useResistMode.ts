import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AdversaryTheme } from '@/types/astralEncounters';
import { toast } from 'sonner';

export interface BadHabit {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  habit_theme: string;
  times_resisted: number;
  current_streak: number;
  longest_streak: number;
  last_resisted_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ResistLog {
  id: string;
  user_id: string;
  habit_id: string;
  encounter_id: string | null;
  result: string;
  xp_earned: number;
  care_boost: number;
  created_at: string;
}

export const useResistMode = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's bad habits
  const { data: habits, isLoading: habitsLoading } = useQuery({
    queryKey: ['bad-habits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('user_bad_habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as BadHabit[];
    },
    enabled: !!user?.id,
  });

  // Fetch resist history (last 30 days)
  const { data: resistHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['resist-log', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('resist_log')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ResistLog[];
    },
    enabled: !!user?.id,
  });

  // Add a new bad habit
  const addHabitMutation = useMutation({
    mutationFn: async (params: { name: string; icon: string; theme: AdversaryTheme }) => {
      if (!user?.id) throw new Error('User not found');

      const { data, error } = await supabase
        .from('user_bad_habits')
        .insert({
          user_id: user.id,
          name: params.name,
          icon: params.icon,
          habit_theme: params.theme,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BadHabit;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bad-habits'] });
      toast.success('Bad habit added! Ready to resist.');
    },
    onError: (error) => {
      console.error('Failed to add habit:', error);
      toast.error('Failed to add habit');
    },
  });

  // Remove a bad habit (soft delete)
  const removeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      if (!user?.id) throw new Error('User not found');

      const { error } = await supabase
        .from('user_bad_habits')
        .update({ is_active: false })
        .eq('id', habitId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bad-habits'] });
      toast.success('Habit removed');
    },
    onError: (error) => {
      console.error('Failed to remove habit:', error);
      toast.error('Failed to remove habit');
    },
  });

  // Log a successful resist
  const logResistMutation = useMutation({
    mutationFn: async (params: {
      habitId: string;
      encounterId?: string;
      result: 'perfect' | 'good' | 'fail';
      xpEarned: number;
    }) => {
      if (!user?.id) throw new Error('User not found');

      const habit = habits?.find((h) => h.id === params.habitId);
      if (!habit) throw new Error('Habit not found');

      const careBoost = params.result !== 'fail' ? 0.05 : 0;

      // Log the resist attempt
      const { error: logError } = await supabase.from('resist_log').insert({
        user_id: user.id,
        habit_id: params.habitId,
        encounter_id: params.encounterId || null,
        result: params.result,
        xp_earned: params.xpEarned,
        care_boost: careBoost,
      });

      if (logError) throw logError;

      // Update habit stats
      const isSuccess = params.result !== 'fail';
      const isToday = habit.last_resisted_at
        ? new Date(habit.last_resisted_at).toDateString() === new Date().toDateString()
        : false;
      const wasYesterday = habit.last_resisted_at
        ? new Date(habit.last_resisted_at).toDateString() ===
          new Date(Date.now() - 86400000).toDateString()
        : false;

      let newStreak = habit.current_streak;
      if (isSuccess) {
        if (wasYesterday || isToday) {
          newStreak = isToday ? habit.current_streak : habit.current_streak + 1;
        } else {
          newStreak = 1; // Start new streak
        }
      } else {
        newStreak = 0; // Reset streak on fail
      }

      const { error: updateError } = await supabase
        .from('user_bad_habits')
        .update({
          times_resisted: habit.times_resisted + (isSuccess ? 1 : 0),
          current_streak: newStreak,
          longest_streak: Math.max(habit.longest_streak, newStreak),
          last_resisted_at: new Date().toISOString(),
        })
        .eq('id', params.habitId);

      if (updateError) throw updateError;

      // Boost companion care_recovery if successful
      if (isSuccess) {
        const { data: companion } = await supabase
          .from('user_companion')
          .select('id, care_recovery')
          .eq('user_id', user.id)
          .single();

        if (companion) {
          const currentRecovery = companion.care_recovery ?? 0;
          await supabase
            .from('user_companion')
            .update({
              care_recovery: Math.min(1, currentRecovery + careBoost),
            })
            .eq('id', companion.id);
        }
      }

      return { result: params.result, careBoost };
    },
    onSuccess: ({ result }) => {
      queryClient.invalidateQueries({ queryKey: ['bad-habits'] });
      queryClient.invalidateQueries({ queryKey: ['resist-log'] });
      queryClient.invalidateQueries({ queryKey: ['companion'] });

      if (result !== 'fail') {
        toast.success('You resisted! Your companion grows stronger.', {
          icon: '💪',
        });
      }
    },
    onError: (error) => {
      console.error('Failed to log resist:', error);
    },
  });

  // Get habit by ID
  const getHabit = useCallback(
    (habitId: string) => habits?.find((h) => h.id === habitId),
    [habits]
  );

  // Stats calculations
  const stats = useMemo(() => {
    const totalResisted = habits?.reduce((sum, h) => sum + h.times_resisted, 0) ?? 0;
    const successfulResists = resistHistory?.filter((r) => r.result !== 'fail').length ?? 0;
    const todayResists =
      resistHistory?.filter(
        (r) =>
          new Date(r.created_at).toDateString() === new Date().toDateString() &&
          r.result !== 'fail'
      ).length ?? 0;
    const bestStreak = Math.max(...(habits?.map((h) => h.longest_streak) ?? [0]));

    return {
      totalResisted,
      successfulResists,
      todayResists,
      bestStreak,
    };
  }, [habits, resistHistory]);

  return {
    // Data
    habits,
    resistHistory,
    stats,

    // Loading
    isLoading: habitsLoading || historyLoading,
    isAddingHabit: addHabitMutation.isPending,
    isLoggingResist: logResistMutation.isPending,

    // Actions
    addHabit: addHabitMutation.mutate,
    removeHabit: removeHabitMutation.mutate,
    logResist: logResistMutation.mutate,
    getHabit,
  };
};
