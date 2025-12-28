import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface IntentClassification {
  type: 'quest' | 'epic' | 'habit';
  confidence: number;
  reasoning: string;
  suggestedDeadline?: string;
  suggestedDuration?: number;
}

interface UseIntentClassifierOptions {
  debounceMs?: number;
  minInputLength?: number;
}

export function useIntentClassifier(options: UseIntentClassifierOptions = {}) {
  const { debounceMs = 500, minInputLength = 10 } = options;
  
  const [classification, setClassification] = useState<IntentClassification | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastInputRef = useRef<string>('');

  const classify = useCallback(async (input: string): Promise<IntentClassification | null> => {
    if (!input || input.length < minInputLength) {
      setClassification(null);
      return null;
    }

    // Skip if input hasn't changed
    if (input === lastInputRef.current) {
      return classification;
    }
    lastInputRef.current = input;

    setIsClassifying(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('classify-task-intent', {
        body: { input },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const result = data as IntentClassification;
      setClassification(result);
      return result;
    } catch (err) {
      console.error('Intent classification error:', err);
      setError(err instanceof Error ? err.message : 'Classification failed');
      setClassification(null);
      return null;
    } finally {
      setIsClassifying(false);
    }
  }, [classification, minInputLength]);

  const classifyDebounced = useCallback((input: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!input || input.length < minInputLength) {
      setClassification(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      classify(input);
    }, debounceMs);
  }, [classify, debounceMs, minInputLength]);

  const reset = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setClassification(null);
    setError(null);
    setIsClassifying(false);
    lastInputRef.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const isEpicDetected = classification?.type === 'epic' && classification.confidence >= 0.6;
  const isHabitDetected = classification?.type === 'habit' && classification.confidence >= 0.6;

  return {
    classification,
    isClassifying,
    error,
    classify,
    classifyDebounced,
    reset,
    isEpicDetected,
    isHabitDetected,
  };
}
