import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateMentorContextQueries,
  invalidateTodayPepTalkQueries,
  refetchMentorContextQueries,
  refetchTodayPepTalkQueries,
} from "@/lib/mentorContextQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("mentorContextQueryCache", () => {
  it("invalidates the default mentor context query families", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateMentorContextQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["mentor-page-data"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["mentor-personality"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["mentor"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["selected-mentor"] });
  });

  it("can include the morning check-in, pep talk, and streak queries", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateMentorContextQueries(queryClient, {
      includeMorningCheckIn: true,
      includeTodayPepTalk: true,
      includeStreakFreezes: true,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["morning-check-in"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.mentor.todayPepTalkAll });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["streak-freezes"] });
  });

  it("can refetch a narrower mentor context slice", async () => {
    const queryClient = new QueryClient();
    const refetchSpy = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();

    await refetchMentorContextQueries(queryClient, {
      includeMentor: false,
      includeSelectedMentor: false,
      includeMorningCheckIn: true,
    });

    expect(refetchSpy).toHaveBeenCalledTimes(3);
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: ["mentor-page-data"] });
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: ["mentor-personality"] });
    expect(refetchSpy).toHaveBeenCalledWith({ queryKey: ["morning-check-in"] });
  });

  it("can invalidate and refetch the scoped today pep talk query", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const refetchSpy = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();

    await invalidateTodayPepTalkQueries(queryClient, {
      mentorId: "mentor-123",
      pepTalkDate: "2026-04-23",
      includeAll: true,
      includeDetail: true,
    });
    await refetchTodayPepTalkQueries(queryClient, {
      mentorId: "mentor-123",
      pepTalkDate: "2026-04-23",
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.mentor.todayPepTalkAll,
      exact: true,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.mentor.todayPepTalk("mentor-123", "2026-04-23"),
      exact: true,
    });
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.mentor.todayPepTalk("mentor-123", "2026-04-23"),
      exact: true,
    });
  });
});
