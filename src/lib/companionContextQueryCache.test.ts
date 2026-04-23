import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  companionContextQueryFamilies,
  companionContextQueryFamilyGroups,
  invalidateCompanionQueries,
  invalidateCompanionContextQueryFamilies,
  refetchCompanionQueries,
} from "@/lib/companionContextQueryCache";
import { queryKeys } from "@/lib/queryKeys";

describe("companionContextQueryCache", () => {
  it("invalidates the live evolution query families through the shared helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCompanionContextQueryFamilies(
      queryClient,
      companionContextQueryFamilyGroups.liveEvolution,
    );

    expect(invalidateSpy).toHaveBeenCalledTimes(
      companionContextQueryFamilyGroups.liveEvolution.length,
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: companionContextQueryFamilies.health,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: companionContextQueryFamilies.careSignals,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: companionContextQueryFamilies.story,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: companionContextQueryFamilies.currentEvolutionCard,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: companionContextQueryFamilies.evolutionCards,
    });
  });

  it("supports targeted companion artifact invalidation", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCompanionContextQueryFamilies(queryClient, ["story", "storiesAll"]);

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: companionContextQueryFamilies.story,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: companionContextQueryFamilies.storiesAll,
    });
  });

  it("centralizes companion detail and health invalidation", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCompanionQueries(queryClient, {
      userId: "user-123",
      companionId: "companion-456",
      includeAll: true,
      includeDetail: true,
      includeHealthDetail: true,
      includeMemoriesDetail: true,
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(4);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.companion.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.companion.detail("user-123"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.companion.health("user-123"),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.companion.memories("companion-456"),
    });
  });

  it("centralizes companion detail refetching", async () => {
    const queryClient = new QueryClient();
    const refetchSpy = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue();

    await refetchCompanionQueries(queryClient, {
      userId: "user-123",
      includeDetail: true,
    });

    expect(refetchSpy).toHaveBeenCalledTimes(1);
    expect(refetchSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.companion.detail("user-123"),
    });
  });
});
