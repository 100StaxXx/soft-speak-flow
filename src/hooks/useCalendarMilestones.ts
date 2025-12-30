import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface CalendarMilestone {
  id: string;
  title: string;
  target_date: string;
  milestone_percent: number;
  completed_at: string | null;
  epic_id: string;
  epic_title?: string;
  phase_name?: string | null;
}

export function useCalendarMilestones(selectedDate: Date) {
  const { user } = useAuth();

  const startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['calendar-milestones', user?.id, startDate, endDate],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch milestones with target dates in range
      const { data: milestonesData, error: milestonesError } = await supabase
        .from('epic_milestones')
        .select(`
          id,
          title,
          target_date,
          milestone_percent,
          completed_at,
          epic_id,
          phase_name
        `)
        .eq('user_id', user.id)
        .not('target_date', 'is', null)
        .gte('target_date', startDate)
        .lte('target_date', endDate)
        .order('target_date');

      if (milestonesError) {
        console.error('Error fetching milestones:', milestonesError);
        return [];
      }

      if (!milestonesData || milestonesData.length === 0) return [];

      // Get unique epic IDs
      const epicIds = [...new Set(milestonesData.map(m => m.epic_id))];

      // Fetch epic titles
      const { data: epicsData } = await supabase
        .from('epics')
        .select('id, title')
        .in('id', epicIds);

      const epicTitleMap = new Map(epicsData?.map(e => [e.id, e.title]) || []);

      return milestonesData.map(m => ({
        ...m,
        target_date: m.target_date!,
        epic_title: epicTitleMap.get(m.epic_id) || 'Campaign',
      })) as CalendarMilestone[];
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const getMilestonesForDate = (date: Date): CalendarMilestone[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return milestones.filter(m => m.target_date === dateStr);
  };

  return {
    milestones,
    isLoading,
    getMilestonesForDate,
  };
}
