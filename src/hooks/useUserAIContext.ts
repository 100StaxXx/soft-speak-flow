import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface EnrichedContext {
  activeEpics: Array<{
    id: string;
    title: string;
    progress: number;
    daysRemaining: number;
    habitCount: number;
    storyType: string | null;
    themeColor: string | null;
  }>;
  activeHabits: Array<{
    id: string;
    title: string;
    currentStreak: number;
    difficulty: string;
    frequency: string;
    category: string | null;
  }>;
  pendingQuestsCount: number;
  currentStreaks: {
    maxHabitStreak: number;
    dailyTaskStreak: number;
  };
  completionRates: {
    thisWeek: number;
    thisMonth: number;
  };
  averageHabitsPerDay: number;
  preferredDifficulty: string;
  preferredEpicDuration: number;
  preferredHabitFrequency: string;
  commonContexts: string[];
  preferenceWeights: Record<string, Record<string, number>>;
  tonePreference: string | null;
  atEpicLimit: boolean;
  overloaded: boolean;
  suggestedWorkload: 'light' | 'normal' | 'heavy';
  recentCompletedEpics: number;
  recentAbandonedEpics: number;
}

interface UserAILearning {
  id: string;
  user_id: string;
  preferred_epic_duration: number;
  preferred_habit_difficulty: string;
  preferred_habit_frequency: string;
  common_contexts: string[];
  peak_productivity_times: string[];
  successful_patterns: Record<string, unknown>;
  failed_patterns: Record<string, unknown>;
  preference_weights: Record<string, Record<string, number>>;
  interaction_count: number;
  acceptance_rate: number;
  modification_rate: number;
  last_interaction_at: string | null;
}

export function useUserAIContext() {
  const { user } = useAuth();

  // Fetch enriched context from edge function
  const { 
    data: enrichedContext, 
    isLoading: isContextLoading,
    refetch: refetchContext,
  } = useQuery({
    queryKey: ['user-ai-context', user?.id],
    queryFn: async (): Promise<EnrichedContext | null> => {
      if (!user) return null;

      const { data, error } = await supabase.functions.invoke('enrich-user-context');
      
      if (error) {
        console.error('Error fetching AI context:', error);
        return null;
      }

      return data as EnrichedContext;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });

  const learningProfile: UserAILearning | null = enrichedContext ? {
    id: '',
    user_id: user?.id ?? '',
    preferred_epic_duration: enrichedContext.preferredEpicDuration,
    preferred_habit_difficulty: enrichedContext.preferredDifficulty,
    preferred_habit_frequency: enrichedContext.preferredHabitFrequency,
    common_contexts: enrichedContext.commonContexts,
    peak_productivity_times: [],
    successful_patterns: {},
    failed_patterns: {},
    preference_weights: enrichedContext.preferenceWeights,
    interaction_count: 0,
    acceptance_rate: 0,
    modification_rate: 0,
    last_interaction_at: null,
  } : null;

  // Derived capacity signals
  const isAtEpicLimit = enrichedContext?.atEpicLimit ?? false;
  const isOverloaded = enrichedContext?.overloaded ?? false;
  const suggestedWorkload = enrichedContext?.suggestedWorkload ?? 'normal';

  // Derived preferences with fallbacks
  const preferences = {
    epicDuration: enrichedContext?.preferredEpicDuration ?? 30,
    habitDifficulty: enrichedContext?.preferredDifficulty ?? 'medium',
    habitFrequency: enrichedContext?.preferredHabitFrequency ?? 'daily',
    commonContexts: enrichedContext?.commonContexts ?? [],
    preferenceWeights: enrichedContext?.preferenceWeights ?? {},
  };

  // Capacity warning message
  const getCapacityWarning = (): string | null => {
    if (isAtEpicLimit) {
      return 'You have 3 active campaigns. Consider completing one before starting another.';
    }
    if (isOverloaded) {
      return 'You seem overloaded. Consider simplifying your current habits before adding more.';
    }
    return null;
  };

  return {
    // Context data
    enrichedContext,
    learningProfile,
    
    // Loading states
    isLoading: isContextLoading,
    isContextLoading,
    isLearningLoading: isContextLoading,
    
    // Capacity signals
    isAtEpicLimit,
    isOverloaded,
    suggestedWorkload,
    capacityWarning: getCapacityWarning(),
    
    // Preferences
    preferences,
    
    // Stats
    activeEpicCount: enrichedContext?.activeEpics.length ?? 0,
    activeHabitCount: enrichedContext?.activeHabits.length ?? 0,
    completionRate: enrichedContext?.completionRates.thisWeek ?? 0,
    
    // Refetch functions
    refetch: () => {
      refetchContext();
    },
    refetchContext,
    refetchLearning: refetchContext,
  };
}
