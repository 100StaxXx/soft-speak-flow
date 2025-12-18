import { useState, useCallback } from 'react';
import type { GenerationPhase } from '@/components/ImageGenerationProgress';

interface UseImageGenerationProgressReturn {
  phase: GenerationPhase;
  retryCount: number;
  setPhase: (phase: GenerationPhase) => void;
  setRetryCount: (count: number) => void;
  reset: () => void;
  startGeneration: () => void;
  startValidation: () => void;
  startRetry: () => void;
  complete: (withWarning?: boolean) => void;
}

export const useImageGenerationProgress = (): UseImageGenerationProgressReturn => {
  const [phase, setPhase] = useState<GenerationPhase>('starting');
  const [retryCount, setRetryCount] = useState(0);

  const reset = useCallback(() => {
    setPhase('starting');
    setRetryCount(0);
  }, []);

  const startGeneration = useCallback(() => {
    setPhase('generating');
  }, []);

  const startValidation = useCallback(() => {
    setPhase('validating');
  }, []);

  const startRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    setPhase('retrying');
  }, []);

  const complete = useCallback((withWarning = false) => {
    setPhase(withWarning ? 'warning' : 'complete');
  }, []);

  return {
    phase,
    retryCount,
    setPhase,
    setRetryCount,
    reset,
    startGeneration,
    startValidation,
    startRetry,
    complete
  };
};
