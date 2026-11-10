import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import type {
  PlannerContextCalendarEvent,
  PlannerHorizon,
} from "@/types/companionPlanner";
import { supabase } from "@/integrations/supabase/client";

import { NativeCalendar } from "@/plugins/NativeCalendarPlugin";
import {
  dedupeExternalCalendarEvents,
  normalizeExternalCalendarEvent,
  type ExternalCalendarEvent,
  type RawExternalCalendarEvent,
} from "@/types/externalCalendar";
import { calendarProviderDisplayName } from "@/utils/calendarDestinationOptions";
import { parseFunctionInvokeError, toUserFacingFunctionError } from "@/utils/supabaseFunctionErrors";

import type { ConnectedCalendar } from "@/hooks/useCalendarIntegrations";

const getConnectionCalendarName = (connection: ConnectedCalendar): string =>
  connection.primary_calendar_name
  || connection.calendar_email
  || `${calendarProviderDisplayName(connection.provider)} Calendar`;

export async function loadConnectionEvents(
  connection: ConnectedCalendar,
  range: { startDate: string; endDate: string },
): Promise<ExternalCalendarEvent[]> {
  const fallbackCalendarName = getConnectionCalendarName(connection);
  let rawEvents: RawExternalCalendarEvent[] = [];

  if (connection.provider === "apple") {
    if (!connection.primary_calendar_id) {
      throw new Error("Choose an Apple calendar in Preferences before syncing Agenda.");
    }

    const available = await NativeCalendar.isAvailable();
    if (!available.available) {
      throw new Error("Apple Calendar is unavailable in this app build.");
    }

    const result = await NativeCalendar.listEvents({
      calendarId: connection.primary_calendar_id,
      startDate: range.startDate,
      endDate: range.endDate,
    });
    rawEvents = result.events;
  } else {
    const { data, error } = await supabase.functions.invoke(
      "calendar-read-events",
      {
        body: {
          action: "listEvents",
          provider: connection.provider,
          startDate: range.startDate,
          endDate: range.endDate,
          calendarId: connection.primary_calendar_id ?? undefined,
        },
      },
    );

    if (error) {
      const parsed = await parseFunctionInvokeError(error);
      if (parsed.status === 409) {
        throw new Error(`Reconnect ${calendarProviderDisplayName(connection.provider)} in Preferences, then retry calendar sync.`);
      }
      throw new Error(toUserFacingFunctionError(parsed, { action: `sync ${fallbackCalendarName}` }));
    }

    rawEvents = Array.isArray(data?.events) ? data.events : [];
  }

  return rawEvents
    .map((event) => normalizeExternalCalendarEvent(
      { ...event, connectionId: connection.id },
      connection.provider,
      fallbackCalendarName,
    ))
    .filter((event): event is ExternalCalendarEvent => event !== null);
}

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
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<PlannerContextCalendarEvent[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("external_calendar_events")
        .select("id, title, start_time, end_time, is_all_day, source")
        .eq("user_id", user.id)
        .lt("start_time", range.end.toISOString())
        .gte("end_time", range.start.toISOString())
        .order("start_time", { ascending: true });

      if (error) throw error;

      return (data ?? []).map((event) => ({
        id: event.id,
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
  };
}
