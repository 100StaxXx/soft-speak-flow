import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type DailyMissionQueryOptions = {
  missionDate?: string;
  userId?: string;
  includeMissionsAll?: boolean;
  includeMissionsByDate?: boolean;
  includePulseAll?: boolean;
  includePulseByDate?: boolean;
  includeMorningBriefingAll?: boolean;
  includeMorningBriefingByDate?: boolean;
};

export const invalidateDailyMissionQueries = async (
  queryClient: QueryClient,
  {
    missionDate,
    userId,
    includeMissionsAll = false,
    includeMissionsByDate = false,
    includePulseAll = false,
    includePulseByDate = false,
    includeMorningBriefingAll = false,
    includeMorningBriefingByDate = false,
  }: DailyMissionQueryOptions = {},
) => {
  await Promise.all([
    ...(includeMissionsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissions.all })]
      : []),
    ...(includeMissionsByDate
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissions.byDate(missionDate ?? "", userId) })]
      : []),
    ...(includePulseAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissionPulse.all })]
      : []),
    ...(includePulseByDate
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.dailyMissionPulse.byDate(missionDate ?? "", userId) })]
      : []),
    ...(includeMorningBriefingAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.morningBriefing.all })]
      : []),
    ...(includeMorningBriefingByDate
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.morningBriefing.byDate(missionDate ?? "", userId) })]
      : []),
  ]);
};
