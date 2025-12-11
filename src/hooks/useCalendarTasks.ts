import { useQuery } from "@tanstack/react-query";
import { getDocuments, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";

export const useCalendarTasks = (selectedDate: Date, view: "list" | "month" | "week") => {
  const { user } = useAuth();

  const getDateRange = () => {
    if (view === "month") {
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return { start: calendarStart, end: calendarEnd };
    } else if (view === "week") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const weekEnd = addDays(weekStart, 6);
      return { start: weekStart, end: weekEnd };
    } else {
      // For list view, just get the week
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const weekEnd = addDays(weekStart, 6);
      return { start: weekStart, end: weekEnd };
    }
  };

  const { start, end } = getDateRange();
  const startDate = format(start, 'yyyy-MM-dd');
  const endDate = format(end, 'yyyy-MM-dd');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['calendar-tasks', user?.uid, startDate, endDate, view],
    queryFn: async () => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      // Firestore doesn't support range queries directly, so we fetch all tasks and filter
      // For better performance, you might want to use composite indexes
      const allTasks = await getDocuments(
        'daily_tasks',
        [['user_id', '==', user.uid]],
        'created_at',
        'desc'
      );

      // Filter by date range and convert timestamps
      const filteredTasks = allTasks
        .filter((task: any) => {
          const taskDate = task.task_date;
          return taskDate >= startDate && taskDate <= endDate;
        })
        .map((task: any) => ({
          ...task,
          created_at: timestampToISO(task.created_at as any) || task.created_at || new Date().toISOString(),
          completed_at: timestampToISO(task.completed_at as any) || task.completed_at,
        }))
        .sort((a: any, b: any) => {
          // Sort by scheduled_time first, then created_at
          if (a.scheduled_time && b.scheduled_time) {
            return a.scheduled_time.localeCompare(b.scheduled_time);
          }
          if (a.scheduled_time) return -1;
          if (b.scheduled_time) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      return filteredTasks;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes - calendar data changes infrequently
    refetchOnWindowFocus: false,
  });

  return { tasks, isLoading };
};
