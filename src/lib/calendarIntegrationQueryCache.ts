import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type CalendarIntegrationQueryOptions = {
  userId?: string;
  startDate?: string;
  endDate?: string;
  horizon?: string;
  includeSettingsAll?: boolean;
  includeSettingsDetail?: boolean;
  includeConnectionsAll?: boolean;
  includeConnectionsDetail?: boolean;
  includeQuestLinksAll?: boolean;
  includeQuestLinksDetail?: boolean;
  includeOutlookTaskLinksAll?: boolean;
  includeOutlookTaskLinksDetail?: boolean;
  includeExternalEventsAll?: boolean;
  includeExternalEventsDetail?: boolean;
};

export const invalidateCalendarIntegrationQueries = async (
  queryClient: QueryClient,
  {
    userId,
    startDate,
    endDate,
    horizon,
    includeSettingsAll = false,
    includeSettingsDetail = false,
    includeConnectionsAll = false,
    includeConnectionsDetail = false,
    includeQuestLinksAll = false,
    includeQuestLinksDetail = false,
    includeOutlookTaskLinksAll = false,
    includeOutlookTaskLinksDetail = false,
    includeExternalEventsAll = false,
    includeExternalEventsDetail = false,
  }: CalendarIntegrationQueryOptions = {},
) => {
  await Promise.all([
    ...(includeSettingsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.settingsAll })]
      : []),
    ...(includeSettingsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.settings(userId) })]
      : []),
    ...(includeConnectionsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.connectionsAll })]
      : []),
    ...(includeConnectionsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.connections(userId) })]
      : []),
    ...(includeQuestLinksAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.questLinksAll })]
      : []),
    ...(includeQuestLinksDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.questLinks(userId) })]
      : []),
    ...(includeOutlookTaskLinksAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.outlookTaskLinksAll })]
      : []),
    ...(includeOutlookTaskLinksDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.outlookTaskLinks(userId) })]
      : []),
    ...(includeExternalEventsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.calendar.externalEventsAll })]
      : []),
    ...(includeExternalEventsDetail && startDate && endDate && horizon
      ? [queryClient.invalidateQueries({
        queryKey: queryKeys.calendar.externalEvents(userId, startDate, endDate, horizon),
      })]
      : []),
  ]);
};
