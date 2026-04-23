import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type RecurringTemplateQueryOptions = {
  userId?: string;
  date?: string;
  includeAll?: boolean;
  includePending?: boolean;
};

type SetRecurringTemplateQueryOptions = {
  userId?: string;
  date: string;
  templates: unknown[];
};

export const invalidateRecurringTemplateQueries = async (
  queryClient: QueryClient,
  {
    userId,
    date,
    includeAll = false,
    includePending = false,
  }: RecurringTemplateQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.recurringTemplates.all })]
      : []),
    ...(includePending
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.recurringTemplates.pending(userId, date ?? "") })]
      : []),
  ]);
};

export const setRecurringTemplateQueryData = (
  queryClient: QueryClient,
  { userId, date, templates }: SetRecurringTemplateQueryOptions,
) =>
  queryClient.setQueryData(
    queryKeys.recurringTemplates.pending(userId, date),
    templates,
  );
