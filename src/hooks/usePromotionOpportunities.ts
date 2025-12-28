import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SuggestedHabit {
  title: string;
  frequency: string;
  difficulty: string;
}

export interface PromotionOpportunity {
  type: 'quest_to_epic' | 'habit_cluster' | 'recurring_pattern';
  confidence: number;
  title: string;
  description: string;
  reasoning: string;
  sourceIds: string[];
  suggestedEpicTitle?: string;
  suggestedHabits?: SuggestedHabit[];
  suggestedDuration?: number;
  category?: string;
}

interface PromotionOpportunitiesResponse {
  opportunities: PromotionOpportunity[];
  analyzedCounts: {
    tasks: number;
    habits: number;
    quests: number;
  };
}

export function usePromotionOpportunities() {
  const { user } = useAuth();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['promotion-opportunities', user?.id],
    queryFn: async (): Promise<PromotionOpportunitiesResponse> => {
      if (!user) {
        return { opportunities: [], analyzedCounts: { tasks: 0, habits: 0, quests: 0 } };
      }

      const { data, error } = await supabase.functions.invoke('detect-promotion-opportunities');
      
      if (error) {
        console.error('Error fetching promotion opportunities:', error);
        throw error;
      }

      return data as PromotionOpportunitiesResponse;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });

  const opportunities = data?.opportunities ?? [];
  const hasOpportunities = opportunities.length > 0;
  const topOpportunity = opportunities[0] ?? null;

  return {
    opportunities,
    analyzedCounts: data?.analyzedCounts,
    isLoading,
    error: error instanceof Error ? error.message : null,
    hasOpportunities,
    topOpportunity,
    refetch,
  };
}
