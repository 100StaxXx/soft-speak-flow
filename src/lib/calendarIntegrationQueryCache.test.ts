import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateCalendarIntegrationQueries } from "@/lib/calendarIntegrationQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("calendarIntegrationQueryCache", () => {
  it("invalidates calendar integration roots and scoped detail through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCalendarIntegrationQueries(queryClient, {
      userId: "user-1",
      startDate: "2026-04-23",
      endDate: "2026-04-29",
      horizon: "week",
      includeSettingsAll: true,
      includeConnectionsAll: true,
      includeQuestLinksDetail: true,
      includeOutlookTaskLinksAll: true,
      includeExternalEventsDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(5);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.calendar.settingsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.calendar.connectionsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.calendar.questLinks("user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.calendar.outlookTaskLinksAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.calendar.externalEvents("user-1", "2026-04-23", "2026-04-29", "week"),
    });
  });
});
