import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityUpdate {
  taskId: string;
  priority?: Priority;
  isTopThree?: boolean;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const PRIORITY_LABELS: Record<Priority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'text-red-500' },
  high: { label: 'High', color: 'text-orange-500' },
  medium: { label: 'Medium', color: 'text-yellow-500' },
  low: { label: 'Low', color: 'text-muted-foreground' },
};

export function usePriorityTasks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update task priority
  const updatePriorityMutation = useMutation({
    mutationFn: async ({ taskId, priority }: { taskId: string; priority: Priority }) => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .update({ priority })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
    onError: (error) => {
      console.error('Failed to update priority:', error);
      toast({
        title: "Failed to update priority",
        variant: "destructive",
      });
    },
  });

  // Toggle top three status
  const toggleTopThreeMutation = useMutation({
    mutationFn: async ({ taskId, isTopThree }: { taskId: string; isTopThree: boolean }) => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .update({ is_top_three: isTopThree })
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      if (data.is_top_three) {
        toast({
          title: "Added to Top 3 🎯",
          description: "Focus on completing this task today!",
        });
      }
    },
    onError: (error) => {
      console.error('Failed to toggle top three:', error);
      toast({
        title: "Failed to update task",
        variant: "destructive",
      });
    },
  });

  // Batch update for setting top 3
  const setTopThreeMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      // First, clear all top three flags for today
      const today = new Date().toISOString().split('T')[0];
      
      await supabase
        .from('daily_tasks')
        .update({ is_top_three: false })
        .eq('task_date', today);

      // Then set the new top three
      if (taskIds.length > 0) {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ is_top_three: true })
          .in('id', taskIds);

        if (error) throw error;
      }

      return taskIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({
        title: "Top 3 updated! 🎯",
        description: "Focus on these priorities today",
      });
    },
  });

  // Sort tasks by priority
  const sortByPriority = <T extends { priority?: string | null }>(tasks: T[]): T[] => {
    return [...tasks].sort((a, b) => {
      const priorityA = PRIORITY_ORDER[(a.priority as Priority) || 'medium'];
      const priorityB = PRIORITY_ORDER[(b.priority as Priority) || 'medium'];
      return priorityA - priorityB;
    });
  };

  return {
    updatePriority: (taskId: string, priority: Priority) => 
      updatePriorityMutation.mutate({ taskId, priority }),
    toggleTopThree: (taskId: string, isTopThree: boolean) => 
      toggleTopThreeMutation.mutate({ taskId, isTopThree }),
    setTopThree: (taskIds: string[]) => 
      setTopThreeMutation.mutate(taskIds),
    sortByPriority,
    PRIORITY_ORDER,
    PRIORITY_LABELS,
    isUpdating: updatePriorityMutation.isPending || toggleTopThreeMutation.isPending,
  };
}
