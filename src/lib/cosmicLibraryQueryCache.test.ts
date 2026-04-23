import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateCosmicLibraryQueries } from "@/lib/cosmicLibraryQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("cosmicLibraryQueryCache", () => {
  it("invalidates narrative epic and story character queries through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCosmicLibraryQueries(queryClient, {
      epicId: "epic-1",
      includeNarrativeEpicAll: true,
      includeNarrativeEpicDetail: true,
      includeStoryCharactersAll: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.narrative.epicAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.narrative.epic("epic-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.narrative.storyCharactersAll,
    });
  });
});
