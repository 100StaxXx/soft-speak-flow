import type { QueryClient } from "@tanstack/react-query";

import { JOURNAL_ENTRIES_QUERY_KEY } from "@/hooks/useJournalEntries";

export const invalidateJournalEntryQueries = async (
  queryClient: QueryClient,
) => queryClient.invalidateQueries({ queryKey: JOURNAL_ENTRIES_QUERY_KEY });
