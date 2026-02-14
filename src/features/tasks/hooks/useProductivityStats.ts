import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfWeek, endOfWeek, eachDayOfInterval, format, subDays, parseISO } from 'date-fns';

export interface DailyStats {
  date: string;
  tasks_completed: number;
  tasks_created: number;
  focus_minutes: number;
  habits_completed: number;
  xp_earned: number;
  streak_day: number;
}

export interface WeeklyStats {
  week_start: string;
  total_tasks: number;
  total_focus_minutes: number;
  total_xp: number;
  avg_daily_tasks: number;
  best_day: string;
  completion_rate: number;
}

export interface ProductivityInsights {
  mostProductiveDay: string;
  mostProductiveHour: number;
  averageTasksPerDay: number;
  longestStreak: number;
  currentStreak: number;
  totalFocusHours: number;
  topCategory: string;
}

export function useProductivityStats() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch today's stats
  const { data: todayStats, isLoading: loadingToday } = useQuery({
    queryKey: ['productivity-stats', user?.id, 'today'],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const today = new Date().toISOString().split('T')[0];
      
      // Get tasks completed today
      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('id, completed, completed_at, xp_reward')
        .eq('user_id', user.id)
        .eq('task_date', today);

      // Get focus sessions today
      const { data: focusSessions } = await supabase
        .from('focus_sessions')
        .select('actual_duration, xp_earned')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('started_at', `${today}T00:00:00`);

      const completedTasks = tasks?.filter(t => t.completed) || [];
      const totalFocusMinutes = focusSessions?.reduce((acc, s) => acc + (s.actual_duration || 0), 0) || 0;
      const focusXP = focusSessions?.reduce((acc, s) => acc + (s.xp_earned || 0), 0) || 0;
      const taskXP = completedTasks.reduce((acc, t) => acc + (t.xp_reward || 0), 0);

      return {
        date: today,
        tasks_completed: completedTasks.length,
        tasks_created: tasks?.length || 0,
        focus_minutes: totalFocusMinutes,
        xp_earned: taskXP + focusXP,
        completion_rate: tasks?.length ? (completedTasks.length / tasks.length) * 100 : 0,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch weekly stats
  const { data: weeklyStats, isLoading: loadingWeekly } = useQuery({
    queryKey: ['productivity-stats', user?.id, 'weekly'],
    queryFn: async () => {
      if (!user?.id) return [];

      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

      const stats: DailyStats[] = [];

      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        
        const { data: tasks } = await supabase
          .from('daily_tasks')
          .select('id, completed, xp_reward')
          .eq('user_id', user.id)
          .eq('task_date', dateStr);

        const { data: focusSessions } = await supabase
          .from('focus_sessions')
          .select('actual_duration, xp_earned')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .gte('started_at', `${dateStr}T00:00:00`)
          .lt('started_at', `${dateStr}T23:59:59`);

        const completed = tasks?.filter(t => t.completed) || [];
        const focusMinutes = focusSessions?.reduce((acc, s) => acc + (s.actual_duration || 0), 0) || 0;
        const focusXP = focusSessions?.reduce((acc, s) => acc + (s.xp_earned || 0), 0) || 0;
        const taskXP = completed.reduce((acc, t) => acc + (t.xp_reward || 0), 0);

        stats.push({
          date: dateStr,
          tasks_completed: completed.length,
          tasks_created: tasks?.length || 0,
          focus_minutes: focusMinutes,
          habits_completed: 0,
          xp_earned: taskXP + focusXP,
          streak_day: 0,
        });
      }

      return stats;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate insights
  const { data: insights } = useQuery({
    queryKey: ['productivity-stats', user?.id, 'insights'],
    queryFn: async (): Promise<ProductivityInsights> => {
      if (!user?.id) {
        return {
          mostProductiveDay: 'Monday',
          mostProductiveHour: 9,
          averageTasksPerDay: 0,
          longestStreak: 0,
          currentStreak: 0,
          totalFocusHours: 0,
          topCategory: 'general',
        };
      }

      // Get last 30 days of data
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data: tasks } = await supabase
        .from('daily_tasks')
        .select('completed_at, category')
        .eq('user_id', user.id)
        .eq('completed', true)
        .gte('task_date', thirtyDaysAgo);

      const { data: focusSessions } = await supabase
        .from('focus_sessions')
        .select('actual_duration')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('started_at', `${thirtyDaysAgo}T00:00:00`);

      // Calculate most productive day
      const dayCount: Record<string, number> = {};
      tasks?.forEach(t => {
        if (t.completed_at) {
          const day = format(parseISO(t.completed_at), 'EEEE');
          dayCount[day] = (dayCount[day] || 0) + 1;
        }
      });
      const mostProductiveDay = Object.entries(dayCount)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Monday';

      // Calculate most productive hour
      const hourCount: Record<number, number> = {};
      tasks?.forEach(t => {
        if (t.completed_at) {
          const hour = parseISO(t.completed_at).getHours();
          hourCount[hour] = (hourCount[hour] || 0) + 1;
        }
      });
      const mostProductiveHour = Number(
        Object.entries(hourCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 9
      );

      // Calculate top category
      const categoryCount: Record<string, number> = {};
      tasks?.forEach(t => {
        const cat = t.category || 'general';
        categoryCount[cat] = (categoryCount[cat] || 0) + 1;
      });
      const topCategory = Object.entries(categoryCount)
        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'general';

      // Total focus hours
      const totalFocusMinutes = focusSessions?.reduce((acc, s) => acc + (s.actual_duration || 0), 0) || 0;

      return {
        mostProductiveDay,
        mostProductiveHour,
        averageTasksPerDay: Math.round((tasks?.length || 0) / 30),
        longestStreak: 0, // Would need streak table
        currentStreak: 0,
        totalFocusHours: Math.round(totalFocusMinutes / 60),
        topCategory,
      };
    },
    enabled: !!user?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Log productivity event
  const logEventMutation = useMutation({
    mutationFn: async ({ 
      eventType: _eventType, 
      xpEarned 
    }: { 
      eventType: string; 
      xpEarned: number;
    }) => {
      if (!user?.id) return;
      
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Upsert into productivity_stats
      const { error } = await supabase
        .from('productivity_stats')
        .upsert({
          user_id: user.id,
          stat_date: today,
          total_xp_earned: xpEarned,
        }, {
          onConflict: 'user_id,stat_date',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productivity-stats'] });
    },
  });

  // Calculate weekly summary
  const weeklySummary: WeeklyStats | null = weeklyStats && weeklyStats.length > 0 ? {
    week_start: weeklyStats[0].date,
    total_tasks: weeklyStats.reduce((acc, d) => acc + d.tasks_completed, 0),
    total_focus_minutes: weeklyStats.reduce((acc, d) => acc + d.focus_minutes, 0),
    total_xp: weeklyStats.reduce((acc, d) => acc + d.xp_earned, 0),
    avg_daily_tasks: Math.round(weeklyStats.reduce((acc, d) => acc + d.tasks_completed, 0) / 7),
    best_day: weeklyStats.reduce((best, current) => 
      current.tasks_completed > best.tasks_completed ? current : best
    ).date,
    completion_rate: weeklyStats.reduce((acc, d) => {
      if (d.tasks_created === 0) return acc;
      return acc + (d.tasks_completed / d.tasks_created);
    }, 0) / weeklyStats.filter(d => d.tasks_created > 0).length * 100 || 0,
  } : null;

  return {
    todayStats,
    weeklyStats: weeklyStats || [],
    weeklySummary,
    insights: insights || {
      mostProductiveDay: 'Monday',
      mostProductiveHour: 9,
      averageTasksPerDay: 0,
      longestStreak: 0,
      currentStreak: 0,
      totalFocusHours: 0,
      topCategory: 'general',
    },
    isLoading: loadingToday || loadingWeekly,
    logEvent: (eventType: string, xpEarned: number) => 
      logEventMutation.mutate({ eventType, xpEarned }),
  };
}
