import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDocument, getDocuments, setDocument, deleteDocument, timestampToISO } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { generateSmartNotifications } from '@/lib/firebase/functions';

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
    queryKey: ['adaptive-push-settings', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      
      const data = await getDocument('adaptive_push_settings', user.uid);
      
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
    enabled: !!user?.uid,
  });

  // Fetch pending notifications for preview
  const { data: pendingNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['pending-notifications', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      const data = await getDocuments(
        'push_notification_queue',
        [
          ['user_id', '==', user.uid],
          ['delivered', '==', false],
        ],
        'scheduled_for',
        'asc',
        5
      );
      
      return data.map(n => ({
        type: n.notification_type,
        title: n.title,
        body: n.body,
        scheduledFor: n.scheduled_for,
      })) as NotificationPreview[];
    },
    enabled: !!user?.uid,
  });

  // Update settings mutation
  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<AdaptivePushSettings>) => {
      if (!user?.uid) throw new Error('No user');
      
      await setDocument('adaptive_push_settings', user.uid, {
        id: user.uid,
        user_id: user.uid,
        enabled: newSettings.enabled,
        frequency: newSettings.frequency,
        categories: newSettings.categories,
        primary_category: newSettings.primaryCategory,
        time_window: newSettings.timeWindow,
        intensity: newSettings.intensity,
        emotional_triggers: newSettings.emotionalTriggers,
        mentor_id: newSettings.mentorId,
        updated_at: new Date().toISOString(),
      }, false);
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
      if (!user?.uid) throw new Error('No user');
      
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
      
      const data = await generateSmartNotifications({
        context: type || 'adaptive',
        timeOfDay,
      });
      
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
      if (!user?.uid) throw new Error('No user');
      
      const pending = await getDocuments(
        'push_notification_queue',
        [
          ['user_id', '==', user.uid],
          ['delivered', '==', false],
        ]
      );

      for (const notification of pending) {
        await deleteDocument('push_notification_queue', notification.id);
      }
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
      if (!user?.uid) throw new Error('No user');
      
      // Get companion info
      const companion = await getDocument<{ spirit_animal: string; current_mood: string | null }>(
        'user_companion',
        user.uid
      );
      
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

      const notificationId = `${user.uid}_companion_${messageType}_${Date.now()}`;
      await setDocument('push_notification_queue', notificationId, {
        id: notificationId,
        user_id: user.uid,
        notification_type: `companion_${messageType}`,
        title: titles[messageType],
        body,
        scheduled_for: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min from now
        delivered: false,
        context: { 
          companion_species: companion.spirit_animal,
          companion_mood: companion.current_mood,
          message_type: messageType,
        },
      }, false);
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
