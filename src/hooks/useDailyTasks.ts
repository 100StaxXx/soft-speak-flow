import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useXPToast } from "@/contexts/XPContext";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useRef } from "react";
import { getQuestXP } from "@/config/xpRewards";
import { format } from "date-fns";

export const useDailyTasks = (selectedDate?: Date) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companion } = useCompanion();
  const { updateBodyFromActivity } = useCompanionAttributes();
  const { showXPToast } = useXPToast();
  const { awardCustomXP } = useXPRewards();

  const toggleInProgress = useRef(false);
  const addInProgress = useRef(false);

  const taskDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

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

  type TaskCategory = 'mind' | 'body' | 'soul';
  const validCategories: TaskCategory[] = ['mind', 'body', 'soul'];

  const addTask = useMutation({
    mutationFn: async ({ 
      taskText, 
      difficulty, 
      taskDate: customDate, 
      isMainQuest,
      scheduledTime,
      estimatedDuration,
      recurrencePattern,
      recurrenceDays,
      reminderEnabled,
      reminderMinutesBefore,
      category
    }: { 
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
          .select('id, is_bonus')
          .eq('user_id', user!.id)
          .eq('task_date', customDate || taskDate);

        if (countError) {
          addInProgress.current = false; // Reset on error
          throw countError;
        }

        // Count regular tasks (non-bonus)
        const regularTaskCount = existingTasks?.filter(t => !t.is_bonus).length || 0;
        const bonusTaskCount = existingTasks?.filter(t => t.is_bonus).length || 0;

        // Check if user can add a bonus quest
        const allRegularCompleted = regularTaskCount === 4 && tasks?.filter(t => !t.is_bonus && t.completed).length === 4;
        const hasStreak = (profile?.current_habit_streak || 0) >= 7;
        const bonusUnlocked = allRegularCompleted || hasStreak;

        // Determine if this will be a bonus task
        const isBonus = regularTaskCount >= 4 && bonusUnlocked && bonusTaskCount === 0;

        // Check limits
        if (regularTaskCount >= 4 && !isBonus) {
          addInProgress.current = false; // Reset on error
          throw new Error('Maximum 4 regular tasks per day. Complete all 4 or maintain a 7+ day streak to unlock bonus quest.');
        }

        if (isBonus && bonusTaskCount >= 1) {
          addInProgress.current = false;
          throw new Error('You can only have 1 bonus quest per day');
        }

        const xpReward = getQuestXP(difficulty);

        // Auto-detect category based on keywords while respecting DB constraints
        let detectedCategory: TaskCategory | null = category && validCategories.includes(category as TaskCategory)
          ? (category as TaskCategory)
          : null;
        const text = taskText.toLowerCase();
        
        const categoryKeywords: Record<TaskCategory, string[]> = {
          body: ['gym', 'run', 'exercise', 'workout', 'walk', 'yoga', 'stretch', 'fitness', 'sports'],
          soul: ['meditate', 'journal', 'breathe', 'gratitude', 'reflect', 'pray', 'mindful', 'relax', 'rest'],
          mind: ['read', 'learn', 'study', 'plan', 'organize', 'think', 'write', 'research', 'course']
        };

        for (const [cat, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some(keyword => text.includes(keyword))) {
            detectedCategory = cat as TaskCategory;
            break;
          }
        }

        const { error } = await supabase
          .from('daily_tasks')
          .insert({
            user_id: user!.id,
            task_text: taskText,
            difficulty: difficulty,
            xp_reward: xpReward,
            task_date: customDate || taskDate,
            is_main_quest: isMainQuest ?? false,
            scheduled_time: scheduledTime || null,
            estimated_duration: estimatedDuration || null,
            recurrence_pattern: recurrencePattern || null,
            recurrence_days: recurrenceDays || null,
            is_recurring: !!recurrencePattern,
            reminder_enabled: reminderEnabled ?? false,
            reminder_minutes_before: reminderMinutesBefore ?? 15,
            category: detectedCategory,
            is_bonus: isBonus
          });

        if (error) {
          addInProgress.current = false; // Reset on error
          if (error.message && error.message.includes('MAX_TASKS_REACHED')) {
            throw new Error('Maximum 4 tasks per day');
          }
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

  const getGuildBonusDetails = async (baseXP: number) => {
    if (!user?.id) {
      return { bonusXP: 0, toastReason: 'Task Complete!' };
    }

    try {
      const { data: epicHabits } = await supabase
        .from('epic_habits')
        .select('epic_id, epics!inner(is_public, status)')
        .eq('epics.status', 'active')
        .eq('epics.is_public', true);

      if (!epicHabits || epicHabits.length === 0) {
        return { bonusXP: 0, toastReason: 'Task Complete!' };
      }

      const { data: memberships } = await supabase
        .from('epic_members')
        .select('epic_id')
        .eq('user_id', user.id)
        .in('epic_id', epicHabits.map((eh: any) => eh.epic_id));

      if (memberships && memberships.length > 0) {
        const rawBonus = Math.round(baseXP * 0.1);
        const bonusXP = baseXP > 0 ? Math.max(1, rawBonus) : 0;
        return { bonusXP, toastReason: `Task Complete! +${bonusXP} Guild Bonus (10%) 🎯` };
      }
    } catch (error) {
      console.error('Failed to compute guild bonus:', error);
    }

    return { bonusXP: 0, toastReason: 'Task Complete!' };
  };

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed, xpReward }: { taskId: string; completed: boolean; xpReward: number }) => {
      if (toggleInProgress.current) throw new Error('Please wait...');
      toggleInProgress.current = true;

      try {
        const { data: existingTask, error: existingError } = await supabase
          .from('daily_tasks')
          .select('completed_at')
          .eq('id', taskId)
          .eq('user_id', user!.id)
          .maybeSingle();

        if (existingError) {
          throw existingError;
        }

        const wasAlreadyCompleted = existingTask?.completed_at !== null;

        // Prevent unchecking completed tasks to avoid XP farming
        if (wasAlreadyCompleted && !completed) {
          throw new Error('Cannot uncheck completed tasks');
        }

        if (!completed) {
          const { error } = await supabase
            .from('daily_tasks')
            .update({ completed: false, completed_at: null })
            .eq('id', taskId)
            .eq('user_id', user!.id);

          if (error) {
            throw error;
          }

          toggleInProgress.current = false;
          return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted };
        }

        const { bonusXP, toastReason } = await getGuildBonusDetails(xpReward);
        const totalXP = xpReward + bonusXP;

        // Update task completion in database
        const { error: updateError } = await supabase
          .from('daily_tasks')
          .update({ 
            completed: true, 
            completed_at: new Date().toISOString() 
          })
          .eq('id', taskId)
          .eq('user_id', user!.id)
          .eq('completed', false); // Prevent double-completion

        if (updateError) {
          toggleInProgress.current = false;
          throw updateError;
        }

        // Award XP using existing useXPRewards hook
        await awardCustomXP(totalXP, 'task_complete', toastReason, { task_id: taskId });

        toggleInProgress.current = false;
        return { taskId, completed: true, xpAwarded: totalXP, bonusXP, toastReason, wasAlreadyCompleted };
      } catch (error) {
        toggleInProgress.current = false;
        throw error;
      }
    },
    onSuccess: async ({ completed, xpAwarded, toastReason, wasAlreadyCompleted }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      if (completed && !wasAlreadyCompleted) {
        if (xpAwarded > 0) {
          showXPToast(xpAwarded, toastReason || 'Task Complete!');
        }

        if (companion) {
          await updateBodyFromActivity(companion.id);
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
        const { error } = await supabase
          .from('daily_tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', user!.id);
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
      // First, unset any existing main quest for today
      await supabase
        .from('daily_tasks')
        .update({ is_main_quest: false })
        .eq('user_id', user!.id)
        .eq('task_date', taskDate);

      // Then set this task as the main quest
      const { error } = await supabase
        .from('daily_tasks')
        .update({ is_main_quest: true })
        .eq('id', taskId)
        .eq('user_id', user!.id);

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
