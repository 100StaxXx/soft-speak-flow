import { useQuery } from "@tanstack/react-query";
import { getDocuments } from "@/lib/firebase/firestore";

export interface EvolutionThreshold {
  stage: number;
  xp_required: number;
  stage_name: string;
}

/**
 * Hook to load evolution thresholds from database
 * Single source of truth for XP requirements
 */
export const useEvolutionThresholds = () => {
  const { data: thresholds, isLoading, error } = useQuery({
    queryKey: ['evolution-thresholds'],
    queryFn: async () => {
      const data = await getDocuments<EvolutionThreshold>(
        'evolution_thresholds',
        undefined,
        'stage',
        'asc'
      );
      return data;
    },
    staleTime: Infinity, // Never refetch - thresholds rarely change
    gcTime: Infinity, // Keep in cache forever (renamed from cacheTime in React Query v5)
  });

  // Create lookup map for quick access
  const thresholdMap = thresholds?.reduce((acc, t) => {
    acc[t.stage] = t.xp_required;
    return acc;
  }, {} as Record<number, number>);

  // Helper function: get XP required for a specific stage
  const getThreshold = (stage: number): number | null => {
    return thresholdMap?.[stage] ?? null;
  };

  // Helper function: check if evolution is possible
  const shouldEvolve = (currentStage: number, currentXP: number): boolean => {
    const nextThreshold = getThreshold(currentStage + 1);
    return nextThreshold !== null && currentXP >= nextThreshold;
  };

  // Helper function: get next stage name
  const getStageName = (stage: number): string => {
    return thresholds?.find(t => t.stage === stage)?.stage_name ?? `Stage ${stage}`;
  };

  return {
    thresholds,
    thresholdMap,
    isLoading,
    error,
    getThreshold,
    shouldEvolve,
    getStageName,
  };
};
