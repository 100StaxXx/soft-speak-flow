import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateGuildActivityQueries,
  invalidateGuildBlessingQueries,
  invalidateGuildMutedUserQueries,
  invalidateGuildShoutQueries,
  invalidateGuildTitleQueries,
} from "@/lib/guildQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("guildQueryCache", () => {
  it("invalidates guild title roots and scoped user titles through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateGuildTitleQueries(queryClient, {
      userId: "user-1",
      epicId: "epic-1",
      includeTitlesAll: true,
      includeMyTitlesAll: true,
      includeMyTitlesDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.titlesAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.myTitlesAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.myTitles("user-1", "epic-1", undefined),
    });
  });

  it("invalidates guild activity roots and scoped detail through the helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateGuildActivityQueries(queryClient, {
      epicId: "epic-1",
      includeAll: true,
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.activityAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.activity("epic-1"),
    });
  });

  it("invalidates scoped guild shout queries", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateGuildShoutQueries(queryClient, {
      scopeType: "community",
      scopeId: "community-1",
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.shouts("community", "community-1"),
    });
  });

  it("invalidates blessing feed, charges, and active blessing roots together", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateGuildBlessingQueries(queryClient, {
      includeChargesAll: true,
      includeFeedAll: true,
      includeMyBlessingsAll: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.blessingChargesAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.blessingsFeedAll,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.myBlessingsAll,
    });
  });

  it("invalidates scoped muted-user queries through the guild helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateGuildMutedUserQueries(queryClient, {
      userId: "user-1",
      epicId: "epic-1",
      includeDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.guild.mutedUsers("user-1", "epic-1"),
    });
  });
});
