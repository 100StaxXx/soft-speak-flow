import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useXPToast } from "@/contexts/XPContext";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useRef } from "react";
import { getEffectiveQuestXP } from "@/config/xpRewards";
import { calculateGuildBonus } from "@/utils/guildBonus";

type TaskCategory = 'mind' | 'body' | 'soul';
const validCategories: TaskCategory[] = ['mind', 'body', 'soul'];

const categoryKeywords: Record<TaskCategory, string[]> = {
  body: ['gym', 'run', 'exercise', 'workout', 'walk', 'yoga', 'stretch', 'fitness', 'sports'],
  soul: ['meditate', 'journal', 'breathe', 'gratitude', 'reflect', 'pray', 'mindful', 'relax', 'rest'],
  mind: ['read', 'learn', 'study', 'plan', 'organize', 'think', 'write', 'research', 'course']
};

function detectCategory(taskText: string, providedCategory?: string): TaskCategory | null {
  if (providedCategory && validCategories.includes(providedCategory as TaskCategory)) {
    return providedCategory as TaskCategory;
  }
  
  const text = taskText.toLowerCase();
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return cat as TaskCategory;
    }
  }
  return null;
}

export interface AddTaskParams {
  taskText: string;
  difficulty: 'easy' | 'medium' | 'hard';
  taskDate?: string;
  isMainQuest?: boolean;
  scheduledTime?: string | null;
  estimatedDuration?: number | null;
  recurrencePattern?: string | null;
  recurrenceDays?: number[] | null;
  reminderEnabled?: boolean;
  reminderMinutesBefore?: number;
  category?: string;
  notes?: string | null;
}

export const useTaskMutations = (taskDate: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companion } = useCompanion();
  const { updateBodyFromActivity } = useCompanionAttributes();
  const { showXPToast } = useXPToast();
  const { awardCustomXP } = useXPRewards();

  const toggleInProgress = useRef(false);
  const addInProgress = useRef(false);

  const addTask = useMutation({
    mutationFn: async (params: AddTaskParams) => {
      if (addInProgress.current) throw new Error('Please wait...');
      addInProgress.current = true;

      try {
        if (!user?.id) throw new Error('User not authenticated');
        
        const { data: existingTasks, error: countError } = await supabase
          .from('daily_tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('task_date', params.taskDate || taskDate);

        if (countError) throw countError;

        const questPosition = (existingTasks?.length || 0) + 1;
        const xpReward = getEffectiveQuestXP(params.difficulty, questPosition);
        const detectedCategory = detectCategory(params.taskText, params.category);

        const { error } = await supabase
          .from('daily_tasks')
          .insert({
            user_id: user.id,
            task_text: params.taskText,
            difficulty: params.difficulty,
            xp_reward: xpReward,
            task_date: params.taskDate || taskDate,
            is_main_quest: params.isMainQuest ?? false,
            scheduled_time: params.scheduledTime || null,
            estimated_duration: params.estimatedDuration || null,
            recurrence_pattern: params.recurrencePattern || null,
            recurrence_days: params.recurrenceDays || null,
            is_recurring: !!params.recurrencePattern,
            reminder_enabled: params.reminderEnabled ?? false,
            reminder_minutes_before: params.reminderMinutesBefore ?? 15,
            notes: params.notes || null,
            category: detectedCategory,
            is_bonus: false
          });

        if (error) {
          if (error.message?.includes('MAX_TASKS_REACHED') || error.message?.includes('Maximum quest limit')) {
            throw new Error('Maximum quest limit reached for today');
          }
          throw error;
        }
      } finally {
        addInProgress.current = false;
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
      if (!user?.id) throw new Error('User not authenticated');
      if (toggleInProgress.current) throw new Error('Please wait...');
      toggleInProgress.current = true;

      try {
        const { data: existingTask, error: existingError } = await supabase
          .from('daily_tasks')
          .select('completed_at')
          .eq('id', taskId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingError) throw existingError;

        const wasAlreadyCompleted = existingTask?.completed_at !== null;

        if (wasAlreadyCompleted && !completed) {
          throw new Error('Cannot uncheck completed tasks');
        }

        if (!completed) {
          const { error } = await supabase
            .from('daily_tasks')
            .update({ completed: false, completed_at: null })
            .eq('id', taskId)
            .eq('user_id', user.id);

          if (error) throw error;
          return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted };
        }

        const { bonusXP, toastReason } = await calculateGuildBonus(user.id, xpReward);
        const totalXP = xpReward + bonusXP;

        const { data: updateResult, error: updateError } = await supabase
          .from('daily_tasks')
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq('id', taskId)
          .eq('user_id', user.id)
          .eq('completed', false)
          .select();

        if (updateError) throw updateError;
        if (!updateResult || updateResult.length === 0) {
          throw new Error('Task was already completed');
        }

        await awardCustomXP(totalXP, 'task_complete', toastReason, { task_id: taskId });

        return { taskId, completed: true, xpAwarded: totalXP, bonusXP, toastReason, wasAlreadyCompleted };
      } finally {
        toggleInProgress.current = false;
      }
    },
    onSuccess: async ({ completed, xpAwarded, toastReason, wasAlreadyCompleted }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      if (completed && !wasAlreadyCompleted) {
        if (xpAwarded > 0) {
          showXPToast(xpAwarded, toastReason || 'Task Complete!');
        }
        if (companion?.id) {
          updateBodyFromActivity(companion.id).catch(console.error);
        }
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
      if (!user?.id) throw new Error('User not authenticated');
      if (!taskId) throw new Error('Invalid task ID');
      
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);
      
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
      if (!user?.id) throw new Error('User not authenticated');

      const { data: task, error: fetchError } = await supabase
        .from('daily_tasks')
        .select('id, user_id, task_date')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .eq('task_date', taskDate)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!task) throw new Error('Task not found or access denied');

      await supabase
        .from('daily_tasks')
        .update({ is_main_quest: false })
        .eq('user_id', user.id)
        .eq('task_date', taskDate);

      const { error: updateError } = await supabase
        .from('daily_tasks')
        .update({ is_main_quest: true })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast({ title: "Main quest updated!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update main quest", description: error.message, variant: "destructive" });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ taskId, updates }: { 
      taskId: string; 
      updates: {
        task_text: string;
        difficulty: string;
        scheduled_time: string | null;
        estimated_duration: number | null;
        notes: string | null;
      }
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('daily_tasks')
        .update({
          task_text: updates.task_text,
          difficulty: updates.difficulty,
          scheduled_time: updates.scheduled_time,
          estimated_duration: updates.estimated_duration,
          notes: updates.notes,
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({ title: "Quest updated!" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update quest", description: error.message, variant: "destructive" });
    },
  });

  return {
    addTask: addTask.mutate,
    toggleTask: toggleTask.mutate,
    deleteTask: deleteTask.mutate,
    setMainQuest: setMainQuest.mutate,
    updateTask: updateTask.mutateAsync,
    isAdding: addTask.isPending,
    isToggling: toggleTask.isPending,
    isDeleting: deleteTask.isPending,
    isUpdating: updateTask.isPending,
  };
};
