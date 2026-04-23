import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type CosmicLibraryQueryOptions = {
  epicId?: string;
  includeNarrativeEpicAll?: boolean;
  includeNarrativeEpicDetail?: boolean;
  includeStoryCharactersAll?: boolean;
};

export const invalidateCosmicLibraryQueries = async (
  queryClient: QueryClient,
  {
    epicId,
    includeNarrativeEpicAll = false,
    includeNarrativeEpicDetail = false,
    includeStoryCharactersAll = false,
  }: CosmicLibraryQueryOptions = {},
) => {
  await Promise.all([
    ...(includeNarrativeEpicAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.narrative.epicAll })]
      : []),
    ...(includeNarrativeEpicDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.narrative.epic(epicId) })]
      : []),
    ...(includeStoryCharactersAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.narrative.storyCharactersAll })]
      : []),
  ]);
};
