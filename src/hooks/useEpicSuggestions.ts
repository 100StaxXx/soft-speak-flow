import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EpicSuggestion {
  id: string;
  title: string;
  type: 'habit' | 'milestone';
  description: string;
  frequency?: 'daily' | '5x_week' | '3x_week' | 'monthly' | 'custom';
  customDays?: number[];
  customMonthDays?: number[];
  customPeriod?: 'week' | 'month';
  difficulty: 'easy' | 'medium' | 'hard';
  suggestedWeek?: number;
  category?: string;
  selected?: boolean;
}

export interface ClarificationAnswers {
  subjects?: string;
  exam_date?: string;
  target_date?: string;
  hours_per_day?: number;
  days_per_week?: number;
  daily_hours?: number;
  current_status?: string;
  current_level?: string;
  timeline_context?: string;
  [key: string]: string | number | undefined;
}

export interface TimelineAnalysis {
  statedDays: number;
  typicalDays: number;
  feasibility: 'realistic' | 'aggressive' | 'very_aggressive';
  adjustmentFactors: string[];
}

interface UseEpicSuggestionsReturn {
  suggestions: EpicSuggestion[];
  isLoading: boolean;
  error: string | null;
  generateSuggestions: (
    goal: string, 
    options?: { 
      deadline?: string; 
      targetDays?: number;
      clarificationAnswers?: ClarificationAnswers;
      epicContext?: string;
      timelineAnalysis?: TimelineAnalysis;
    }
  ) => Promise<void>;
  toggleSuggestion: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  getSelectedSuggestions: () => EpicSuggestion[];
  reset: () => void;
}

export function useEpicSuggestions(): UseEpicSuggestionsReturn {
  const [suggestions, setSuggestions] = useState<EpicSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = useCallback(async (
    goal: string, 
    options?: { 
      deadline?: string; 
      targetDays?: number;
      clarificationAnswers?: ClarificationAnswers;
      epicContext?: string;
      timelineAnalysis?: TimelineAnalysis;
    }
  ) => {
    if (!goal.trim()) {
      setError('Please enter a goal');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-epic-suggestions', {
        body: { 
          goal: goal.trim(),
          deadline: options?.deadline,
          targetDays: options?.targetDays,
          clarificationAnswers: options?.clarificationAnswers,
          epicContext: options?.epicContext,
          timelineAnalysis: options?.timelineAnalysis,
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Add selected: false to all suggestions
      const suggestionsWithSelection = (data.suggestions || []).map((s: EpicSuggestion) => ({
        ...s,
        selected: false,
      }));

      setSuggestions(suggestionsWithSelection);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to build suggestions';
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

  const selectAll = useCallback(() => {
    setSuggestions(prev => prev.map(s => ({ ...s, selected: true })));
  }, []);

  const deselectAll = useCallback(() => {
    setSuggestions(prev => prev.map(s => ({ ...s, selected: false })));
  }, []);

  const getSelectedSuggestions = useCallback(() => {
    return suggestions.filter(s => s.selected);
  }, [suggestions]);

  const reset = useCallback(() => {
    setSuggestions([]);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    generateSuggestions,
    toggleSuggestion,
    selectAll,
    deselectAll,
    getSelectedSuggestions,
    reset,
  };
}
