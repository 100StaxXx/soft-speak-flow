import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

export const invalidateJournalEntryQueries = async (
  queryClient: QueryClient,
) => queryClient.invalidateQueries({ queryKey: queryKeys.journalEntries.all });
