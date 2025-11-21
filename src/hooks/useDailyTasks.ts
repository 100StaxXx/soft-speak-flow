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
    mutationFn: async ({ taskText, difficulty, taskDate: customDate, isMainQuest }: { taskText: string; difficulty: 'easy' | 'medium' | 'hard'; taskDate?: string; isMainQuest?: boolean; }) => {
      // Re-check latest tasks to mitigate races
      await queryClient.invalidateQueries({ queryKey: ['daily-tasks', user?.id, customDate || taskDate] });
      const latest = queryClient.getQueryData(['daily-tasks', user?.id, customDate || taskDate]) as any[] || [];
      if (latest.length >= 3) {
        throw new Error('Maximum 3 tasks per day');
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
        });

      if (error) throw error;
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

      const { data: existingTask } = await supabase.from('daily_tasks').select('completed_at').eq('id', taskId).maybeSingle();
      const wasAlreadyCompleted = existingTask?.completed_at !== null;

      const { error } = await supabase.from('daily_tasks').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', taskId);
      if (error) throw error;
      return { taskId, completed, xpReward, wasAlreadyCompleted };
    },
    onSuccess: async ({ completed, xpReward, wasAlreadyCompleted }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      if (completed && !wasAlreadyCompleted) {
        console.log('[useDailyTasks] Quest completed, awarding XP:', xpReward);
        await awardCustomXP(xpReward, 'task_complete', 'Task Complete!');
        if (companion) await updateBodyFromActivity(companion.id);
        window.dispatchEvent(new CustomEvent('mission-completed'));
      }
      toggleInProgress.current = false;
    },
    onError: () => { toggleInProgress.current = false; },
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
  const canAddMore = tasks.length < 3;

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
