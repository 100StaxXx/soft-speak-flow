import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface AdaptivePushSettings {
  enabled: boolean;
  frequency: 'low' | 'medium' | 'high';
  categories: string[];
  primaryCategory: string | null;
  timeWindow: 'morning' | 'afternoon' | 'evening' | 'anytime';
  intensity: 'gentle' | 'moderate' | 'motivating';
  emotionalTriggers: string[];
  mentorId: string | null;
}

interface NotificationPreview {
  type: string;
  title: string;
  body: string;
  scheduledFor: string;
}

export const useAdaptiveNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's adaptive push settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['adaptive-push-settings', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('adaptive_push_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      
      return data ? {
        enabled: data.enabled ?? true,
        frequency: (data.frequency as 'low' | 'medium' | 'high') ?? 'medium',
        categories: data.categories ?? ['motivation', 'companion'],
        primaryCategory: data.primary_category,
        timeWindow: (data.time_window as 'morning' | 'afternoon' | 'evening' | 'anytime') ?? 'anytime',
        intensity: (data.intensity as 'gentle' | 'moderate' | 'motivating') ?? 'moderate',
        emotionalTriggers: data.emotional_triggers ?? [],
        mentorId: data.mentor_id,
      } : null;
    },
    enabled: !!user?.id,
  });

  // Fetch pending notifications for preview
  const { data: pendingNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['pending-notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('push_notification_queue')
        .select('notification_type, title, body, scheduled_for')
        .eq('user_id', user.id)
        .eq('delivered', false)
        .order('scheduled_for', { ascending: true })
        .limit(5);
      
      if (error) throw error;
      
      return (data || []).map(n => ({
        type: n.notification_type,
        title: n.title,
        body: n.body,
        scheduledFor: n.scheduled_for,
      })) as NotificationPreview[];
    },
    enabled: !!user?.id,
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<AdaptivePushSettings>) => {
      if (!user?.id) throw new Error('No user');
      
      const { error } = await supabase
        .from('adaptive_push_settings')
        .upsert({
          user_id: user.id,
          enabled: newSettings.enabled,
          frequency: newSettings.frequency,
          categories: newSettings.categories,
          primary_category: newSettings.primaryCategory,
          time_window: newSettings.timeWindow,
          intensity: newSettings.intensity,
          emotional_triggers: newSettings.emotionalTriggers,
          mentor_id: newSettings.mentorId,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adaptive-push-settings'] });
      toast.success('Notification preferences updated');
    },
    onError: (error) => {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update preferences');
    },
  });

  // Trigger immediate notification generation for user
  const triggerNotification = useMutation({
    mutationFn: async (type?: string) => {
      if (!user?.id) throw new Error('No user');
      
      const { data, error } = await supabase.functions.invoke('generate-smart-notifications', {
        body: { userId: user.id, forceType: type },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-notifications'] });
      toast.success('Notification scheduled');
    },
    onError: (error) => {
      console.error('Failed to trigger notification:', error);
      toast.error('Failed to schedule notification');
    },
  });

  // Clear all pending notifications
  const clearPending = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('No user');
      
      const { error } = await supabase
        .from('push_notification_queue')
        .delete()
        .eq('user_id', user.id)
        .eq('delivered', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-notifications'] });
      toast.success('Pending notifications cleared');
    },
  });

  return {
    settings,
    settingsLoading,
    pendingNotifications: pendingNotifications ?? [],
    notificationsLoading,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
    triggerNotification: triggerNotification.mutate,
    isTriggering: triggerNotification.isPending,
    clearPending: clearPending.mutate,
    isClearing: clearPending.isPending,
  };
};

// Hook for companion-specific notifications
export const useCompanionNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Send a "thinking of you" notification from companion
  const sendCompanionMessage = useMutation({
    mutationFn: async (messageType: 'encouragement' | 'checkin' | 'celebration') => {
      if (!user?.id) throw new Error('No user');
      
      // Get companion info
      const { data: companion } = await supabase
        .from('user_companion')
        .select('spirit_animal, current_mood')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!companion) throw new Error('No companion');
      
      // Queue a notification
      const titles: Record<string, string> = {
        encouragement: `${companion.spirit_animal} believes in you`,
        checkin: `${companion.spirit_animal} checking in`,
        celebration: `${companion.spirit_animal} celebrates with you!`,
      };
      
      const body = buildCompanionBody(
        companion.spirit_animal,
        messageType,
        companion.current_mood
      );

      const { error } = await supabase
        .from('push_notification_queue')
        .insert({
          user_id: user.id,
          notification_type: `companion_${messageType}`,
          title: titles[messageType],
          body,
          scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min from now
          context: { 
            companion_species: companion.spirit_animal,
            companion_mood: companion.current_mood,
            message_type: messageType,
          },
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-notifications'] });
    },
  });

  return {
    sendCompanionMessage: sendCompanionMessage.mutate,
    isSending: sendCompanionMessage.isPending,
  };
};

const buildCompanionBody = (
  species: string,
  messageType: 'encouragement' | 'checkin' | 'celebration',
  mood: string | null
) => {
  const moodText = mood ? ` They're feeling ${mood}.` : '';
  switch (messageType) {
    case 'encouragement':
      return `${species} is cheering you on.${moodText}`;
    case 'checkin':
      return `${species} is checking in.${moodText}`;
    case 'celebration':
      return `${species} is celebrating your progress!`;
    default:
      return `${species} is thinking of you.${moodText}`;
  }
};
