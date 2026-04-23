import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type QuestAutocompleteQueryOptions = {
  userId?: string;
  includeTaskHistoryAll?: boolean;
  includeTaskHistoryDetail?: boolean;
  includeHabitsAll?: boolean;
  includeHabitsDetail?: boolean;
};

export const invalidateQuestAutocompleteQueries = async (
  queryClient: QueryClient,
  {
    userId,
    includeTaskHistoryAll = false,
    includeTaskHistoryDetail = false,
    includeHabitsAll = false,
    includeHabitsDetail = false,
  }: QuestAutocompleteQueryOptions = {},
) => {
  await Promise.all([
    ...(includeTaskHistoryAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.taskHistoryAll })]
      : []),
    ...(includeTaskHistoryDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.taskHistory(userId) })]
      : []),
    ...(includeHabitsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.habitsAll })]
      : []),
    ...(includeHabitsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.questAutocomplete.habits(userId) })]
      : []),
  ]);
};
