import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

export const invalidateEpicMilestonesQuery = async (
  queryClient: QueryClient,
  epicId: string | undefined,
) => {
  await queryClient.invalidateQueries({ queryKey: queryKeys.milestones.byEpic(epicId) });
};

export const invalidatePublicEpicsQuery = async (
  queryClient: QueryClient,
) => {
  await queryClient.invalidateQueries({ queryKey: queryKeys.publicEpics.all });
};

export const invalidateEpicTemplatesQuery = async (
  queryClient: QueryClient,
) => {
  await queryClient.invalidateQueries({ queryKey: queryKeys.epics.templates() });
};
