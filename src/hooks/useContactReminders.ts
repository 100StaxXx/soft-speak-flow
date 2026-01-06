import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

export interface ContactReminder {
  id: string;
  contact_id: string;
  user_id: string;
  reminder_at: string;
  reason: string | null;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
}

interface CreateReminderInput {
  contactId: string;
  reminderAt: Date;
  reason?: string;
}

export function useContactReminders(contactId?: string) {
  const queryClient = useQueryClient();

  const remindersQuery = useQuery({
    queryKey: queryKeys.contactReminders.byContact(contactId ?? ''),
    queryFn: async () => {
      if (!contactId) return [];
      
      const { data, error } = await supabase
        .from('contact_reminders')
        .select('*')
        .eq('contact_id', contactId)
        .order('reminder_at', { ascending: true });

      if (error) throw error;
      return data as ContactReminder[];
    },
    enabled: !!contactId,
  });

  const upcomingRemindersQuery = useQuery({
    queryKey: queryKeys.contactReminders.upcoming(),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('contact_reminders')
        .select(`
          *,
          contacts:contact_id (
            id,
            name,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('sent', false)
        .gte('reminder_at', new Date().toISOString())
        .order('reminder_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  const createReminderMutation = useMutation({
    mutationFn: async ({ contactId, reminderAt, reason }: CreateReminderInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contact_reminders')
        .insert({
          contact_id: contactId,
          user_id: user.id,
          reminder_at: reminderAt.toISOString(),
          reason: reason || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.byContact(variables.contactId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.upcoming() });
      toast.success('Follow-up quest scheduled! 🗓️');
    },
    onError: (error) => {
      toast.error('Failed to schedule reminder');
      console.error('Create reminder error:', error);
    },
  });

  const deleteReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from('contact_reminders')
        .delete()
        .eq('id', reminderId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.byContact(contactId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.upcoming() });
      toast.success('Reminder cancelled');
    },
    onError: (error) => {
      toast.error('Failed to cancel reminder');
      console.error('Delete reminder error:', error);
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from('contact_reminders')
        .update({ sent: true, sent_at: new Date().toISOString() })
        .eq('id', reminderId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.byContact(contactId) });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.contactReminders.upcoming() });
      toast.success('Quest complete! Connection made 🎉');
    },
    onError: (error) => {
      toast.error('Failed to complete reminder');
      console.error('Mark complete error:', error);
    },
  });

  return {
    reminders: remindersQuery.data ?? [],
    upcomingReminders: upcomingRemindersQuery.data ?? [],
    isLoading: remindersQuery.isLoading,
    isUpcomingLoading: upcomingRemindersQuery.isLoading,
    createReminder: createReminderMutation.mutate,
    deleteReminder: deleteReminderMutation.mutate,
    markComplete: markCompleteMutation.mutate,
    isCreating: createReminderMutation.isPending,
    isDeleting: deleteReminderMutation.isPending,
  };
}
