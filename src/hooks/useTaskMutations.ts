import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useXPToast } from "@/contexts/XPContext";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useSchedulingLearner } from "@/hooks/useSchedulingLearner";
import React, { useRef, createElement } from "react";
import { getEffectiveQuestXP } from "@/config/xpRewards";
import { calculateGuildBonus } from "@/utils/guildBonus";
import { format } from "date-fns";

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
  const { trackTaskCompletion, trackTaskCreation } = useSchedulingLearner();

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

        const { data, error } = await supabase
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
            category: detectedCategory,
            is_bonus: false,
            notes: params.notes || null
          })
          .select()
          .single();

        if (error) {
          if (error.message?.includes('MAX_TASKS_REACHED') || error.message?.includes('Maximum quest limit')) {
            throw new Error('Maximum quest limit reached for today');
          }
          throw error;
        }
        return data;
      } finally {
        addInProgress.current = false;
      }
    },
    onMutate: async (params: AddTaskParams) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['daily-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['calendar-tasks'] });

      // Snapshot previous values
      const previousDailyTasks = queryClient.getQueriesData({ queryKey: ['daily-tasks'] });
      const previousCalendarTasks = queryClient.getQueriesData({ queryKey: ['calendar-tasks'] });

      // Create optimistic task with all required fields
      const optimisticTask = {
        id: `temp-${Date.now()}`,
        user_id: user?.id,
        task_text: params.taskText,
        difficulty: params.difficulty,
        task_date: params.taskDate || taskDate,
        completed: false,
        completed_at: null,
        is_main_quest: params.isMainQuest ?? false,
        scheduled_time: params.scheduledTime || null,
        estimated_duration: params.estimatedDuration || null,
        xp_reward: getEffectiveQuestXP(params.difficulty, 1),
        created_at: new Date().toISOString(),
        category: detectCategory(params.taskText, params.category),
        is_bonus: false,
        is_recurring: !!params.recurrencePattern,
        recurrence_pattern: params.recurrencePattern || null,
        recurrence_days: params.recurrenceDays || null,
        reminder_enabled: params.reminderEnabled ?? false,
        reminder_minutes_before: params.reminderMinutesBefore ?? 15,
        reminder_sent: false,
        parent_template_id: null,
      };

      // Update all matching daily-tasks queries
      queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return [optimisticTask, ...old];
      });

      // Update all matching calendar-tasks queries
      queryClient.setQueriesData({ queryKey: ['calendar-tasks'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return [optimisticTask, ...old];
      });

      return { previousDailyTasks, previousCalendarTasks };
    },
    onError: (error: Error, _params, context) => {
      // Rollback on error
      if (context?.previousDailyTasks) {
        context.previousDailyTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousCalendarTasks) {
        context.previousCalendarTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: "Failed to add task", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      // Refetch to sync with server
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
    onSuccess: (data) => {
      toast({ title: "Task added successfully!" });
      window.dispatchEvent(new CustomEvent('task-added'));
      
      // Track task creation for learning
      if (data) {
        trackTaskCreation(
          data.scheduled_time,
          data.difficulty || 'medium',
          data.category
        );
      }
    },
  });

  const toggleTask = useMutation({
    mutationFn: async ({ 
      taskId, 
      completed, 
      xpReward, 
      forceUndo = false 
    }: { 
      taskId: string; 
      completed: boolean; 
      xpReward: number; 
      forceUndo?: boolean;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { data: existingTask, error: existingError } = await supabase
        .from('daily_tasks')
        .select('completed_at, task_text, habit_source_id, task_date, difficulty, scheduled_time, category')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingError) throw existingError;

      const wasAlreadyCompleted = existingTask?.completed_at !== null;
      const taskText = existingTask?.task_text || 'Task';
      const habitSourceId = existingTask?.habit_source_id;
      const taskDateValue = existingTask?.task_date || format(new Date(), 'yyyy-MM-dd');

      // Allow undo if forceUndo is true, otherwise block unchecking
      if (wasAlreadyCompleted && !completed && !forceUndo) {
        throw new Error('Cannot uncheck completed tasks');
      }

      // Handle undo case - revert task and deduct XP
      if (!completed && forceUndo) {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ completed: false, completed_at: null })
          .eq('id', taskId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Deduct the XP that was awarded
        if (xpReward > 0) {
          await awardCustomXP(-xpReward, 'task_undo', 'Quest undone', { task_id: taskId });
        }

        // If this was a habit-sourced task, remove the habit completion
        if (habitSourceId) {
          await supabase
            .from('habit_completions')
            .delete()
            .eq('user_id', user.id)
            .eq('habit_id', habitSourceId)
            .eq('date', taskDateValue);
        }

        return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted: true, isUndo: true, taskText, habitSourceId };
      }

      if (!completed) {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ completed: false, completed_at: null })
          .eq('id', taskId)
          .eq('user_id', user.id);

        if (error) throw error;

        // If this was a habit-sourced task, remove the habit completion
        if (habitSourceId) {
          await supabase
            .from('habit_completions')
            .delete()
            .eq('user_id', user.id)
            .eq('habit_id', habitSourceId)
            .eq('date', taskDateValue);
        }

        return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted, isUndo: false, taskText, habitSourceId };
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

      // If this is a habit-sourced task, sync with habit_completions
      if (habitSourceId) {
        const { error: habitError } = await supabase
          .from('habit_completions')
          .upsert({
            user_id: user.id,
            habit_id: habitSourceId,
            date: taskDateValue,
          }, { onConflict: 'user_id,habit_id,date' });

        if (habitError) {
          console.error('[Task Toggle] Failed to sync habit completion:', habitError);
        } else {
          console.log('[Task Toggle] Synced habit completion for habit:', habitSourceId);
        }
      }

      const taskDifficulty = existingTask?.difficulty || 'medium';
      const taskScheduledTime = existingTask?.scheduled_time || null;
      const taskCategory = existingTask?.category || null;

      return { 
        taskId, 
        completed: true, 
        xpAwarded: totalXP, 
        bonusXP, 
        toastReason, 
        wasAlreadyCompleted, 
        isUndo: false, 
        taskText, 
        habitSourceId,
        taskDifficulty,
        taskScheduledTime,
        taskCategory,
      };
    },
    onSuccess: async ({ completed, xpAwarded, toastReason, wasAlreadyCompleted, isUndo, taskId, taskText, habitSourceId, taskDifficulty, taskScheduledTime, taskCategory }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });

      // Also invalidate habit-related queries if this was a habit-sourced task
      if (habitSourceId) {
        queryClient.invalidateQueries({ queryKey: ['habit-completions'] });
        queryClient.invalidateQueries({ queryKey: ['habits'] });
        queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
        queryClient.invalidateQueries({ queryKey: ['epics'] });
      }

      // Handle undo success
      if (isUndo) {
        toast({ 
          title: "Quest undone", 
          description: "XP has been adjusted",
        });
        return;
      }

      if (completed && !wasAlreadyCompleted) {
        if (xpAwarded > 0) {
          showXPToast(xpAwarded, toastReason || 'Task Complete!');
        }
        if (companion?.id) {
          updateBodyFromActivity(companion.id).catch(console.error);
        }
        window.dispatchEvent(new CustomEvent('mission-completed'));
        window.dispatchEvent(new CustomEvent('quest-completed'));

        // Track completion for scheduling learner
        const now = new Date();
        trackTaskCompletion({
          taskId,
          completedAt: now.toISOString(),
          difficulty: taskDifficulty || 'medium',
          scheduledTime: taskScheduledTime,
          actualCompletionHour: now.getHours(),
          dayOfWeek: now.getDay(),
          wasOnTime: taskScheduledTime 
            ? Math.abs(parseInt(taskScheduledTime.split(':')[0]) - now.getHours()) <= 1 
            : null,
          category: taskCategory || undefined,
        });

        // Show undo toast with 5-second window
        toast({
          title: "Quest completed! ✨",
          description: taskText.length > 40 ? taskText.substring(0, 40) + '...' : taskText,
          duration: 5000,
          action: createElement(
            ToastAction,
            {
              altText: "Undo completion",
              onClick: () => {
                toggleTask.mutate({ 
                  taskId, 
                  completed: false, 
                  xpReward: xpAwarded,
                  forceUndo: true 
                });
              }
            },
            "Undo"
          ) as unknown as ToastActionElement,
        });
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
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
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
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
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
        task_text?: string;
        difficulty?: string;
        scheduled_time?: string | null;
        estimated_duration?: number | null;
        recurrence_pattern?: string | null;
        recurrence_days?: number[];
        reminder_enabled?: boolean;
        reminder_minutes_before?: number;
        category?: string | null;
      }
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Build update object with only provided fields
      const updateData: Record<string, unknown> = {};
      
      if (updates.task_text !== undefined) {
        updateData.task_text = updates.task_text;
      }
      if (updates.difficulty !== undefined) {
        updateData.difficulty = updates.difficulty;
      }
      if (updates.scheduled_time !== undefined) {
        updateData.scheduled_time = updates.scheduled_time;
      }
      if (updates.estimated_duration !== undefined) {
        updateData.estimated_duration = updates.estimated_duration;
      }
      if (updates.recurrence_pattern !== undefined) {
        updateData.recurrence_pattern = updates.recurrence_pattern;
      }
      if (updates.recurrence_days !== undefined) {
        updateData.recurrence_days = updates.recurrence_days;
      }
      if (updates.reminder_enabled !== undefined) {
        updateData.reminder_enabled = updates.reminder_enabled;
      }
      if (updates.reminder_minutes_before !== undefined) {
        updateData.reminder_minutes_before = updates.reminder_minutes_before;
      }
      
      // Handle category with validation
      if (updates.category !== undefined || updates.task_text !== undefined) {
        const validatedCategory = updates.category && validCategories.includes(updates.category as TaskCategory)
          ? updates.category
          : updates.task_text 
            ? detectCategory(updates.task_text, updates.category || undefined)
            : updates.category;
        updateData.category = validatedCategory;
      }

      if (Object.keys(updateData).length === 0) {
        return; // Nothing to update
      }

      const { error } = await supabase
        .from('daily_tasks')
        .update(updateData)
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

  const reorderTasks = useMutation({
    mutationFn: async (reorderedTasks: { id: string; sort_order: number }[]) => {
      if (!user?.id) throw new Error('User not authenticated');

      // Update all tasks with their new sort order
      for (const task of reorderedTasks) {
        const { error } = await supabase
          .from('daily_tasks')
          .update({ sort_order: task.sort_order })
          .eq('id', task.id)
          .eq('user_id', user.id);

        if (error) throw error;
      }
    },
    onMutate: async (reorderedTasks: { id: string; sort_order: number }[]) => {
      // Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['daily-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['calendar-tasks'] });

      // Snapshot previous values for rollback
      const previousDailyTasks = queryClient.getQueriesData({ queryKey: ['daily-tasks'] });
      const previousCalendarTasks = queryClient.getQueriesData({ queryKey: ['calendar-tasks'] });

      // Create a map of new sort orders
      const sortOrderMap = new Map(reorderedTasks.map(t => [t.id, t.sort_order]));

      // Optimistically update all daily-tasks queries
      queryClient.setQueriesData({ queryKey: ['daily-tasks'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return [...old]
          .map(task => ({
            ...task,
            sort_order: sortOrderMap.has(task.id) 
              ? sortOrderMap.get(task.id) 
              : task.sort_order
          }))
          .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      });

      // Optimistically update all calendar-tasks queries
      queryClient.setQueriesData({ queryKey: ['calendar-tasks'] }, (old: any) => {
        if (!old || !Array.isArray(old)) return old;
        return [...old]
          .map(task => ({
            ...task,
            sort_order: sortOrderMap.has(task.id) 
              ? sortOrderMap.get(task.id) 
              : task.sort_order
          }))
          .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
      });

      return { previousDailyTasks, previousCalendarTasks };
    },
    onError: (error: Error, _params, context) => {
      // Rollback to previous state on error
      if (context?.previousDailyTasks) {
        context.previousDailyTasks.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousCalendarTasks) {
        context.previousCalendarTasks.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: "Failed to reorder tasks", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      // Sync with server after mutation settles
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
  });

  // Move task to a different time section
  const moveTaskToSection = useMutation({
    mutationFn: async ({ taskId, targetSection }: {
      taskId: string;
      targetSection: 'morning' | 'afternoon' | 'evening' | 'unscheduled';
    }) => {
      if (!user?.id) throw new Error('User not authenticated');
      
      // Map section to scheduled_time
      const sectionTimeMap: Record<string, string | null> = {
        morning: '09:00',
        afternoon: '14:00',
        evening: '19:00',
        unscheduled: null,
      };

      const newTime = sectionTimeMap[targetSection];

      const { error } = await supabase
        .from('daily_tasks')
        .update({ 
          scheduled_time: newTime,
          sort_order: 0, // Place at top of new section
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks', taskDate] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to move task", description: error.message, variant: "destructive" });
    },
  });

  // Move task to a different date (cross-day drag)
  const moveTaskToDate = useMutation({
    mutationFn: async ({ taskId, targetDate }: {
      taskId: string;
      targetDate: string;
    }) => {
      if (!user?.id) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('daily_tasks')
        .update({ 
          task_date: targetDate,
          sort_order: 0, // Place at top of new day
        })
        .eq('id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
      toast({ title: `Task moved to ${format(new Date(variables.targetDate + 'T00:00:00'), 'MMM d')}` });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to move task", description: error.message, variant: "destructive" });
    },
  });

  return {
    addTask: addTask.mutate,
    toggleTask: toggleTask.mutate,
    deleteTask: deleteTask.mutate,
    setMainQuest: setMainQuest.mutate,
    updateTask: updateTask.mutateAsync,
    reorderTasks: reorderTasks.mutate,
    moveTaskToSection: moveTaskToSection.mutate,
    moveTaskToDate: moveTaskToDate.mutate,
    isAdding: addTask.isPending,
    isToggling: toggleTask.isPending,
    isDeleting: deleteTask.isPending,
    isUpdating: updateTask.isPending,
    isReordering: reorderTasks.isPending,
    isMoving: moveTaskToSection.isPending,
    isMovingDate: moveTaskToDate.isPending,
  };
};
