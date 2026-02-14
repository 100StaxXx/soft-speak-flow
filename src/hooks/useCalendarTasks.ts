import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays } from "date-fns";

interface CalendarTasksOptions {
  enabled?: boolean;
}

export const useCalendarTasks = (
  selectedDate: Date,
  view: "list" | "month" | "week",
  options: CalendarTasksOptions = {},
) => {
  const { user } = useAuth();
  const { enabled = true } = options;

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
    queryKey: ['calendar-tasks', user?.id, startDate, endDate, view],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('task_date', startDate)
        .lte('task_date', endDate)
        .order('scheduled_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes - calendar data changes infrequently
    refetchOnWindowFocus: false,
  });

  return { tasks, isLoading };
};
