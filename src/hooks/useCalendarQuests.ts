import { toQuest } from "@/features/quests/adapters";
import { useLegacyCalendarTaskRange } from "@/hooks/internal/useLegacyCalendarTaskRange";

type UseLegacyCalendarTaskRangeArgs = Parameters<typeof useLegacyCalendarTaskRange>;

export const useCalendarQuests = (
  selectedDate: UseLegacyCalendarTaskRangeArgs[0],
  view: UseLegacyCalendarTaskRangeArgs[1],
  options: UseLegacyCalendarTaskRangeArgs[2] = {},
) => {
  const legacyTasks = useLegacyCalendarTaskRange(selectedDate, view, options);

  return {
    quests: legacyTasks.tasks.map(toQuest),
    isLoading: legacyTasks.isLoading,
  };
};
