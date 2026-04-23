import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { JOURNAL_ENTRIES_QUERY_KEY } from "@/hooks/useJournalEntries";
import { invalidateJournalEntryQueries } from "@/lib/journalEntryQueryCache";

describe("journalEntryQueryCache", () => {
  it("invalidates the canonical journal entry query family", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateJournalEntryQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: JOURNAL_ENTRIES_QUERY_KEY,
    });
  });
});
