import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type AstralResistQueryOptions = {
  userId?: string;
  startOfTodayIso?: string;
  includeEncountersAll?: boolean;
  includeEncountersDetail?: boolean;
  includeEssencesAll?: boolean;
  includeEssencesDetail?: boolean;
  includeCodexAll?: boolean;
  includeCodexDetail?: boolean;
  includeXpTodayAll?: boolean;
  includeXpTodayDetail?: boolean;
  includeBadHabitsAll?: boolean;
  includeBadHabitsDetail?: boolean;
  includeResistLogAll?: boolean;
  includeResistLogDetail?: boolean;
};

export const invalidateAstralResistQueries = async (
  queryClient: QueryClient,
  {
    userId,
    startOfTodayIso,
    includeEncountersAll = false,
    includeEncountersDetail = false,
    includeEssencesAll = false,
    includeEssencesDetail = false,
    includeCodexAll = false,
    includeCodexDetail = false,
    includeXpTodayAll = false,
    includeXpTodayDetail = false,
    includeBadHabitsAll = false,
    includeBadHabitsDetail = false,
    includeResistLogAll = false,
    includeResistLogDetail = false,
  }: AstralResistQueryOptions = {},
) => {
  await Promise.all([
    ...(includeEncountersAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.encountersAll })]
      : []),
    ...(includeEncountersDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.encounters(userId) })]
      : []),
    ...(includeEssencesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.essencesAll })]
      : []),
    ...(includeEssencesDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.essences(userId) })]
      : []),
    ...(includeCodexAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.codexAll })]
      : []),
    ...(includeCodexDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.codex(userId) })]
      : []),
    ...(includeXpTodayAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.xpTodayAll })]
      : []),
    ...(includeXpTodayDetail && startOfTodayIso
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.astral.xpToday(userId, startOfTodayIso) })]
      : []),
    ...(includeBadHabitsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.resist.badHabitsAll })]
      : []),
    ...(includeBadHabitsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.resist.badHabits(userId) })]
      : []),
    ...(includeResistLogAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.resist.logAll })]
      : []),
    ...(includeResistLogDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.resist.log(userId) })]
      : []),
  ]);
};

export const prependBadHabitQueryData = <THabit>(
  queryClient: QueryClient,
  {
    userId,
    habit,
  }: {
    userId?: string;
    habit: THabit;
  },
) =>
  queryClient.setQueryData<THabit[]>(
    queryKeys.resist.badHabits(userId),
    (old) => [habit, ...(old ?? [])],
  );

export const removeBadHabitQueryData = <THabit extends { id: string }>(
  queryClient: QueryClient,
  {
    userId,
    habitId,
  }: {
    userId?: string;
    habitId: string;
  },
) =>
  queryClient.setQueryData<THabit[]>(
    queryKeys.resist.badHabits(userId),
    (old) => (old ?? []).filter((habit) => habit.id !== habitId),
  );
