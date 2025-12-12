import { useQuery } from "@tanstack/react-query";
import { getDocuments, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { subDays, format, startOfDay } from "date-fns";

export const useAnalytics = () => {
  const { user } = useAuth();

  // Habit completion trends (last 30 days)
  const { data: habitTrends, isLoading: habitsLoading } = useQuery({
    queryKey: ['analytics-habits', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const allCompletions = await getDocuments(
        'habit_completions',
        [
          ['user_id', '==', user.uid],
        ]
      );

      // Filter by date and group by date
      const dateMap = new Map<string, number>();
      allCompletions.forEach(completion => {
        const date = completion.date;
        if (date >= thirtyDaysAgo) {
          const count = dateMap.get(date) || 0;
          dateMap.set(date, count + 1);
        }
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
    queryKey: ['analytics-moods', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const allLogs = await getDocuments(
        'mood_logs',
        [
          ['user_id', '==', user.uid],
        ],
        'created_at',
        'asc'
      );

      // Filter by date and count mood frequencies
      const moodCounts = allLogs.reduce((acc, log) => {
        const createdAt = timestampToISO(log.created_at as any) || log.created_at;
        if (createdAt && new Date(createdAt) >= thirtyDaysAgo) {
          acc[log.mood] = (acc[log.mood] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      return Object.entries(moodCounts).map(([mood, count]) => ({
        mood,
        count
      }));
    },
    enabled: !!user,
  });

  // Streak stats
  const { data: streakStats, isLoading: streaksLoading } = useQuery({
    queryKey: ['analytics-streaks', user?.uid],
    queryFn: async () => {
      if (!user) return { current: 0, longest: 0, total: 0 };
      
      const data = await getDocuments(
        'habits',
        [
          ['user_id', '==', user.uid],
          ['is_active', '==', true],
        ]
      );
      
      const current = Math.max(...(data.map(h => (h as any).current_streak || 0)), 0);
      const longest = Math.max(...(data.map(h => (h as any).longest_streak || 0)), 0);
      const total = data.length;
      
      return { current, longest, total };
    },
    enabled: !!user,
  });

  // Check-in frequency
  const { data: checkInStats, isLoading: checkInsLoading } = useQuery({
    queryKey: ['analytics-checkins', user?.uid],
    queryFn: async () => {
      if (!user) return { total: 0, thisWeek: 0, lastWeek: 0 };
      
      const today = new Date();
      const weekAgo = subDays(today, 7);
      const twoWeeksAgo = subDays(today, 14);
      
      const allCheckIns = await getDocuments(
        'check_ins',
        [['user_id', '==', user.uid]]
      );

      const total = allCheckIns.length;
      const thisWeek = allCheckIns.filter(ci => {
        const date = ci.date || timestampToISO(ci.created_at as any);
        return date && date >= format(weekAgo, 'yyyy-MM-dd');
      }).length;
      const lastWeek = allCheckIns.filter(ci => {
        const date = ci.date || timestampToISO(ci.created_at as any);
        return date && date >= format(twoWeeksAgo, 'yyyy-MM-dd') && date < format(weekAgo, 'yyyy-MM-dd');
      }).length;

      return {
        total,
        thisWeek,
        lastWeek
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
