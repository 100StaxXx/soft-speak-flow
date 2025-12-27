import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface InboxItem {
  id: string;
  raw_text: string;
  parsed_data: Record<string, unknown> | null;
  source: 'manual' | 'voice' | 'share' | 'widget';
  processed: boolean;
  processed_at: string | null;
  created_task_id: string | null;
  created_at: string;
}

export function useTaskInbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unprocessed inbox items
  const { data: inboxItems = [], isLoading, refetch } = useQuery({
    queryKey: ['task-inbox', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('task_inbox')
        .select('*')
        .eq('user_id', user.id)
        .eq('processed', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as InboxItem[];
    },
    enabled: !!user?.id,
  });

  // Add to inbox
  const addToInbox = useMutation({
    mutationFn: async ({ 
      text, 
      source = 'manual',
      parsedData = null 
    }: { 
      text: string; 
      source?: InboxItem['source'];
      parsedData?: Record<string, unknown> | null;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('task_inbox')
        .insert([{
          user_id: user.id,
          raw_text: text,
          source,
          parsed_data: parsedData as any,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-inbox'] });
      toast.success('Added to inbox');
    },
    onError: (error) => {
      console.error('Failed to add to inbox:', error);
      toast.error('Failed to add to inbox');
    },
  });

  // Mark as processed (when converted to a task)
  const markProcessed = useMutation({
    mutationFn: async ({ 
      inboxId, 
      taskId 
    }: { 
      inboxId: string; 
      taskId?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('task_inbox')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          created_task_id: taskId || null,
        })
        .eq('id', inboxId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-inbox'] });
    },
  });

  // Delete from inbox (without converting)
  const deleteFromInbox = useMutation({
    mutationFn: async (inboxId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('task_inbox')
        .delete()
        .eq('id', inboxId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-inbox'] });
      toast.success('Removed from inbox');
    },
    onError: (error) => {
      console.error('Failed to delete from inbox:', error);
      toast.error('Failed to remove from inbox');
    },
  });

  // Clear all processed items
  const clearProcessed = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('task_inbox')
        .delete()
        .eq('user_id', user.id)
        .eq('processed', true);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-inbox'] });
    },
  });

  const inboxCount = inboxItems.length;
  const hasInboxItems = inboxCount > 0;

  return {
    inboxItems,
    inboxCount,
    hasInboxItems,
    isLoading,
    refetch,
    addToInbox: addToInbox.mutate,
    markProcessed: markProcessed.mutate,
    deleteFromInbox: deleteFromInbox.mutate,
    clearProcessed: clearProcessed.mutate,
    isAdding: addToInbox.isPending,
  };
}
