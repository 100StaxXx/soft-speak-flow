import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useRef } from "react";
import { getQuestXP } from "@/config/xpRewards";

export const useDailyTasks = (selectedDate?: Date) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companion } = useCompanion();
  const { updateBodyFromActivity } = useCompanionAttributes();
  const { awardCustomXP } = useXPRewards();

  const toggleInProgress = useRef(false);
  const addInProgress = useRef(false);

  const taskDate = selectedDate ? selectedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['daily-tasks', user?.id, taskDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('task_date', taskDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const addTask = useMutation({
    mutationFn: async ({ 
      taskText, 
      difficulty, 
      taskDate: customDate, 
      isMainQuest,
      scheduledTime,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays
    }: { 
      taskText: string; 
      difficulty: 'easy' | 'medium' | 'hard'; 
      taskDate?: string; 
      isMainQuest?: boolean;
      scheduledTime?: string | null;
      estimatedDuration?: number | null;
      recurrencePattern?: string | null;
      recurrenceDays?: number[] | null;
    }) => {
      // Prevent duplicate submissions
      if (addInProgress.current) {
        throw new Error('Please wait...');
      }
      addInProgress.current = true;

      try {
        // Fetch fresh task count from database directly to avoid race conditions
        const { data: existingTasks, error: countError } = await supabase
          .from('daily_tasks')
          .select('id')
          .eq('user_id', user!.id)
          .eq('task_date', customDate || taskDate);

        if (countError) {
          addInProgress.current = false; // Reset on error
          throw countError;
        }

        if (existingTasks && existingTasks.length >= 4) {
          addInProgress.current = false; // Reset on error
          throw new Error('Maximum 4 tasks per day');
        }

        const xpReward = getQuestXP(difficulty);

        const { error } = await supabase
          .from('daily_tasks')
          .insert({
            user_id: user!.id,
            task_text: taskText,
            difficulty,
            xp_reward: xpReward,
            task_date: customDate || taskDate,
            is_main_quest: isMainQuest ?? false,
            scheduled_time: scheduledTime || null,
            estimated_duration: estimatedDuration || null,
            recurrence_pattern: recurrencePattern || null,
            recurrence_days: recurrenceDays || null,
            is_recurring: !!recurrencePattern,
          });

        if (error) {
          addInProgress.current = false; // Reset on error
          throw error;
        }
        
        // Success - reset flag
        addInProgress.current = false;
      } catch (error) {
        // Ensure flag is always reset
        addInProgress.current = false;
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({ title: "Task added successfully!" });
      window.dispatchEvent(new CustomEvent('task-added'));
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add task", description: error.message, variant: "destructive" });
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed, xpReward }: { taskId: string; completed: boolean; xpReward: number }) => {
      if (toggleInProgress.current) throw new Error('Please wait...');
      toggleInProgress.current = true;

      try {
        const { data: existingTask } = await supabase.from('daily_tasks').select('completed_at').eq('id', taskId).maybeSingle();
        const wasAlreadyCompleted = existingTask?.completed_at !== null;

        const { error } = await supabase.from('daily_tasks').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', taskId);
        if (error) {
          toggleInProgress.current = false;
          throw error;
        }
        
        toggleInProgress.current = false;
        return { taskId, completed, xpReward, wasAlreadyCompleted };
      } catch (error) {
        toggleInProgress.current = false;
        throw error;
      }
    },
    onSuccess: async ({ completed, xpReward, wasAlreadyCompleted }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      if (completed && !wasAlreadyCompleted) {
        console.log('[useDailyTasks] Quest completed, awarding XP:', xpReward);
        await awardCustomXP(xpReward, 'task_complete', 'Task Complete!');
        if (companion) await updateBodyFromActivity(companion.id);
        window.dispatchEvent(new CustomEvent('mission-completed'));
      }
    },
    onError: (error: Error) => {
      const errorMessage = error.message === 'Please wait...' 
        ? 'Please wait for the previous action to complete'
        : error.message.includes('Failed to fetch') || error.message.includes('Load failed')
        ? 'Network error. Please check your connection and try again.'
        : error.message;
      
      toast({ title: "Failed to toggle task", description: errorMessage, variant: "destructive" });
    },
    retry: 2,
    retryDelay: 1000,
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('daily_tasks').delete().eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({ title: "Task deleted successfully!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete task", description: error.message, variant: "destructive" });
    },
  });

  const setMainQuest = useMutation({
    mutationFn: async (taskId: string) => {
      // First, unset all main quests
      await supabase.from('daily_tasks').update({ is_main_quest: false }).eq('user_id', user!.id).eq('task_date', taskDate);
      // Then set the selected one
      const { error } = await supabase.from('daily_tasks').update({ is_main_quest: true }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({ title: "Main quest updated!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update main quest", description: error.message, variant: "destructive" });
    },
  });

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;
  const canAddMore = tasks.length < 4;

  return {
    tasks,
    isLoading,
    addTask: addTask.mutate,
    toggleTask: toggleTask.mutate,
    deleteTask: deleteTask.mutate,
    setMainQuest: setMainQuest.mutate,
    isAdding: addTask.isPending,
    isToggling: toggleTask.isPending,
    canAddMore,
    completedCount,
    totalCount,
  };
};
