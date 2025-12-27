import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  user_id: string;
  created_at: string;
}

export const useTaskDependencies = (taskId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get tasks that this task depends on (blockers)
  const { data: blockers = [], isLoading: loadingBlockers } = useQuery({
    queryKey: ['task-blockers', taskId],
    queryFn: async () => {
      if (!user?.id || !taskId) return [];
      
      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          id,
          depends_on_task_id,
          daily_tasks!task_dependencies_depends_on_task_id_fkey (
            id,
            task_text,
            completed
          )
        `)
        .eq('task_id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!taskId,
  });

  // Get tasks that depend on this task (dependents)
  const { data: dependents = [], isLoading: loadingDependents } = useQuery({
    queryKey: ['task-dependents', taskId],
    queryFn: async () => {
      if (!user?.id || !taskId) return [];
      
      const { data, error } = await supabase
        .from('task_dependencies')
        .select(`
          id,
          task_id,
          daily_tasks!task_dependencies_task_id_fkey (
            id,
            task_text,
            completed
          )
        `)
        .eq('depends_on_task_id', taskId)
        .eq('user_id', user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!taskId,
  });

  const addDependency = useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      if (!user?.id || !taskId) throw new Error('Missing required data');
      
      const { error } = await supabase
        .from('task_dependencies')
        .insert({
          task_id: taskId,
          depends_on_task_id: dependsOnTaskId,
          user_id: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers', taskId] });
      toast.success('Dependency added');
    },
    onError: () => {
      toast.error('Failed to add dependency');
    },
  });

  const removeDependency = useMutation({
    mutationFn: async (dependencyId: string) => {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('id', dependencyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-blockers', taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-dependents', taskId] });
      toast.success('Dependency removed');
    },
  });

  // Check if task is blocked (has incomplete blockers)
  const isBlocked = blockers.some((b: any) => !b.daily_tasks?.completed);
  const incompleteBlockers = blockers.filter((b: any) => !b.daily_tasks?.completed);

  return {
    blockers,
    dependents,
    isLoading: loadingBlockers || loadingDependents,
    addDependency: addDependency.mutate,
    removeDependency: removeDependency.mutate,
    isBlocked,
    incompleteBlockers,
  };
};
