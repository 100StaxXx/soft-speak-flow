import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateQuestAutocompleteQueries } from "@/lib/questAutocompleteQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("questAutocompleteQueryCache", () => {
  it("invalidates task history and habit suggestion caches through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateQuestAutocompleteQueries(queryClient, {
      userId: "user-1",
      includeTaskHistoryAll: true,
      includeTaskHistoryDetail: true,
      includeHabitsAll: true,
      includeHabitsDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.questAutocomplete.taskHistoryAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.questAutocomplete.taskHistory("user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.questAutocomplete.habitsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.questAutocomplete.habits("user-1"),
    });
  });
});
