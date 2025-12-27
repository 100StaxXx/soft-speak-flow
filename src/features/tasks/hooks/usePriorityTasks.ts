import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type EnergyLevel = 'low' | 'medium' | 'high';

export interface PriorityUpdate {
  taskId: string;
  priority?: Priority;
  energyLevel?: EnergyLevel;
  isTopThree?: boolean;
}

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const ENERGY_LABELS: Record<EnergyLevel, { label: string; emoji: string }> = {
  high: { label: 'High Energy', emoji: '⚡' },
  medium: { label: 'Medium Energy', emoji: '🔋' },
  low: { label: 'Low Energy', emoji: '🌙' },
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

  // Update task energy level
  const updateEnergyLevelMutation = useMutation({
    mutationFn: async ({ taskId, energyLevel }: { taskId: string; energyLevel: EnergyLevel }) => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .update({ energy_level: energyLevel })
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
      console.error('Failed to update energy level:', error);
      toast({
        title: "Failed to update energy level",
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

  // Filter tasks by energy level
  const filterByEnergy = <T extends { energy_level?: string | null }>(
    tasks: T[], 
    currentEnergy: EnergyLevel
  ): T[] => {
    const energyOrder: EnergyLevel[] = ['low', 'medium', 'high'];
    const currentIndex = energyOrder.indexOf(currentEnergy);
    
    return tasks.filter(task => {
      const taskEnergy = (task.energy_level as EnergyLevel) || 'medium';
      const taskIndex = energyOrder.indexOf(taskEnergy);
      return taskIndex <= currentIndex;
    });
  };

  // Get suggested tasks based on time and energy
  const getSuggestedTasks = <T extends { 
    priority?: string | null; 
    energy_level?: string | null;
    estimated_duration?: number | null;
  }>(
    tasks: T[],
    availableMinutes: number,
    currentEnergy: EnergyLevel
  ): T[] => {
    return tasks
      .filter(task => {
        const duration = task.estimated_duration || 30;
        const taskEnergy = (task.energy_level as EnergyLevel) || 'medium';
        const energyOrder: EnergyLevel[] = ['low', 'medium', 'high'];
        
        return duration <= availableMinutes && 
               energyOrder.indexOf(taskEnergy) <= energyOrder.indexOf(currentEnergy);
      })
      .sort((a, b) => {
        const priorityA = PRIORITY_ORDER[(a.priority as Priority) || 'medium'];
        const priorityB = PRIORITY_ORDER[(b.priority as Priority) || 'medium'];
        return priorityA - priorityB;
      })
      .slice(0, 3);
  };

  return {
    updatePriority: (taskId: string, priority: Priority) => 
      updatePriorityMutation.mutate({ taskId, priority }),
    updateEnergyLevel: (taskId: string, energyLevel: EnergyLevel) => 
      updateEnergyLevelMutation.mutate({ taskId, energyLevel }),
    toggleTopThree: (taskId: string, isTopThree: boolean) => 
      toggleTopThreeMutation.mutate({ taskId, isTopThree }),
    setTopThree: (taskIds: string[]) => 
      setTopThreeMutation.mutate(taskIds),
    sortByPriority,
    filterByEnergy,
    getSuggestedTasks,
    PRIORITY_ORDER,
    PRIORITY_LABELS,
    ENERGY_LABELS,
    isUpdating: updatePriorityMutation.isPending || 
                updateEnergyLevelMutation.isPending || 
                toggleTopThreeMutation.isPending,
  };
}
