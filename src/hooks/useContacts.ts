import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/queryKeys';
import { toast } from 'sonner';

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  notes: string | null;
  avatar_url: string | null;
  is_favorite: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export type ContactInsert = Omit<Contact, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type ContactUpdate = Partial<ContactInsert>;

export function useContacts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const contactsQuery = useQuery({
    queryKey: queryKeys.contacts.byUser(user?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user!.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Contact[];
    },
    enabled: !!user,
  });

  const createContact = useMutation({
    mutationFn: async (contact: ContactInsert) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({ ...contact, user_id: user!.id })
        .select()
        .single();

      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Contact created');
    },
    onError: (error) => {
      toast.error('Failed to create contact');
      console.error(error);
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...updates }: ContactUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Contact updated');
    },
    onError: (error) => {
      toast.error('Failed to update contact');
      console.error(error);
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
      toast.success('Contact deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete contact');
      console.error(error);
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ is_favorite })
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async ({ id, is_favorite }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.contacts.byUser(user?.id ?? '') });
      const previous = queryClient.getQueryData<Contact[]>(queryKeys.contacts.byUser(user?.id ?? ''));
      
      queryClient.setQueryData<Contact[]>(
        queryKeys.contacts.byUser(user?.id ?? ''),
        (old) => old?.map((c) => (c.id === id ? { ...c, is_favorite } : c))
      );
      
      return { previous };
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(queryKeys.contacts.byUser(user?.id ?? ''), context?.previous);
      toast.error('Failed to update favorite');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all });
    },
  });

  return {
    contacts: contactsQuery.data ?? [],
    isLoading: contactsQuery.isLoading,
    createContact,
    updateContact,
    deleteContact,
    toggleFavorite,
  };
}
