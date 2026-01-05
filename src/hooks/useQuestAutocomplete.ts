import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AutocompleteSuggestion {
  text: string;
  source: 'recent' | 'habit';
  frequency: number;
}

interface TaskFrequency {
  task_text: string;
  frequency: number;
}

export function useQuestAutocomplete(input: string) {
  const { user } = useAuth();
  const trimmedInput = input.trim().toLowerCase();

  // Fetch past task texts with frequency
  const { data: taskHistory = [] } = useQuery({
    queryKey: ['quest-autocomplete-tasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get distinct task texts with frequency count
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('task_text')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Failed to fetch task history:', error);
        return [];
      }

      // Build frequency map
      const frequencyMap = new Map<string, number>();
      (data || []).forEach(task => {
        const text = task.task_text.trim();
        if (text) {
          frequencyMap.set(text, (frequencyMap.get(text) || 0) + 1);
        }
      });

      // Convert to array and sort by frequency
      return Array.from(frequencyMap.entries())
        .map(([task_text, frequency]) => ({ task_text, frequency }))
        .sort((a, b) => b.frequency - a.frequency);
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Fetch user's habits
  const { data: habits = [] } = useQuery({
    queryKey: ['quest-autocomplete-habits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('habits')
        .select('title')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Failed to fetch habits:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Filter and rank suggestions based on input
  const suggestions = useMemo((): AutocompleteSuggestion[] => {
    // Need at least 2 characters to show suggestions
    if (trimmedInput.length < 2) return [];

    const results: AutocompleteSuggestion[] = [];
    const seen = new Set<string>();

    // Add matching tasks (prioritized by frequency)
    taskHistory.forEach((task: TaskFrequency) => {
      const lowerText = task.task_text.toLowerCase();
      if (lowerText.includes(trimmedInput) && !seen.has(lowerText)) {
        seen.add(lowerText);
        results.push({
          text: task.task_text,
          source: 'recent',
          frequency: task.frequency,
        });
      }
    });

    // Add matching habits
    habits.forEach((habit: { title: string }) => {
      const lowerTitle = habit.title.toLowerCase();
      if (lowerTitle.includes(trimmedInput) && !seen.has(lowerTitle)) {
        seen.add(lowerTitle);
        results.push({
          text: habit.title,
          source: 'habit',
          frequency: 1, // Habits always show as available
        });
      }
    });

    // Sort: exact prefix matches first, then by frequency
    results.sort((a, b) => {
      const aStartsWith = a.text.toLowerCase().startsWith(trimmedInput);
      const bStartsWith = b.text.toLowerCase().startsWith(trimmedInput);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      return b.frequency - a.frequency;
    });

    // Return top 5 suggestions
    return results.slice(0, 5);
  }, [trimmedInput, taskHistory, habits]);

  return {
    suggestions,
    hasSuggestions: suggestions.length > 0,
  };
}
