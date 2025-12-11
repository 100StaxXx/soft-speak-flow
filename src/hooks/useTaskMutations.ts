import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, setDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
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
        if (!user?.uid) throw new Error('User not authenticated');
        
        const existingTasks = await getDocuments(
          'daily_tasks',
          [
            ['user_id', '==', user.uid],
            ['task_date', '==', params.taskDate || taskDate],
          ]
        );

        // Check max tasks limit (assuming 20 max tasks per day)
        if (existingTasks.length >= 20) {
          throw new Error('Maximum quest limit reached for today');
        }

        const questPosition = existingTasks.length + 1;
        const xpReward = getEffectiveQuestXP(params.difficulty, questPosition);
        const detectedCategory = detectCategory(params.taskText, params.category);

        const taskId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await setDocument('daily_tasks', taskId, {
          id: taskId,
          user_id: user.uid,
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
          is_bonus: false,
          completed: false,
          completed_at: null,
          reminder_sent: false,
        }, false);
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
      if (!user?.uid) throw new Error('User not authenticated');
      if (toggleInProgress.current) throw new Error('Please wait...');
      toggleInProgress.current = true;

      try {
        const existingTask = await getDocument<{ completed_at: string | null; user_id: string }>('daily_tasks', taskId);

        if (!existingTask) throw new Error('Task not found');
        if (existingTask.user_id !== user.uid) throw new Error('Unauthorized');

        const wasAlreadyCompleted = existingTask.completed_at !== null;

        if (wasAlreadyCompleted && !completed) {
          throw new Error('Cannot uncheck completed tasks');
        }

        if (!completed) {
          await updateDocument('daily_tasks', taskId, {
            completed: false,
            completed_at: null,
          });
          return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted };
        }

        // Check if already completed to prevent double XP
        if (wasAlreadyCompleted) {
          throw new Error('Task was already completed');
        }

        const { bonusXP, toastReason } = await calculateGuildBonus(user.uid, xpReward);
        const totalXP = xpReward + bonusXP;

        await updateDocument('daily_tasks', taskId, {
          completed: true,
          completed_at: new Date().toISOString(),
        });

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
        
        // Dispatch event for Astral Encounter trigger check
        window.dispatchEvent(new CustomEvent('quest-completed'));
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
      if (!user?.uid) throw new Error('User not authenticated');
      if (!taskId) throw new Error('Invalid task ID');
      
      const task = await getDocument<{ user_id: string }>('daily_tasks', taskId);
      if (!task) throw new Error('Task not found');
      if (task.user_id !== user.uid) throw new Error('Unauthorized');
      
      await deleteDocument('daily_tasks', taskId);
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
      if (!user?.uid) throw new Error('User not authenticated');

      const task = await getDocument<{ user_id: string; task_date: string }>('daily_tasks', taskId);
      if (!task) throw new Error('Task not found');
      if (task.user_id !== user.uid) throw new Error('Unauthorized');
      if (task.task_date !== taskDate) throw new Error('Task date mismatch');

      // Set all tasks for this date to not be main quest
      const tasksForDate = await getDocuments(
        'daily_tasks',
        [
          ['user_id', '==', user.uid],
          ['task_date', '==', taskDate],
        ]
      );

      for (const t of tasksForDate) {
        await updateDocument('daily_tasks', t.id, { is_main_quest: false });
      }

      // Set the selected task as main quest
      await updateDocument('daily_tasks', taskId, { is_main_quest: true });
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
      if (!user?.uid) throw new Error('User not authenticated');

      const task = await getDocument<{ user_id: string }>('daily_tasks', taskId);
      if (!task) throw new Error('Task not found');
      if (task.user_id !== user.uid) throw new Error('Unauthorized');

      await updateDocument('daily_tasks', taskId, {
        task_text: updates.task_text,
        difficulty: updates.difficulty,
        scheduled_time: updates.scheduled_time,
        estimated_duration: updates.estimated_duration,
        notes: updates.notes,
      });
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

