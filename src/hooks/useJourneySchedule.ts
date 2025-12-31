import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StoryTypeSlug } from '@/types/narrativeTypes';

export interface JourneyPhase {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  phaseOrder: number;
}

export interface JourneyMilestone {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  phaseOrder: number;
  phaseName: string;
  isPostcardMilestone: boolean;
  milestonePercent: number;
}

export interface JourneyRitual {
  id: string;
  title: string;
  description: string;
  frequency: 'daily' | '5x_week' | '3x_week' | 'custom';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes?: number;
}

export interface FeasibilityAssessment {
  daysAvailable: number;
  typicalDays: number;
  feasibility: 'comfortable' | 'achievable' | 'aggressive' | 'very_aggressive';
  message: string;
}

export interface JourneySchedule {
  feasibilityAssessment: FeasibilityAssessment;
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
  rituals: JourneyRitual[];
  weeklyHoursEstimate: number;
  suggestedChapterCount: number;
  suggestedStoryType?: StoryTypeSlug;
  suggestedThemeColor?: string;
}

interface GenerateScheduleParams {
  goal: string;
  deadline: string;
  clarificationAnswers?: Record<string, string | number | undefined>;
  epicContext?: string;
  timelineContext?: string;
}

interface AdjustScheduleParams {
  goal: string;
  deadline: string;
  adjustmentRequest: string;
  previousSchedule: {
    phases: JourneyPhase[];
    milestones: JourneyMilestone[];
    rituals: JourneyRitual[];
  };
}

export function useJourneySchedule() {
  const [schedule, setSchedule] = useState<JourneySchedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSchedule = useCallback(async (params: GenerateScheduleParams): Promise<JourneySchedule | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-journey-schedule', {
        body: params,
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const generatedSchedule = data as JourneySchedule;
      setSchedule(generatedSchedule);
      return generatedSchedule;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate schedule';
      setError(message);
      console.error('Failed to generate schedule:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const adjustSchedule = useCallback(async (params: AdjustScheduleParams): Promise<JourneySchedule | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-journey-schedule', {
        body: params,
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      const adjustedSchedule = data as JourneySchedule;
      setSchedule(adjustedSchedule);
      return adjustedSchedule;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to adjust schedule';
      setError(message);
      console.error('Failed to adjust schedule:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const MAX_POSTCARDS = 7;

  const postcardCount = useMemo(() => {
    return schedule?.milestones.filter(m => m.isPostcardMilestone).length ?? 0;
  }, [schedule]);

  const toggleMilestone = useCallback((milestoneId: string) => {
    setSchedule(prev => {
      if (!prev) return prev;
      
      const milestone = prev.milestones.find(m => m.id === milestoneId);
      if (!milestone) return prev;
      
      // If trying to turn ON, check the cap
      if (!milestone.isPostcardMilestone) {
        const currentPostcardCount = prev.milestones.filter(m => m.isPostcardMilestone).length;
        if (currentPostcardCount >= MAX_POSTCARDS) {
          // Already at max, don't allow toggle
          return prev;
        }
      }
      
      return {
        ...prev,
        milestones: prev.milestones.map(m => 
          m.id === milestoneId 
            ? { ...m, isPostcardMilestone: !m.isPostcardMilestone }
            : m
        ),
      };
    });
  }, []);

  const updateRitual = useCallback((updatedRitual: JourneyRitual) => {
    setSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rituals: prev.rituals.map(r => 
          r.id === updatedRitual.id ? updatedRitual : r
        ),
      };
    });
  }, []);

  const addRitual = useCallback((ritual: JourneyRitual) => {
    setSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rituals: [...prev.rituals, ritual],
      };
    });
  }, []);

  const removeRitual = useCallback((ritualId: string) => {
    setSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rituals: prev.rituals.filter(r => r.id !== ritualId),
      };
    });
  }, []);

  const setRituals = useCallback((rituals: JourneyRitual[]) => {
    setSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rituals,
      };
    });
  }, []);

  const updateMilestoneDate = useCallback((milestoneId: string, newDate: string) => {
    setSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        milestones: prev.milestones.map(m => 
          m.id === milestoneId 
            ? { ...m, targetDate: newDate }
            : m
        ),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setSchedule(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    schedule,
    isLoading,
    error,
    generateSchedule,
    adjustSchedule,
    toggleMilestone,
    updateRitual,
    addRitual,
    removeRitual,
    setRituals,
    updateMilestoneDate,
    reset,
    postcardCount,
    maxPostcards: MAX_POSTCARDS,
  };
}
