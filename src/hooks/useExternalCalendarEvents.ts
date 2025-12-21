import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export interface ExternalCalendarEvent {
  id: string;
  user_id: string;
  connection_id: string;
  external_event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  is_all_day: boolean | null;
  location: string | null;
  color: string | null;
  source: string;
  synced_at: string | null;
}

type DateRange = 'day' | 'week' | 'month';

interface UseExternalCalendarEventsOptions {
  date?: Date;
  range?: DateRange;
  startDate?: Date;
  endDate?: Date;
  enabled?: boolean;
}

function getDateRange(date: Date, range: DateRange): { start: Date; end: Date } {
  switch (range) {
    case 'day':
      return { start: startOfDay(date), end: endOfDay(date) };
    case 'week':
      return { start: startOfWeek(date, { weekStartsOn: 0 }), end: endOfWeek(date, { weekStartsOn: 0 }) };
    case 'month':
      return { start: startOfMonth(date), end: endOfMonth(date) };
    default:
      return { start: startOfDay(date), end: endOfDay(date) };
  }
}

export function useExternalCalendarEvents(options: UseExternalCalendarEventsOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const {
    date = new Date(),
    range = 'month',
    startDate,
    endDate,
    enabled = true,
  } = options;

  // Calculate date range
  const dateRange = startDate && endDate 
    ? { start: startDate, end: endDate }
    : getDateRange(date, range);

  const startISO = dateRange.start.toISOString();
  const endISO = dateRange.end.toISOString();

  // Fetch cached events from database
  const { data: events, isLoading, refetch } = useQuery({
    queryKey: ['external-calendar-events', user?.id, startISO, endISO],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('external_calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('start_time', startISO)
        .lte('end_time', endISO)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching external events:', error);
        return [];
      }

      return data as ExternalCalendarEvent[];
    },
    enabled: enabled && !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Sync events from Google Calendar
  const syncEvents = useMutation({
    mutationFn: async (syncRange?: { start: Date; end: Date }) => {
      const range = syncRange || dateRange;
      
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: {
          action: 'sync',
          startDate: range.start.toISOString(),
          endDate: range.end.toISOString(),
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to sync events');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-calendar-events'] });
    },
    onError: (error) => {
      console.error('Error syncing events:', error);
    },
  });

  // Clear cached events
  const clearCache = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-calendar-events', {
        body: { action: 'clear_cache' },
      });

      if (error) {
        throw new Error(error.message || 'Failed to clear cache');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-calendar-events'] });
    },
  });

  // Get events for a specific day
  const getEventsForDay = (targetDate: Date): ExternalCalendarEvent[] => {
    if (!events) return [];
    
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);
    
    return events.filter((event) => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      
      // Event overlaps with the day
      return eventStart <= dayEnd && eventEnd >= dayStart;
    });
  };

  // Get events for a specific hour
  const getEventsForHour = (targetDate: Date, hour: number): ExternalCalendarEvent[] => {
    if (!events) return [];
    
    const hourStart = new Date(targetDate);
    hourStart.setHours(hour, 0, 0, 0);
    
    const hourEnd = new Date(targetDate);
    hourEnd.setHours(hour, 59, 59, 999);
    
    return events.filter((event) => {
      if (event.is_all_day) return false;
      
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      
      return eventStart <= hourEnd && eventEnd >= hourStart;
    });
  };

  // Get all-day events for a specific day
  const getAllDayEventsForDay = (targetDate: Date): ExternalCalendarEvent[] => {
    if (!events) return [];
    
    const dayStr = format(targetDate, 'yyyy-MM-dd');
    
    return events.filter((event) => {
      if (!event.is_all_day) return false;
      
      const eventStartStr = format(new Date(event.start_time), 'yyyy-MM-dd');
      const eventEndStr = format(new Date(event.end_time), 'yyyy-MM-dd');
      
      return dayStr >= eventStartStr && dayStr <= eventEndStr;
    });
  };

  return {
    events: events || [],
    isLoading,
    refetch,
    syncEvents,
    clearCache,
    isSyncing: syncEvents.isPending,
    getEventsForDay,
    getEventsForHour,
    getAllDayEventsForDay,
  };
}
