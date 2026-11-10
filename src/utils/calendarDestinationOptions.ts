import type { CalendarProvider, ConnectedCalendar } from "@/hooks/useCalendarIntegrations";

export type CalendarSendTarget = CalendarProvider | "all";

export interface CalendarSendTargetOption {
  target: CalendarSendTarget;
  label: string;
  description: string;
}

export function calendarProviderDisplayName(provider: CalendarProvider): string {
  if (provider === "google") return "Google";
  if (provider === "outlook") return "Outlook";
  return "Apple";
}

export function isCalendarProvider(value: unknown): value is CalendarProvider {
  return value === "google" || value === "outlook" || value === "apple";
}

export function isCalendarSendTarget(value: unknown): value is CalendarSendTarget {
  return value === "all" || isCalendarProvider(value);
}

export function getCalendarProviderProductLabel(
  provider: CalendarProvider,
  options: { scheduledOnly?: boolean } = {},
): string {
  if (provider === "google") return "Google Calendar";
  if (provider === "apple") return "Apple Calendar";
  return options.scheduledOnly ? "Outlook Calendar" : "Outlook Calendar / Microsoft To Do";
}

export function getCalendarConnectionDestinationName(
  connection: ConnectedCalendar,
  options: { scheduledOnly?: boolean } = {},
): string {
  if (connection.provider === "outlook" && !options.scheduledOnly) {
    const calendarName = connection.primary_calendar_name || connection.calendar_email || "Outlook Calendar";
    const taskListName = connection.primary_task_list_name || "Microsoft To Do";
    return `Calendar: ${calendarName}; To Do: ${taskListName}`;
  }

  return connection.primary_calendar_name
    || connection.calendar_email
    || "Selected calendar";
}

export function getInitialCalendarSendTarget(
  connections: ConnectedCalendar[],
  defaultProvider: CalendarProvider | null,
): CalendarSendTarget | null {
  if (defaultProvider && connections.some((connection) => connection.provider === defaultProvider)) {
    return defaultProvider;
  }

  return connections[0]?.provider ?? null;
}

export function isCalendarSendTargetAvailable(
  target: CalendarSendTarget | null | undefined,
  connections: ConnectedCalendar[],
): boolean {
  if (!target) return false;
  if (target === "all") return connections.length > 1;
  return connections.some((connection) => connection.provider === target);
}

export function buildCalendarSendTargetOptions(
  connections: ConnectedCalendar[],
  options: {
    defaultProvider?: CalendarProvider | null;
    includeAll?: boolean;
    scheduledOnly?: boolean;
  } = {},
): CalendarSendTargetOption[] {
  const byProvider = new Map<CalendarProvider, ConnectedCalendar>();
  for (const connection of connections) {
    if (!byProvider.has(connection.provider)) {
      byProvider.set(connection.provider, connection);
    }
  }

  const orderedConnections = Array.from(byProvider.values()).sort((left, right) => {
    if (options.defaultProvider && left.provider === options.defaultProvider) return -1;
    if (options.defaultProvider && right.provider === options.defaultProvider) return 1;
    return 0;
  });

  const providerOptions = orderedConnections.map((connection) => ({
    target: connection.provider,
    label: getCalendarProviderProductLabel(connection.provider, {
      scheduledOnly: options.scheduledOnly,
    }),
    description: getCalendarConnectionDestinationName(connection, {
      scheduledOnly: options.scheduledOnly,
    }),
  }));

  if (!options.includeAll || providerOptions.length < 2) {
    return providerOptions;
  }

  return [
    ...providerOptions,
    {
      target: "all",
      label: "All connected calendars",
      description: providerOptions.map((option) => option.label).join(", "),
    },
  ];
}
