import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/queryKeys";
import {
  invalidateRecurringTemplateQueries,
  setRecurringTemplateQueryData,
} from "@/lib/recurringTemplateQueryCache";

describe("recurringTemplateQueryCache", () => {
  it("invalidates recurring template caches through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateRecurringTemplateQueries(queryClient, {
      userId: "user-1",
      date: "2026-04-23",
      includeAll: true,
      includePending: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.recurringTemplates.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.recurringTemplates.pending("user-1", "2026-04-23"),
    });
  });

  it("sets the scoped recurring template cache through the helper", () => {
    const queryClient = new QueryClient();
    const setQueryDataSpy = vi.spyOn(queryClient, "setQueryData");
    const templates = [{ id: "template-1" }];

    setRecurringTemplateQueryData(queryClient, {
      userId: "user-1",
      date: "2026-04-23",
      templates,
    });

    expect(setQueryDataSpy).toHaveBeenCalledWith(
      queryKeys.recurringTemplates.pending("user-1", "2026-04-23"),
      templates,
    );
  });
});
