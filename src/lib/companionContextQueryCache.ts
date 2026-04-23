import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type CompanionQueryOptions = {
  userId?: string;
  companionId?: string;
  includeAll?: boolean;
  includeDetail?: boolean;
  includeHealthAll?: boolean;
  includeHealthDetail?: boolean;
  includeMemoriesAll?: boolean;
  includeMemoriesDetail?: boolean;
};

export const companionContextQueryFamilies = {
  health: queryKeys.companion.healthAll,
  careSignals: queryKeys.companion.careSignalsAll,
  attributes: queryKeys.companion.attributesAll,
  story: queryKeys.companion.storyAll,
  storiesAll: queryKeys.companion.storiesAllRoot,
  memories: queryKeys.companion.memoriesAll,
  bond: queryKeys.companion.bondAll,
  evolutionImage: queryKeys.companion.evolutionImageAll,
  currentEvolutionCard: queryKeys.companion.currentEvolutionCardAll,
  evolutionCards: queryKeys.evolution.cards(),
  wallpaperCatalog: queryKeys.wallpapers.all,
} as const;

export const companionContextQueryFamilyGroups = {
  healthStatus: ["health"] as const,
  storyContent: ["story", "storiesAll"] as const,
  evolutionCardsOnly: ["evolutionCards"] as const,
  evolutionArtifacts: [
    "story",
    "storiesAll",
    "evolutionImage",
    "currentEvolutionCard",
    "evolutionCards",
  ] as const,
  evolutionProgression: [
    "storiesAll",
    "currentEvolutionCard",
    "evolutionCards",
  ] as const,
  liveEvolution: [
    "health",
    "careSignals",
    "attributes",
    "story",
    "storiesAll",
    "memories",
    "bond",
    "evolutionImage",
    "currentEvolutionCard",
    "evolutionCards",
  ] as const,
  appResume: [
    "health",
    "careSignals",
    "attributes",
    "story",
    "storiesAll",
    "memories",
    "bond",
    "evolutionImage",
    "currentEvolutionCard",
    "evolutionCards",
    "wallpaperCatalog",
  ] as const,
} as const;

export type CompanionContextQueryFamily = keyof typeof companionContextQueryFamilies;
export type CompanionContextQueryFamilyList = readonly CompanionContextQueryFamily[];

const getQueryFilter = (family: CompanionContextQueryFamily) => ({
  queryKey: companionContextQueryFamilies[family],
});

export const invalidateCompanionContextQueryFamilies = async (
  queryClient: QueryClient,
  families: CompanionContextQueryFamilyList,
) => {
  await Promise.all(
    families.map((family) => queryClient.invalidateQueries(getQueryFilter(family))),
  );
};

export const invalidateCompanionQueries = async (
  queryClient: QueryClient,
  {
    userId,
    companionId,
    includeAll = false,
    includeDetail = false,
    includeHealthAll = false,
    includeHealthDetail = false,
    includeMemoriesAll = false,
    includeMemoriesDetail = false,
  }: CompanionQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.companion.all })]
      : []),
    ...(includeDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.companion.detail(userId) })]
      : []),
    ...(includeHealthAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.companion.healthAll })]
      : []),
    ...(includeHealthDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.companion.health(userId) })]
      : []),
    ...(includeMemoriesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.companion.memoriesAll })]
      : []),
    ...(includeMemoriesDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.companion.memories(companionId) })]
      : []),
  ]);
};

export const refetchCompanionQueries = async (
  queryClient: QueryClient,
  {
    userId,
    companionId,
    includeAll = false,
    includeDetail = false,
    includeHealthAll = false,
    includeHealthDetail = false,
    includeMemoriesAll = false,
    includeMemoriesDetail = false,
  }: CompanionQueryOptions = {},
) => {
  await Promise.all([
    ...(includeAll
      ? [queryClient.refetchQueries({ queryKey: queryKeys.companion.all })]
      : []),
    ...(includeDetail
      ? [queryClient.refetchQueries({ queryKey: queryKeys.companion.detail(userId) })]
      : []),
    ...(includeHealthAll
      ? [queryClient.refetchQueries({ queryKey: queryKeys.companion.healthAll })]
      : []),
    ...(includeHealthDetail
      ? [queryClient.refetchQueries({ queryKey: queryKeys.companion.health(userId) })]
      : []),
    ...(includeMemoriesAll
      ? [queryClient.refetchQueries({ queryKey: queryKeys.companion.memoriesAll })]
      : []),
    ...(includeMemoriesDetail
      ? [queryClient.refetchQueries({ queryKey: queryKeys.companion.memories(companionId) })]
      : []),
  ]);
};
