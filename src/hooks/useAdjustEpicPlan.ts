import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AdjustmentType = 
  | 'extend_deadline' 
  | 'reduce_scope' 
  | 'add_habits' 
  | 'remove_habits' 
  | 'reschedule' 
  | 'custom';

export interface AdjustmentSuggestion {
  id: string;
  type: 'habit_change' | 'milestone_change' | 'timeline_change' | 'difficulty_change';
  action: 'add' | 'remove' | 'modify';
  title: string;
  description: string;
  details?: Record<string, unknown>;
  selected?: boolean;
}

export interface EpicStatus {
  daysElapsed: number;
  daysRemaining: number;
  actualProgress: number;
  expectedProgress: number;
  progressDelta: number;
}

export interface AdjustmentResult {
  analysis: string;
  suggestions: AdjustmentSuggestion[];
  encouragement: string;
  epicStatus: EpicStatus;
}

interface UseAdjustEpicPlanReturn {
  suggestions: AdjustmentSuggestion[];
  analysis: string | null;
  encouragement: string | null;
  epicStatus: EpicStatus | null;
  isLoading: boolean;
  error: string | null;
  generateAdjustments: (
    epicId: string,
    adjustmentType: AdjustmentType,
    options?: {
      reason?: string;
      newDeadline?: string;
      daysToAdd?: number;
      habitsToRemove?: string[];
      customRequest?: string;
    }
  ) => Promise<void>;
  toggleSuggestion: (id: string) => void;
  getSelectedSuggestions: () => AdjustmentSuggestion[];
  applyAdjustments: (
    epicId: string,
    adjustmentType?: AdjustmentType,
    reason?: string
  ) => Promise<boolean>;
  reset: () => void;
}

export function useAdjustEpicPlan(): UseAdjustEpicPlanReturn {
  const [suggestions, setSuggestions] = useState<AdjustmentSuggestion[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [epicStatus, setEpicStatus] = useState<EpicStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAdjustments = useCallback(async (
    epicId: string,
    adjustmentType: AdjustmentType,
    options?: {
      reason?: string;
      newDeadline?: string;
      daysToAdd?: number;
      habitsToRemove?: string[];
      customRequest?: string;
    }
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('adjust-epic-plan', {
        body: {
          epicId,
          adjustmentType,
          reason: options?.reason,
          newDeadline: options?.newDeadline,
          daysToAdd: options?.daysToAdd,
          habitsToRemove: options?.habitsToRemove,
          customRequest: options?.customRequest,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const result = data as AdjustmentResult;
      
      // Add selected: false to all suggestions
      const suggestionsWithSelection = result.suggestions.map(s => ({
        ...s,
        selected: false,
      }));

      setSuggestions(suggestionsWithSelection);
      setAnalysis(result.analysis);
      setEncouragement(result.encouragement);
      setEpicStatus(result.epicStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to build adjustment suggestions';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleSuggestion = useCallback((id: string) => {
    setSuggestions(prev =>
      prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s)
    );
  }, []);

  const getSelectedSuggestions = useCallback(() => {
    return suggestions.filter(s => s.selected);
  }, [suggestions]);

  const applyAdjustments = useCallback(async (
    epicId: string,
    adjustmentType?: AdjustmentType,
    reason?: string
  ): Promise<boolean> => {
    const selected = getSelectedSuggestions();
    
    if (selected.length === 0) {
      toast.error('Please select at least one adjustment to apply');
      return false;
    }

    setIsLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('apply-epic-adjustments', {
        body: {
          epicId,
          adjustments: selected,
          adjustmentType,
          reason,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success(data.message || `Applied ${selected.length} adjustment${selected.length > 1 ? 's' : ''} to your plan`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply adjustments';
      toast.error(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [getSelectedSuggestions]);

  const reset = useCallback(() => {
    setSuggestions([]);
    setAnalysis(null);
    setEncouragement(null);
    setEpicStatus(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    suggestions,
    analysis,
    encouragement,
    epicStatus,
    isLoading,
    error,
    generateAdjustments,
    toggleSuggestion,
    getSelectedSuggestions,
    applyAdjustments,
    reset,
  };
}
