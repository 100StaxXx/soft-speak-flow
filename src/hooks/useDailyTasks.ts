import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useRef } from "react";

export const useDailyTasks = (selectedDate?: Date) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companion } = useCompanion();
  const { updateBodyFromActivity } = useCompanionAttributes();
  const { awardCustomXP } = useXPRewards();
  
  // Prevent rapid-fire clicks
  const toggleInProgress = useRef(false);

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
      // Prevent double-clicks
      if (toggleInProgress.current) {
        throw new Error('Please wait...');
      }
      toggleInProgress.current = true;

      // Check if this task was already completed before (to prevent XP spam)
      const { data: existingTask } = await supabase
        .from('daily_tasks')
        .select('completed_at')
        .eq('id', taskId)
        .maybeSingle();

      const wasAlreadyCompleted = existingTask?.completed_at !== null;

      const { error } = await supabase
        .from('daily_tasks')
        .update({
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', taskId);

      if (error) throw error;
      return { taskId, completed, xpReward, wasAlreadyCompleted };
    },
    onSuccess: async ({ completed, xpReward, wasAlreadyCompleted }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      // Only award XP if completing for the FIRST time
      if (completed && !wasAlreadyCompleted) {
        await awardCustomXP(xpReward, 'task_complete', 'Task Complete!');
        
        // Update companion body
        if (companion) {
          await updateBodyFromActivity(companion.id);
        }
        
        // Dispatch event for walkthrough
        window.dispatchEvent(new CustomEvent('mission-completed'));
      }
      toggleInProgress.current = false;
    },
    onError: () => {
      toggleInProgress.current = false;
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      // Check if task is completed - prevent deletion to avoid XP exploit
      const { data: task } = await supabase
        .from('daily_tasks')
        .select('completed, completed_at')
        .eq('id', taskId)
        .maybeSingle();
      
      if (task?.completed || task?.completed_at) {
        throw new Error('Cannot delete completed quests. They\'re part of your journey!');
      }

      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', taskId)
        .eq('completed', false); // Extra safety: only delete if not completed

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({ title: "Quest deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot delete quest",
        description: error.message,
        variant: "destructive",
      });
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
