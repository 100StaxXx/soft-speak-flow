import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AdversaryTheme } from '@/types/astralEncounters';
import { ASTRAL_ENCOUNTER_DAILY_XP_CAP } from '@/config/xpRewards';
import { toast } from "@/components/ui/sonner";

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
  const now = new Date();
  const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

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

  const { data: todayAstralXpEvents, isLoading: astralXpLoading } = useQuery({
    queryKey: ['astral-encounter-xp-today', user?.id, startOfTodayIso],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('xp_events')
        .select('xp_earned')
        .eq('user_id', user.id)
        .eq('event_type', 'astral_encounter')
        .gte('created_at', startOfTodayIso);

      if (error) throw error;
      return data ?? [];
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
    onSuccess: (newHabit) => {
      queryClient.setQueryData(
        ['bad-habits', user?.id],
        (old: BadHabit[] | undefined) => [newHabit, ...(old ?? [])]
      );
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
    onSuccess: (_data, habitId) => {
      queryClient.setQueryData(
        ['bad-habits', user?.id],
        (old: BadHabit[] | undefined) => (old ?? []).filter(h => h.id !== habitId)
      );
      queryClient.invalidateQueries({ queryKey: ['bad-habits'] });
      toast.success('Habit removed');
    },
    onError: (error) => {
      console.error('Failed to remove habit:', error);
      toast.error('Failed to remove habit');
    },
  });

  // Note: Resist logging is now handled automatically in useAstralEncounters.completeEncounter
  // when trigger_type === 'urge_resist'. This keeps all encounter completion logic centralized.

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
    const astralXpToday = todayAstralXpEvents?.reduce(
      (sum, event) => sum + Math.max(0, event.xp_earned ?? 0),
      0,
    ) ?? 0;
    const astralXpRemaining = Math.max(0, ASTRAL_ENCOUNTER_DAILY_XP_CAP - astralXpToday);
    const astralXpCapReached = astralXpRemaining <= 0;

    return {
      totalResisted,
      successfulResists,
      todayResists,
      bestStreak,
      astralXpToday,
      astralXpRemaining,
      astralXpCapReached,
    };
  }, [habits, resistHistory, todayAstralXpEvents]);

  return {
    // Data
    habits,
    resistHistory,
    stats,

    // Loading
    isLoading: habitsLoading || historyLoading || astralXpLoading,
    isAddingHabit: addHabitMutation.isPending,
    isRemovingHabit: removeHabitMutation.isPending,

    // Actions
    addHabit: addHabitMutation.mutate,
    removeHabit: removeHabitMutation.mutate,
    getHabit,
  };
};
