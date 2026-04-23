import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateAstralResistQueries,
  prependBadHabitQueryData,
  removeBadHabitQueryData,
} from "@/lib/astralResistQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("astralResistQueryCache", () => {
  it("invalidates astral and resist roots together through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateAstralResistQueries(queryClient, {
      userId: "user-1",
      startOfTodayIso: "2026-04-23T00:00:00.000Z",
      includeEncountersAll: true,
      includeEncountersDetail: true,
      includeEssencesAll: true,
      includeCodexDetail: true,
      includeXpTodayDetail: true,
      includeBadHabitsAll: true,
      includeResistLogDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(7);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.astral.encountersAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.astral.encounters("user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.astral.essencesAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.astral.codex("user-1"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.astral.xpToday("user-1", "2026-04-23T00:00:00.000Z"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.resist.badHabitsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.resist.log("user-1"),
    });
  });

  it("prepends a newly added bad habit into the scoped cache", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.resist.badHabits("user-1"), [{ id: "habit-1", name: "Sugar" }]);

    prependBadHabitQueryData(queryClient, {
      userId: "user-1",
      habit: { id: "habit-2", name: "Scrolling" },
    });

    expect(queryClient.getQueryData(queryKeys.resist.badHabits("user-1"))).toEqual([
      { id: "habit-2", name: "Scrolling" },
      { id: "habit-1", name: "Sugar" },
    ]);
  });

  it("removes a deleted bad habit from the scoped cache", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.resist.badHabits("user-1"), [
      { id: "habit-1", name: "Sugar" },
      { id: "habit-2", name: "Scrolling" },
    ]);

    removeBadHabitQueryData<{ id: string; name: string }>(queryClient, {
      userId: "user-1",
      habitId: "habit-1",
    });

    expect(queryClient.getQueryData(queryKeys.resist.badHabits("user-1"))).toEqual([
      { id: "habit-2", name: "Scrolling" },
    ]);
  });
});
