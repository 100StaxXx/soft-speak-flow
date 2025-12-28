import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type InteractionType = 'classify' | 'suggest_epic' | 'adjust_plan' | 'chat';

interface EnrichedContextSummary {
  atEpicLimit: boolean;
  overloaded: boolean;
  suggestedWorkload: 'light' | 'normal' | 'heavy';
  activeEpicCount: number;
  activeHabitCount: number;
}

interface OrchestratorResponse<T = Record<string, unknown>> {
  data: T | null;
  enrichedContext: EnrichedContextSummary | null;
  sessionId: string | null;
  responseTimeMs: number | null;
  error: string | null;
  capacityWarnings?: {
    atEpicLimit: boolean;
    overloaded: boolean;
    suggestedWorkload: 'light' | 'normal' | 'heavy';
  };
  warning?: string;
}

interface UseAIOrchestratorReturn {
  invoke: <T = Record<string, unknown>>(
    input: string,
    interactionType: InteractionType,
    additionalContext?: Record<string, unknown>
  ) => Promise<OrchestratorResponse<T>>;
  isLoading: boolean;
  lastResponse: OrchestratorResponse | null;
  sessionId: string | null;
  capacityWarnings: EnrichedContextSummary | null;
}

export function useAIOrchestrator(): UseAIOrchestratorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<OrchestratorResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [capacityWarnings, setCapacityWarnings] = useState<EnrichedContextSummary | null>(null);

  const invoke = useCallback(async <T = Record<string, unknown>>(
    input: string,
    interactionType: InteractionType,
    additionalContext?: Record<string, unknown>
  ): Promise<OrchestratorResponse<T>> => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-orchestrator', {
        body: {
          input,
          interactionType,
          sessionId,
          additionalContext,
        },
      });

      if (error) {
        const response: OrchestratorResponse<T> = {
          data: null,
          enrichedContext: null,
          sessionId: null,
          responseTimeMs: null,
          error: error.message,
        };
        setLastResponse(response as OrchestratorResponse);
        return response;
      }

      const response: OrchestratorResponse<T> = {
        data: data as T,
        enrichedContext: data?.enrichedContext || null,
        sessionId: data?.sessionId || null,
        responseTimeMs: data?.responseTimeMs || null,
        error: null,
        capacityWarnings: data?.capacityWarnings,
        warning: data?.warning,
      };

      // Update session ID for conversation continuity
      if (data?.sessionId) {
        setSessionId(data.sessionId);
      }

      // Update capacity warnings
      if (data?.enrichedContext) {
        setCapacityWarnings(data.enrichedContext);
      }

      setLastResponse(response as OrchestratorResponse);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const response: OrchestratorResponse<T> = {
        data: null,
        enrichedContext: null,
        sessionId: null,
        responseTimeMs: null,
        error: errorMessage,
      };
      setLastResponse(response as OrchestratorResponse);
      return response;
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  return {
    invoke,
    isLoading,
    lastResponse,
    sessionId,
    capacityWarnings,
  };
}
