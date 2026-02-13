import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Subtask {
  id: string;
  task_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export const useSubtasks = (parentTaskId: string | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: subtasks = [], isLoading } = useQuery({
    queryKey: ['subtasks', parentTaskId],
    queryFn: async () => {
      if (!user?.id || !parentTaskId) return [];
      
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', parentTaskId)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Subtask[];
    },
    enabled: !!user?.id && !!parentTaskId,
  });

  const addSubtask = useMutation({
    mutationFn: async (title: string) => {
      if (!user?.id || !parentTaskId) throw new Error('Missing required data');
      
      const maxOrder = subtasks.length > 0 
        ? Math.max(...subtasks.map(s => s.sort_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from('subtasks')
        .insert({
          task_id: parentTaskId,
          user_id: user.id,
          title,
          sort_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
    onError: () => {
      toast.error('Failed to add subtask');
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) => {
      const { error } = await supabase
        .from('subtasks')
        .update({ 
          completed, 
          completed_at: completed ? new Date().toISOString() : null 
        })
        .eq('id', subtaskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });

  const deleteSubtask = useMutation({
    mutationFn: async (subtaskId: string) => {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
  });

  const updateSubtask = useMutation({
    mutationFn: async ({ subtaskId, title }: { subtaskId: string; title: string }) => {
      const { error } = await supabase
        .from('subtasks')
        .update({ title })
        .eq('id', subtaskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
    },
    onError: () => {
      toast.error('Failed to update subtask');
    },
  });

  const bulkAddSubtasks = useMutation({
    mutationFn: async (titles: string[]) => {
      if (!user?.id || !parentTaskId) throw new Error('Missing required data');
      
      const maxOrder = subtasks.length > 0 
        ? Math.max(...subtasks.map(s => s.sort_order)) + 1 
        : 0;

      const subtasksToInsert = titles.map((title, index) => ({
        task_id: parentTaskId,
        user_id: user.id,
        title,
        sort_order: maxOrder + index,
      }));

      const { error } = await supabase.from('subtasks').insert(subtasksToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', parentTaskId] });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      toast.success('Subtasks added!');
    },
    onError: () => {
      toast.error('Failed to add subtasks');
    },
  });

  const completedCount = subtasks.filter(s => s.completed).length;
  const totalCount = subtasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    subtasks,
    isLoading,
    addSubtask: addSubtask.mutate,
    toggleSubtask: toggleSubtask.mutate,
    deleteSubtask: deleteSubtask.mutate,
    updateSubtask: updateSubtask.mutate,
    bulkAddSubtasks: bulkAddSubtasks.mutateAsync,
    isAdding: addSubtask.isPending,
    isBulkAdding: bulkAddSubtasks.isPending,
    completedCount,
    totalCount,
    progressPercent,
  };
};
