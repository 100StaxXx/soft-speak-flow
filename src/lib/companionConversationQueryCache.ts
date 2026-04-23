import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { getCompanionChatThreadsQueryKey } from "@/services/companionChatThreads";
import type { CompanionChatSurface } from "@/types/companionConversation";

export const invalidateCompanionChatHistoryQuery = async (
  queryClient: QueryClient,
  {
    userId,
    companionId,
  }: {
    userId: string | null | undefined;
    companionId: string | null | undefined;
  },
) =>
  queryClient.invalidateQueries({
    queryKey: queryKeys.companion.chatHistory(userId, companionId),
  });

export const invalidateCompanionChatThreadsQuery = async (
  queryClient: QueryClient,
  {
    userId,
    companionId,
    surface,
  }: {
    userId: string | null | undefined;
    companionId: string | null | undefined;
    surface: CompanionChatSurface;
  },
) =>
  queryClient.invalidateQueries({
    queryKey: getCompanionChatThreadsQueryKey(userId, companionId, surface),
  });

export const invalidateCompanionPostcardsQuery = async (
  queryClient: QueryClient,
  userId: string | undefined,
) =>
  queryClient.invalidateQueries({
    queryKey: queryKeys.companion.postcards(userId),
  });
