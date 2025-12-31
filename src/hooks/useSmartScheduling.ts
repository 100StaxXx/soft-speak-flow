import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface SuggestedSlot {
  time: string;
  score: number;
  reason: string;
}

interface UseSmartSchedulingResult {
  suggestedSlots: SuggestedSlot[];
  isLoading: boolean;
  error: string | null;
  getSuggestedSlots: (
    taskDate: Date,
    duration?: number,
    difficulty?: 'easy' | 'medium' | 'hard'
  ) => Promise<void>;
  clearSuggestions: () => void;
}

export function useSmartScheduling(): UseSmartSchedulingResult {
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSuggestedSlots = useCallback(async (
    taskDate: Date,
    duration: number = 30,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('suggest-task-times', {
        body: {
          task_date: format(taskDate, 'yyyy-MM-dd'),
          estimated_duration: duration,
          difficulty,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      setSuggestedSlots(data?.suggestedSlots || []);
    } catch (err) {
      console.error('[useSmartScheduling] Error fetching suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
      setSuggestedSlots([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestedSlots([]);
    setError(null);
  }, []);

  return {
    suggestedSlots,
    isLoading,
    error,
    getSuggestedSlots,
    clearSuggestions,
  };
}
