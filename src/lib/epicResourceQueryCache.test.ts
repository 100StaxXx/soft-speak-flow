import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateEpicTemplatesQuery,
  invalidateEpicMilestonesQuery,
  invalidatePublicEpicsQuery,
} from "@/lib/epicResourceQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("epicResourceQueryCache", () => {
  it("invalidates the milestone query for a specific epic", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateEpicMilestonesQuery(queryClient, "epic-123");

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.milestones.byEpic("epic-123"),
    });
  });

  it("invalidates the public epics query family", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidatePublicEpicsQuery(queryClient);

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.publicEpics.all,
    });
  });

  it("invalidates the epic template query family", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateEpicTemplatesQuery(queryClient);

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.epics.templates(),
    });
  });
});
