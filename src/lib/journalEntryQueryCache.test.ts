import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateJournalEntryQueries } from "@/lib/journalEntryQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("journalEntryQueryCache", () => {
  it("invalidates the canonical journal entry query family", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateJournalEntryQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.journalEntries.all,
    });
  });
});
