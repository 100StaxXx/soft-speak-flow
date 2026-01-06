import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/queryKeys';

export type InteractionType = 'call' | 'email' | 'meeting' | 'message' | 'note';

export interface ContactInteraction {
  id: string;
  contact_id: string;
  user_id: string;
  interaction_type: InteractionType;
  summary: string;
  notes: string | null;
  occurred_at: string;
  created_at: string;
}

export interface InteractionInsert {
  contact_id: string;
  interaction_type: InteractionType;
  summary: string;
  notes?: string | null;
  occurred_at?: string;
}

export function useContactInteractions(contactId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const interactionsQuery = useQuery({
    queryKey: queryKeys.contactInteractions.byContact(contactId ?? ''),
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('contact_interactions')
        .select('*')
        .eq('contact_id', contactId)
        .order('occurred_at', { ascending: false });

      if (error) throw error;
      return data as ContactInteraction[];
    },
    enabled: !!user && !!contactId,
  });

  const createInteraction = useMutation({
    mutationFn: async (interaction: InteractionInsert) => {
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contact_interactions')
        .insert({
          ...interaction,
          user_id: user.id,
          occurred_at: interaction.occurred_at ?? new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactInteractions.byContact(variables.contact_id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Interaction logged');
    },
    onError: (error) => {
      toast.error('Failed to log interaction');
      console.error('Create interaction error:', error);
    },
  });

  const deleteInteraction = useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { error } = await supabase
        .from('contact_interactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return contactId;
    },
    onSuccess: (contactId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactInteractions.byContact(contactId) });
      toast.success('Interaction deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete interaction');
      console.error('Delete interaction error:', error);
    },
  });

  return {
    interactions: interactionsQuery.data ?? [],
    isLoading: interactionsQuery.isLoading,
    createInteraction,
    deleteInteraction,
  };
}
