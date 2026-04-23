import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import {
  invalidateCompanionChatHistoryQuery,
  invalidateCompanionChatThreadsQuery,
  invalidateCompanionPostcardsQuery,
} from "@/lib/companionConversationQueryCache";
import { queryKeys } from "@/lib/queryKeys";
import { getCompanionChatThreadsQueryKey } from "@/services/companionChatThreads";

describe("companionConversationQueryCache", () => {
  it("invalidates companion chat history through the shared helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCompanionChatHistoryQuery(queryClient, {
      userId: "user-123",
      companionId: "companion-456",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.companion.chatHistory("user-123", "companion-456"),
    });
  });

  it("invalidates companion thread lists through the shared helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCompanionChatThreadsQuery(queryClient, {
      userId: "user-123",
      companionId: "companion-456",
      surface: "journeys",
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: getCompanionChatThreadsQueryKey("user-123", "companion-456", "journeys"),
    });
  });

  it("invalidates companion postcards through the shared helper", async () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();

    await invalidateCompanionPostcardsQuery(queryClient, "user-123");

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.companion.postcards("user-123"),
    });
  });
});
