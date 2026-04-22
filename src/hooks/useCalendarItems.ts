import type { PlannerHorizon } from "@/types/companionPlanner";

import { useCalendarTasks } from "@/hooks/useCalendarTasks";
import { useDailyTasks } from "@/hooks/useDailyTasks";
import { useExternalCalendarEvents } from "@/hooks/useExternalCalendarEvents";
import { useQuestCalendarSync } from "@/hooks/useQuestCalendarSync";
import {
  toCalendarItemFromExternalEvent,
  toCalendarItemFromQuest,
} from "@/shared/calendarItemAdapters";

interface UseCalendarItemsOptions {
  enabled?: boolean;
  includeExternal?: boolean;
  includeQuests?: boolean;
}

export const useCalendarItems = (
  selectedDate: Date,
  horizon: PlannerHorizon,
  options: UseCalendarItemsOptions = {},
) => {
  const {
    enabled = true,
    includeExternal = true,
    includeQuests = true,
  } = options;

  const externalEvents = useExternalCalendarEvents(selectedDate, horizon, {
    enabled: enabled && includeExternal,
  });
  const dayQuests = useDailyTasks(selectedDate, {
    enabled: enabled && includeQuests && horizon === "day",
  });
  const rangeQuests = useCalendarTasks(
    selectedDate,
    horizon === "month" ? "month" : "week",
    {
      enabled: enabled && includeQuests && horizon !== "day",
    },
  );
  const calendarSync = useQuestCalendarSync({
    enabled: enabled && includeQuests,
  });

  const questTasks = horizon === "day" ? dayQuests.tasks : rangeQuests.tasks;
  const questLoading = horizon === "day" ? dayQuests.isLoading : rangeQuests.isLoading;

  const items = [
    ...externalEvents.events.map((event) => toCalendarItemFromExternalEvent({
      id: event.id,
      connection_id: "",
      title: event.title,
      start_time: event.start,
      end_time: event.end,
      is_all_day: event.isAllDay,
      source: event.provider,
      external_event_id: event.id,
      color: null,
      description: null,
      location: null,
      raw_data: null,
      synced_at: null,
      user_id: "",
    })),
    ...questTasks
      .map((task) => toCalendarItemFromQuest(task, {
        calendarLinks: calendarSync.linksByTask.get(task.id),
        outlookTaskLinks: calendarSync.outlookTaskLinksByTask.get(task.id),
      }))
      .filter((item): item is NonNullable<typeof item> => item !== null),
  ].sort((left, right) => (
    left.startsAt.localeCompare(right.startsAt)
    || left.title.localeCompare(right.title)
    || left.id.localeCompare(right.id)
  ));

  return {
    items,
    isLoading: externalEvents.isLoading || questLoading,
  };
};
