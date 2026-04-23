import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateLibraryQueries } from "@/lib/libraryQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("libraryQueryCache", () => {
  it("invalidates library favorites, downloads, and derived favorite content queries", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateLibraryQueries(queryClient, {
      userId: "user-1",
      quoteIdsKey: "quote-1,quote-2",
      pepTalkIdsKey: "pep-1",
      includeFavoritesAll: true,
      includeFavoritesDetail: true,
      includeDownloadsAll: true,
      includeDownloadsDetail: true,
      includeFavoriteQuotesAll: true,
      includeFavoriteQuotesDetail: true,
      includeFavoritePepTalksAll: true,
      includeFavoritePepTalksDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(8);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.favoritesAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.favorites("user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.downloadsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.downloads("user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.favoriteQuotesAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.favoriteQuotes("user-1", "quote-1,quote-2"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.favoritePepTalksAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.library.favoritePepTalks("user-1", "pep-1"),
    });
  });
});
