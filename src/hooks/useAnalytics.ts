import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { subDays, format } from "date-fns";

export const useAnalytics = () => {
  const { user } = useAuth();

  // Habit completion trends (last 30 days)
  const { data: habitTrends, isLoading: habitsLoading } = useQuery({
    queryKey: ['analytics-habits', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('habit_completions')
        .select('date, habit_id')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: true });
      
      if (error) throw error;
      
      // Group by date
      const dateMap = new Map<string, number>();
      data?.forEach(completion => {
        const count = dateMap.get(completion.date) || 0;
        dateMap.set(completion.date, count + 1);
      });
      
      // Fill in missing days with 0
      const result = [];
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        result.push({
          date,
          count: dateMap.get(date) || 0
        });
      }
      
      return result;
    },
    enabled: !!user,
  });

  // Mood patterns (last 30 days)
  const { data: moodTrends, isLoading: moodsLoading } = useQuery({
    queryKey: ['analytics-moods', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('mood_logs')
        .select('created_at, mood')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Count mood frequencies
      const moodCounts = data?.reduce((acc, log) => {
        acc[log.mood] = (acc[log.mood] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(moodCounts || {}).map(([mood, count]) => ({
        mood,
        count
      }));
    },
    enabled: !!user,
  });

  // Streak stats
  const { data: streakStats, isLoading: streaksLoading } = useQuery({
    queryKey: ['analytics-streaks', user?.id],
    queryFn: async () => {
      if (!user) return { current: 0, longest: 0, total: 0 };
      
      const { data, error } = await supabase
        .from('habits')
        .select('current_streak, longest_streak')
        .eq('user_id', user.id)
        .eq('is_active', true);
      
      if (error) throw error;
      
      const current = Math.max(...(data?.map(h => h.current_streak || 0) || [0]));
      const longest = Math.max(...(data?.map(h => h.longest_streak || 0) || [0]));
      const total = data?.length || 0;
      
      return { current, longest, total };
    },
    enabled: !!user,
  });

  // Check-in frequency
  const { data: checkInStats, isLoading: checkInsLoading } = useQuery({
    queryKey: ['analytics-checkins', user?.id],
    queryFn: async () => {
      if (!user) return { total: 0, thisWeek: 0, lastWeek: 0 };
      
      const today = new Date();
      const weekAgo = subDays(today, 7);
      const twoWeeksAgo = subDays(today, 14);
      
      const { count: total, error: totalError } = await supabase
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      if (totalError) throw totalError;

      const { count: thisWeekCount, error: thisWeekError } = await supabase
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('date', format(weekAgo, 'yyyy-MM-dd'));

      if (thisWeekError) throw thisWeekError;

      const { count: lastWeekCount, error: lastWeekError } = await supabase
        .from('check_ins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('date', format(twoWeeksAgo, 'yyyy-MM-dd'))
        .lt('date', format(weekAgo, 'yyyy-MM-dd'));

      if (lastWeekError) throw lastWeekError;

      return {
        total: total || 0,
        thisWeek: thisWeekCount || 0,
        lastWeek: lastWeekCount || 0
      };
    },
    enabled: !!user,
  });

  return {
    habitTrends,
    moodTrends,
    streakStats,
    checkInStats,
    isLoading: habitsLoading || moodsLoading || streaksLoading || checkInsLoading
  };
};
