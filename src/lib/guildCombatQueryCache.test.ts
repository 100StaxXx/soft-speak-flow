import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateGuildBossQueries,
  invalidateGuildRivalryQueries,
} from "@/lib/guildCombatQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("guildCombatQueryCache", () => {
  it("invalidates scoped guild rivalry queries", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateGuildRivalryQueries(queryClient, {
      scopeType: "community",
      scopeId: "community-1",
      userId: "user-1",
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.rivalry("community", "community-1", "user-1"),
    });
  });

  it("invalidates boss, legends, and damage log roots through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateGuildBossQueries(queryClient, {
      includeBossAll: true,
      includeLegendsAll: true,
      includeDamageLogAll: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.bossAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.legendsAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.bossDamageLogAll,
    });
  });
});
