import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SuggestedSubtask {
  id: string;
  title: string;
  durationMinutes: number;
  selected: boolean;
}

export function useTaskDecomposition() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decompose = async (
    taskTitle: string, 
    taskDescription?: string
  ): Promise<SuggestedSubtask[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('decompose-task', {
        body: { taskTitle, taskDescription }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to decompose task');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Map response to SuggestedSubtask with unique IDs and selected state
      const subtasks: SuggestedSubtask[] = (data.subtasks || []).map(
        (s: { title: string; durationMinutes: number }, index: number) => ({
          id: `suggestion-${index}-${Date.now()}`,
          title: s.title,
          durationMinutes: s.durationMinutes,
          selected: true,
        })
      );

      return subtasks;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to decompose task';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { decompose, isLoading, error };
}
