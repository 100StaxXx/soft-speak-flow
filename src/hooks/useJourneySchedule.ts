import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { StoryTypeSlug } from '@/types/narrativeTypes';

export type JourneyExecutionModel = 'sequential' | 'overlap_early';

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
  frequency: 'daily' | '5x_week' | '3x_week' | 'weekly' | 'monthly' | 'custom';
  customDays?: number[]; // 0-6 representing Mon-Sun
  customMonthDays?: number[]; // 1-31 representing days of the month
  customPeriod?: 'week' | 'month';
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes?: number;
  preferredTime?: string | null;
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
  executionModel: JourneyExecutionModel;
  planningStyleReason?: string;
}

export const JOURNEY_RITUAL_TIME_FALLBACKS = ["08:00", "10:00", "14:00", "17:00", "19:00", "20:30"];
export const MAX_JOURNEY_RITUAL_ESTIMATED_MINUTES = 1440;

type JourneyRitualResponse = JourneyRitual & {
  custom_days?: number[];
  custom_month_days?: number[];
  custom_period?: 'week' | 'month';
  estimated_minutes?: number | null;
  preferred_time?: string | null;
};

const normalizePreferredTime = (value: unknown, fallbackTime: string): string => {
  if (typeof value !== 'string') return fallbackTime;

  const trimmed = value.trim();
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!match) return fallbackTime;

  return `${match[1].padStart(2, '0')}:${match[2]}`;
};

const normalizeEstimatedMinutes = (value: unknown): number | undefined => {
  if (
    typeof value === 'number'
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value > 0
    && value <= MAX_JOURNEY_RITUAL_ESTIMATED_MINUTES
  ) {
    return value;
  }

  return undefined;
};

const normalizeJourneyRitualResponse = (ritual: JourneyRitualResponse, index: number): JourneyRitual => {
  const preferredTime = normalizePreferredTime(
    ritual.preferredTime ?? ritual.preferred_time,
    JOURNEY_RITUAL_TIME_FALLBACKS[index % JOURNEY_RITUAL_TIME_FALLBACKS.length],
  );
  const estimatedMinutes = normalizeEstimatedMinutes(ritual.estimatedMinutes ?? ritual.estimated_minutes);

  return {
    ...ritual,
    customDays: ritual.customDays ?? ritual.custom_days,
    customMonthDays: ritual.customMonthDays ?? ritual.custom_month_days,
    customPeriod: ritual.customPeriod ?? ritual.custom_period,
    preferredTime,
    estimatedMinutes,
  };
};

export const normalizeJourneySchedule = (schedule: JourneySchedule): JourneySchedule => ({
  ...schedule,
  rituals: Array.isArray(schedule.rituals)
    ? schedule.rituals.map((ritual, index) =>
      normalizeJourneyRitualResponse(ritual as JourneyRitualResponse, index)
    )
    : [],
});

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

      const generatedSchedule = normalizeJourneySchedule(data as JourneySchedule);
      setSchedule(generatedSchedule);
      return generatedSchedule;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to build schedule';
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

      const adjustedSchedule = normalizeJourneySchedule(data as JourneySchedule);
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

  const hydrateSchedule = useCallback((nextSchedule: JourneySchedule | null) => {
    setSchedule(nextSchedule ? normalizeJourneySchedule(nextSchedule) : null);
    setError(null);
    setIsLoading(false);
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
    hydrateSchedule,
    updateMilestoneDate,
    reset,
    postcardCount,
    maxPostcards: MAX_POSTCARDS,
  };
}
