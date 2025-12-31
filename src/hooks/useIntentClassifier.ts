import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExtractedTask {
  title: string;
  estimatedDuration?: number;
  energyLevel?: 'low' | 'medium' | 'high';
  suggestedTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  category?: string;
}

export interface SuggestedTask extends ExtractedTask {
  reason: string;
}

export interface DetectedContext {
  dayOfWeek?: string;
  userSituation?: string;
  targetDate?: string;
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'date' | 'number';
  options?: string[];
  placeholder?: string;
  required: boolean;
  multiSelect?: boolean;
}

export interface EpicDetails {
  subjects?: string[];
  targetDate?: string;
  hoursPerDay?: number;
  currentStatus?: string;
  suggestedTargetDays?: number;
}

export interface CapacityWarnings {
  atEpicLimit: boolean;
  overloaded: boolean;
  suggestedWorkload: 'light' | 'normal' | 'heavy';
}

export interface TimelineAnalysis {
  statedDays: number;
  typicalDays: number;
  feasibility: 'realistic' | 'aggressive' | 'very_aggressive';
  adjustmentFactors: string[];
}

export interface IntentClassification {
  type: 'quest' | 'epic' | 'habit' | 'brain-dump';
  confidence: number;
  reasoning: string;
  suggestedDeadline?: string;
  suggestedDuration?: number;
  // Brain-dump specific fields
  needsClarification?: boolean;
  clarifyingQuestion?: string;
  clarificationContext?: string;
  extractedTasks?: ExtractedTask[];
  suggestedTasks?: SuggestedTask[];
  detectedContext?: DetectedContext;
  // Epic-specific clarification fields
  epicClarifyingQuestions?: ClarifyingQuestion[];
  epicContext?: string;
  epicDetails?: EpicDetails;
  // Timeline intelligence
  timelineAnalysis?: TimelineAnalysis;
  // Capacity warnings from orchestrator
  capacityWarnings?: CapacityWarnings;
  warning?: string;
}

interface UseIntentClassifierOptions {
  debounceMs?: number;
  minInputLength?: number;
  useOrchestrator?: boolean;
}

export function useIntentClassifier(options: UseIntentClassifierOptions = {}) {
  const { debounceMs = 500, minInputLength = 10, useOrchestrator = false } = options;
  
  const [classification, setClassification] = useState<IntentClassification | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capacityWarnings, setCapacityWarnings] = useState<CapacityWarnings | null>(null);
  
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
      // Use orchestrator if enabled, otherwise direct call
      const endpoint = useOrchestrator ? 'ai-orchestrator' : 'classify-task-intent';
      const body = useOrchestrator 
        ? { input, interactionType: 'classify' }
        : { input };

      const { data, error: fnError } = await supabase.functions.invoke(endpoint, { body });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // When using orchestrator, the classification is embedded in the response
      // The orchestrator returns: { ...classificationData, enrichedContext, capacityWarnings, sessionId, responseTimeMs }
      // Extract the classification fields properly
      let result: IntentClassification;
      
      if (useOrchestrator) {
        // Extract classification data from orchestrator response
        // The orchestrator embeds classification fields directly in the response
        result = {
          type: data.type || 'quest',
          confidence: data.confidence || 0,
          reasoning: data.reasoning || '',
          suggestedDeadline: data.suggestedDeadline,
          suggestedDuration: data.suggestedDuration,
          needsClarification: data.needsClarification,
          clarifyingQuestion: data.clarifyingQuestion,
          clarificationContext: data.clarificationContext,
          extractedTasks: data.extractedTasks,
          suggestedTasks: data.suggestedTasks,
          detectedContext: data.detectedContext,
          epicClarifyingQuestions: data.epicClarifyingQuestions,
          epicContext: data.epicContext,
          epicDetails: data.epicDetails,
          timelineAnalysis: data.timelineAnalysis,
          capacityWarnings: data.capacityWarnings,
          warning: data.warning,
        };
        
        // Extract capacity warnings from orchestrator
        if (data.capacityWarnings) {
          setCapacityWarnings(data.capacityWarnings);
        } else if (data.enrichedContext) {
          // Fallback to enrichedContext if capacityWarnings not present directly
          setCapacityWarnings({
            atEpicLimit: data.enrichedContext.atEpicLimit ?? false,
            overloaded: data.enrichedContext.overloaded ?? false,
            suggestedWorkload: data.enrichedContext.suggestedWorkload ?? 'normal',
          });
        }
      } else {
        result = data as IntentClassification;
      }
      
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
  }, [classification, minInputLength, useOrchestrator]);

  // Clarify function for brain-dump follow-up questions
  const clarify = useCallback(async (
    originalInput: string, 
    userResponse: string
  ): Promise<IntentClassification | null> => {
    if (!originalInput || !userResponse) {
      return null;
    }

    setIsClassifying(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('classify-task-intent', {
        body: { 
          input: originalInput,
          clarification: userResponse,
          previousContext: classification?.clarificationContext
        },
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
      console.error('Intent clarification error:', err);
      setError(err instanceof Error ? err.message : 'Clarification failed');
      return null;
    } finally {
      setIsClassifying(false);
    }
  }, [classification?.clarificationContext]);

  // Clarify function for epic-specific questions
  const clarifyEpic = useCallback(async (
    originalInput: string,
    answers: Record<string, string | number>
  ): Promise<IntentClassification | null> => {
    if (!originalInput || !answers || Object.keys(answers).length === 0) {
      return null;
    }

    setIsClassifying(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('classify-task-intent', {
        body: { 
          input: originalInput,
          epicAnswers: answers
        },
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
      console.error('Epic clarification error:', err);
      setError(err instanceof Error ? err.message : 'Epic clarification failed');
      return null;
    } finally {
      setIsClassifying(false);
    }
  }, []);

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
  const isBrainDumpDetected = classification?.type === 'brain-dump' && 
                              classification.confidence >= 0.7 &&
                              (classification.extractedTasks?.length ?? 0) >= 2;
  const needsEpicClarification = isEpicDetected && 
                                  classification?.needsClarification === true &&
                                  (classification?.epicClarifyingQuestions?.length ?? 0) > 0;

  return {
    classification,
    isClassifying,
    error,
    classify,
    clarify,
    clarifyEpic,
    classifyDebounced,
    reset,
    isEpicDetected,
    isHabitDetected,
    isBrainDumpDetected,
    needsClarification: classification?.needsClarification ?? false,
    clarifyingQuestion: classification?.clarifyingQuestion,
    extractedTasks: classification?.extractedTasks ?? [],
    suggestedTasks: classification?.suggestedTasks ?? [],
    detectedContext: classification?.detectedContext,
    // Epic-specific returns
    needsEpicClarification,
    epicClarifyingQuestions: classification?.epicClarifyingQuestions ?? [],
    epicContext: classification?.epicContext,
    epicDetails: classification?.epicDetails,
    // Timeline intelligence
    timelineAnalysis: classification?.timelineAnalysis ?? null,
    // Capacity warnings (from orchestrator)
    capacityWarnings,
    capacityWarning: classification?.warning ?? null,
    isAtEpicLimit: capacityWarnings?.atEpicLimit ?? false,
    isOverloaded: capacityWarnings?.overloaded ?? false,
  };
}
