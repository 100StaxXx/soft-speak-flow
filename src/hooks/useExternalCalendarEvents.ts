import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

import { useAuth } from "@/hooks/useAuth";
import {
  useCalendarIntegrations,
  type CalendarProvider,
  type ConnectedCalendar,
} from "@/hooks/useCalendarIntegrations";
import { supabase } from "@/integrations/supabase/client";
import { NativeCalendar } from "@/plugins/NativeCalendarPlugin";
import {
  dedupeExternalCalendarEvents,
  normalizeExternalCalendarEvent,
  type ExternalCalendarEvent,
  type RawExternalCalendarEvent,
} from "@/types/externalCalendar";
import { calendarProviderDisplayName } from "@/utils/calendarDestinationOptions";

const EXTERNAL_CALENDAR_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export interface ExternalCalendarSyncError {
  provider: CalendarProvider;
  message: string;
}

interface ExternalCalendarQueryResult {
  events: ExternalCalendarEvent[];
  errors: ExternalCalendarSyncError[];
  syncedAt: string;
}

interface UseExternalCalendarEventsOptions {
  enabled?: boolean;
}

const getConnectionCalendarName = (connection: ConnectedCalendar): string =>
  connection.primary_calendar_name
  || connection.calendar_email
  || `${calendarProviderDisplayName(connection.provider)} Calendar`;

const getRange = (selectedDate: Date) => {
  const rangeStart = startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 0 });
  const rangeEndExclusive = addDays(
    endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 0 }),
    1,
  );

  return {
    startDate: rangeStart.toISOString(),
    endDate: rangeEndExclusive.toISOString(),
  };
};

async function loadConnectionEvents(
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
      `${connection.provider}-calendar-events`,
      {
        body: {
          action: "listEvents",
          startDate: range.startDate,
          endDate: range.endDate,
          calendarId: connection.primary_calendar_id ?? undefined,
        },
      },
    );

    if (error) {
      throw new Error(error.message || `Failed to sync ${fallbackCalendarName}`);
    }

    rawEvents = Array.isArray(data?.events) ? data.events : [];
  }

  return rawEvents
    .map((event) => normalizeExternalCalendarEvent(
      event,
      connection.provider,
      fallbackCalendarName,
    ))
    .filter((event): event is ExternalCalendarEvent => event !== null);
}

export function useExternalCalendarEvents(
  selectedDate: Date,
  options: UseExternalCalendarEventsOptions = {},
) {
  const { user } = useAuth();
  const { enabled = true } = options;
  const {
    connections,
    isLoading: integrationsLoading,
  } = useCalendarIntegrations({ enabled });
  const range = useMemo(
    () => getRange(selectedDate),
    [selectedDate],
  );
  const connectionSignature = useMemo(
    () => connections
      .map((connection) => [
        connection.id,
        connection.provider,
        connection.primary_calendar_id ?? "primary",
      ].join(":"))
      .sort()
      .join("|"),
    [connections],
  );

  const query = useQuery({
    queryKey: [
      "external-calendar-events",
      user?.id,
      range.startDate,
      range.endDate,
      connectionSignature,
    ],
    enabled: enabled && !!user?.id && connections.length > 0,
    queryFn: async (): Promise<ExternalCalendarQueryResult> => {
      const settled = await Promise.allSettled(
        connections.map(async (connection) => ({
          provider: connection.provider,
          events: await loadConnectionEvents(connection, range),
        })),
      );
      const events: ExternalCalendarEvent[] = [];
      const errors: ExternalCalendarSyncError[] = [];

      settled.forEach((result, index) => {
        const connection = connections[index];
        if (!connection) return;

        if (result.status === "fulfilled") {
          events.push(...result.value.events);
          return;
        }

        errors.push({
          provider: connection.provider,
          message: result.reason instanceof Error
            ? result.reason.message
            : `Failed to sync ${getConnectionCalendarName(connection)}`,
        });
      });

      return {
        events: dedupeExternalCalendarEvents(events),
        errors,
        syncedAt: new Date().toISOString(),
      };
    },
    staleTime: 60_000,
    refetchInterval: connections.length > 0 ? EXTERNAL_CALENDAR_REFRESH_INTERVAL_MS : false,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  return {
    events: query.data?.events ?? [],
    errors: query.data?.errors ?? [],
    syncedAt: query.data?.syncedAt ?? null,
    connectedProviderCount: connections.length,
    isLoading: integrationsLoading || (connections.length > 0 && query.isLoading),
    isFetching: query.isFetching,
    refresh: query.refetch,
  };
}
