import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionAttributes } from "@/hooks/useCompanionAttributes";
import { useXPToast } from "@/contexts/XPContext";
import { useXPRewards } from "@/hooks/useXPRewards";
import { useProfile } from "@/hooks/useProfile";
import { useRef } from "react";
import { getEffectiveQuestXP } from "@/config/xpRewards";
import { format } from "date-fns";

export const useDailyTasks = (selectedDate?: Date) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companion } = useCompanion();
  const { updateBodyFromActivity } = useCompanionAttributes();
  const { showXPToast } = useXPToast();
  const { awardCustomXP } = useXPRewards();
  const { profile } = useProfile();

  const toggleInProgress = useRef(false);
  const addInProgress = useRef(false);

  // NOTE: Using local device date. This works for most users but has edge cases:
  // - Users who travel across timezones may see incorrect "today"
  // - Users with wrong device time will get wrong date
  // - Daily reset happens at device midnight, not server midnight
  // Future enhancement: Use UTC or user's timezone preference from profile
  const taskDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['daily-tasks', user?.id, taskDate],
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('task_date', taskDate)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch daily tasks:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes - tasks change frequently but not every second
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
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
        if (!user?.id) {
          addInProgress.current = false;
          throw new Error('User not authenticated');
        }
        
        // Fetch fresh task count from database directly to avoid race conditions
        const { data: existingTasks, error: countError } = await supabase
          .from('daily_tasks')
          .select('id')
          .eq('user_id', user.id)
          .eq('task_date', customDate || taskDate);

        if (countError) {
          addInProgress.current = false; // Reset on error
          throw countError;
        }

        // Calculate quest position for XP multiplier (1-indexed)
        const questPosition = (existingTasks?.length || 0) + 1;
        
        // Calculate XP with diminishing returns based on position
        const xpReward = getEffectiveQuestXP(difficulty, questPosition);

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
            user_id: user.id,
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
            is_bonus: false
          });

        if (error) {
          addInProgress.current = false; // Reset on error
          if (error.message && (error.message.includes('MAX_TASKS_REACHED') || error.message.includes('Maximum quest limit'))) {
            throw new Error('Maximum quest limit reached for today');
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
      const { data: epicHabits, error: epicError } = await supabase
        .from('epic_habits')
        .select('epic_id, epics!inner(is_public, status)')
        .eq('epics.status', 'active')
        .eq('epics.is_public', true);

      if (epicError) {
        console.error('Failed to fetch epic habits:', epicError);
        return { bonusXP: 0, toastReason: 'Task Complete!' };
      }

      if (!epicHabits || epicHabits.length === 0) {
        return { bonusXP: 0, toastReason: 'Task Complete!' };
      }

      const { data: memberships, error: memberError } = await supabase
        .from('epic_members')
        .select('epic_id')
        .eq('user_id', user.id)
        .in('epic_id', epicHabits.map((eh: { epic_id: string }) => eh.epic_id));

      if (memberError) {
        console.error('Failed to fetch memberships:', memberError);
        return { bonusXP: 0, toastReason: 'Task Complete!' };
      }

      if (memberships && memberships.length > 0) {
        const rawBonus = Math.round(baseXP * 0.1);
        const bonusXP = baseXP > 0 ? Math.max(1, rawBonus) : 0;
        return { bonusXP, toastReason: `Task Complete! +${bonusXP} Guild Bonus (10%) 🎯` };
      }
    } catch (error) {
      console.error('Unexpected error computing guild bonus:', error);
    }

    return { bonusXP: 0, toastReason: 'Task Complete!' };
  };

  const toggleTask = useMutation({
    mutationFn: async ({ taskId, completed, xpReward }: { taskId: string; completed: boolean; xpReward: number }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      if (toggleInProgress.current) throw new Error('Please wait...');
      toggleInProgress.current = true;

      try {
        const { data: existingTask, error: existingError } = await supabase
          .from('daily_tasks')
          .select('completed_at')
          .eq('id', taskId)
          .eq('user_id', user.id)
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
            .eq('user_id', user.id);

          if (error) {
            throw error;
          }

          toggleInProgress.current = false;
          return { taskId, completed: false, xpAwarded: 0, wasAlreadyCompleted };
        }

        const { bonusXP, toastReason } = await getGuildBonusDetails(xpReward);
        const totalXP = xpReward + bonusXP;

        // Update task completion in database - ATOMIC: only update if not completed
        const { data: updateResult, error: updateError } = await supabase
          .from('daily_tasks')
          .update({ 
            completed: true, 
            completed_at: new Date().toISOString() 
          })
          .eq('id', taskId)
          .eq('user_id', user.id)
          .eq('completed', false) // Prevent double-completion
          .select();

        if (updateError) {
          toggleInProgress.current = false;
          throw updateError;
        }

        // CRITICAL: Verify the update actually happened (row was not already completed)
        if (!updateResult || updateResult.length === 0) {
          toggleInProgress.current = false;
          throw new Error('Task was already completed');
        }

        // Award XP only after verified database update - AWAIT to ensure no race
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

        // Update body attribute in background - null-safe
        if (companion?.id) {
          updateBodyFromActivity(companion.id).catch(err => {
            console.error('Body attribute update failed:', err);
            // Non-critical - don't block user flow
          });
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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      if (!taskId) {
        throw new Error('Invalid task ID');
      }
      
      const { error } = await supabase
        .from('daily_tasks')
        .delete()
        .eq('id', taskId)
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Failed to delete task:', error);
        throw error;
      }
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
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Use two-step update with safeguards for atomic main quest update
      // Verify task exists and belongs to user
      const { data: task, error: fetchError } = await supabase
          .from('daily_tasks')
          .select('id, user_id, task_date')
          .eq('id', taskId)
          .eq('user_id', user.id)
          .eq('task_date', taskDate)
          .maybeSingle();

      if (fetchError) throw fetchError;
      if (!task) throw new Error('Task not found or access denied');

      // First, unset any existing main quest for today
      await supabase
        .from('daily_tasks')
        .update({ is_main_quest: false })
        .eq('user_id', user.id)
        .eq('task_date', taskDate);

      // Then set this task as the main quest
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

  const completedCount = tasks.filter(t => t.completed).length;
  const totalCount = tasks.length;

  return {
    tasks,
    isLoading,
    addTask: addTask.mutate,
    toggleTask: toggleTask.mutate,
    deleteTask: deleteTask.mutate,
    setMainQuest: setMainQuest.mutate,
    isAdding: addTask.isPending,
    isToggling: toggleTask.isPending,
    completedCount,
    totalCount,
  };
};
