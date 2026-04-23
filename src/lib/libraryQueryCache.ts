import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";

type LibraryQueryOptions = {
  userId?: string;
  quoteIdsKey?: string;
  pepTalkIdsKey?: string;
  includeFavoritesAll?: boolean;
  includeFavoritesDetail?: boolean;
  includeDownloadsAll?: boolean;
  includeDownloadsDetail?: boolean;
  includeFavoriteQuotesAll?: boolean;
  includeFavoriteQuotesDetail?: boolean;
  includeFavoritePepTalksAll?: boolean;
  includeFavoritePepTalksDetail?: boolean;
};

export const invalidateLibraryQueries = async (
  queryClient: QueryClient,
  {
    userId,
    quoteIdsKey,
    pepTalkIdsKey,
    includeFavoritesAll = false,
    includeFavoritesDetail = false,
    includeDownloadsAll = false,
    includeDownloadsDetail = false,
    includeFavoriteQuotesAll = false,
    includeFavoriteQuotesDetail = false,
    includeFavoritePepTalksAll = false,
    includeFavoritePepTalksDetail = false,
  }: LibraryQueryOptions = {},
) => {
  await Promise.all([
    ...(includeFavoritesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.favoritesAll })]
      : []),
    ...(includeFavoritesDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.favorites(userId) })]
      : []),
    ...(includeDownloadsAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.downloadsAll })]
      : []),
    ...(includeDownloadsDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.downloads(userId) })]
      : []),
    ...(includeFavoriteQuotesAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.favoriteQuotesAll })]
      : []),
    ...(includeFavoriteQuotesDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.favoriteQuotes(userId, quoteIdsKey ?? "") })]
      : []),
    ...(includeFavoritePepTalksAll
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.favoritePepTalksAll })]
      : []),
    ...(includeFavoritePepTalksDetail
      ? [queryClient.invalidateQueries({ queryKey: queryKeys.library.favoritePepTalks(userId, pepTalkIdsKey ?? "") })]
      : []),
  ]);
};
