import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

export const campaignContextQueryFamilies = {
  epics: queryKeys.epics.all,
  habits: queryKeys.habits.all,
  habitCompletions: queryKeys.habits.completionsAll,
  habitSurfacing: queryKeys.habitSurfacing.all,
  userAiContext: queryKeys.userAiContext.all,
  epicProgress: queryKeys.epicProgress.all,
} as const;

export const campaignContextQueryFamilyGroups = {
  epicsAndHabits: ["epics", "habits"] as const,
  habitCompletionState: ["habitCompletions", "habits"] as const,
  habitPlannerState: ["epics", "habits", "habitSurfacing"] as const,
  epicPlannerState: ["epics", "habitSurfacing", "epicProgress"] as const,
  campaignContext: ["epics", "habits", "habitSurfacing", "userAiContext"] as const,
  campaignPlanner: [
    "epics",
    "habits",
    "habitSurfacing",
    "userAiContext",
    "epicProgress",
  ] as const,
} as const;

export type CampaignContextQueryFamily = keyof typeof campaignContextQueryFamilies;
export type CampaignContextQueryFamilyList = readonly CampaignContextQueryFamily[];

const getQueryFilter = (family: CampaignContextQueryFamily) => ({
  queryKey: campaignContextQueryFamilies[family],
});

export const invalidateCampaignContextQueryFamilies = async (
  queryClient: QueryClient,
  families: CampaignContextQueryFamilyList,
) => {
  await Promise.all(
    families.map((family) => queryClient.invalidateQueries(getQueryFilter(family))),
  );
};

export const invalidateHabitScopeQueries = async (
  queryClient: QueryClient,
  userId: string | undefined,
  options: {
    includeCompletions?: boolean;
  } = {},
) => {
  const { includeCompletions = false } = options;

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.habits.byUser(userId) }),
    ...(includeCompletions
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.habits.completions(userId) })]
      : []),
  ]);
};
