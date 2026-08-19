import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import type {
  PlannerContextCalendarEvent,
  PlannerHorizon,
} from "@/types/companionPlanner";
import { supabase } from "@/integrations/supabase/client";

interface UseExternalCalendarEventsOptions {
  enabled?: boolean;
}

const getRangeDays = (horizon: PlannerHorizon): number => (
  horizon === "month" ? 30 : horizon === "week" ? 7 : 1
);

export function useExternalCalendarEvents(
  selectedDate: Date,
  horizon: PlannerHorizon,
  options: UseExternalCalendarEventsOptions = {},
) {
  const { user } = useAuth();
  const { enabled = true } = options;

  const range = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = addDays(start, getRangeDays(horizon));
    end.setHours(0, 0, 0, 0);

    return {
      start,
      end,
      startKey: format(start, "yyyy-MM-dd"),
      endKey: format(addDays(end, -1), "yyyy-MM-dd"),
    };
  }, [horizon, selectedDate]);

  const query = useQuery({
    queryKey: ["external-calendar-events", user?.id, range.startKey, range.endKey, horizon],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<PlannerContextCalendarEvent[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("external_calendar_events")
        .select("id, external_event_id, title, start_time, end_time, is_all_day, source")
        .eq("user_id", user.id)
        .lt("start_time", range.end.toISOString())
        .gt("end_time", range.start.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((event) => ({
        id: `${event.source}:${event.external_event_id || event.id}`,
        title: event.title,
        start: event.start_time,
        end: event.end_time,
        isAllDay: event.is_all_day ?? false,
        provider: event.source,
        readOnly: true,
      }));
    },
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
