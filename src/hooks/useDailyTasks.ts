import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { useXPRewards } from "@/hooks/useXPRewards";

export const useDailyTasks = (selectedDate?: Date) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();

  const taskDate = selectedDate 
    ? selectedDate.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['daily-tasks', user?.id, taskDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('task_date', taskDate)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addTask = useMutation({
    mutationFn: async ({ taskText, difficulty, taskDate: customDate }: { 
      taskText: string; 
      difficulty: 'easy' | 'medium' | 'hard';
      taskDate?: string;
    }) => {
      if (tasks.length >= 3) {
        throw new Error('Maximum 3 tasks per day');
      }

      const xpRewards = { easy: 5, medium: 15, hard: 25 };
      const xpReward = xpRewards[difficulty];

      const { error } = await supabase
        .from('daily_tasks')
        .insert({
          user_id: user!.id,
          task_text: taskText,
          difficulty,
          xp_reward: xpReward,
          task_date: customDate || taskDate,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({ title: "Task added successfully!" });
      // Notify tutorial listener to advance to the next step
      window.dispatchEvent(new CustomEvent('task-added'));
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add task",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed, xpReward }: { taskId: string; completed: boolean; xpReward: number }) => {
      const { error } = await supabase
        .from('daily_tasks')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', taskId);

      if (error) throw error;
      return { taskId, completed, xpReward };
    },
    onSuccess: ({ completed, xpReward }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      if (completed) {
        awardCustomXP(xpReward, 'task_complete', 'Task Complete!');
        // Dispatch event for walkthrough
        window.dispatchEvent(new CustomEvent('mission-completed'));
      }
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({ title: "Task deleted" });
    },
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return {
    tasks,
    isLoading,
    addTask: addTask.mutate,
    toggleTask: toggleTask.mutate,
    deleteTask: deleteTask.mutate,
    isAdding: addTask.isPending,
    isToggling: toggleTask.isPending,
    completedCount,
    totalCount,
    canAddMore: tasks.length < 3,
  };
};
