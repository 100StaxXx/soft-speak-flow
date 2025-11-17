import { QueryClient } from "@tanstack/react-query";

// Optimized query client configuration
export const createOptimizedQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: 1,
      },
    },
  });
};

// Prefetch common queries
export const prefetchCommonData = async (queryClient: QueryClient, userId: string) => {
  const commonQueries = [
    { queryKey: ["profile", userId], fetchFn: () => fetch(`/api/profile/${userId}`) },
    { queryKey: ["companion", userId], fetchFn: () => fetch(`/api/companion/${userId}`) },
  ];

  await Promise.all(
    commonQueries.map(({ queryKey, fetchFn }) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn: fetchFn,
      })
    )
  );
};

// Invalidate related queries helper
export const invalidateRelatedQueries = (
  queryClient: QueryClient,
  baseKey: string[]
) => {
  queryClient.invalidateQueries({ queryKey: baseKey });
};
