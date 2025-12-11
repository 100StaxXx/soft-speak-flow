import { useEffect, useCallback } from 'react';
import { getDocument, updateDocument, setDocument } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';

/**
 * Hook to trigger notification generation based on user activity events.
 * Call the appropriate trigger when specific events happen in the app.
 */
export const useNotificationScheduler = () => {
  const { user } = useAuth();

  // Track that user was active (resets neglect timer)
  const trackActivity = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      await updateDocument('user_companion', user.uid, {
        last_activity_date: new Date().toISOString().split('T')[0],
        inactive_days: 0,
      });
    } catch (error) {
      logger.error('Failed to track activity:', error);
    }
  }, [user?.uid]);

  // Trigger milestone celebration notification
  const celebrateMilestone = useCallback(async (
    milestoneType: 'streak_7' | 'streak_14' | 'streak_30' | 'evolution' | 'all_quests'
  ) => {
    if (!user?.uid) return;
    
    try {
      // Get companion and mentor info for the celebration
      const [companion, profile] = await Promise.all([
        getDocument<{ spirit_animal: string; current_stage: number }>('user_companion', user.uid),
        getDocument<{ selected_mentor_id: string | null; current_habit_streak: number }>('profiles', user.uid),
      ]);

      if (!companion) return;

      // Get mentor name
      let mentorName = 'Your mentor';
      if (profile?.selected_mentor_id) {
        const mentor = await getDocument<{ name: string }>('mentors', profile.selected_mentor_id);
        if (mentor) mentorName = mentor.name;
      }

      // Generate duo milestone notification
      const milestoneMessages: Record<string, { title: string; body: string }> = {
        'streak_7': {
          title: `${mentorName} & ${companion.spirit_animal} celebrate you`,
          body: `"Seven days. That's discipline taking root." — ${mentorName}\n\n*${companion.spirit_animal} stands proudly beside you*`,
        },
        'streak_14': {
          title: `${mentorName} & ${companion.spirit_animal} celebrate you`,
          body: `"Two weeks strong. You're becoming unstoppable." — ${mentorName}\n\n*${companion.spirit_animal} nuzzles against you with pride*`,
        },
        'streak_30': {
          title: `${mentorName} & ${companion.spirit_animal} celebrate you`,
          body: `"Thirty days. This is who you are now." — ${mentorName}\n\n*${companion.spirit_animal} howls in celebration*`,
        },
        'evolution': {
          title: `${companion.spirit_animal} evolved!`,
          body: `"Your dedication made this possible." — ${mentorName}\n\n*${companion.spirit_animal} reveals their new form, radiant with power*`,
        },
        'all_quests': {
          title: `All quests complete!`,
          body: `"Every quest done. That's how legends are built." — ${mentorName}\n\n*${companion.spirit_animal} does a victory lap*`,
        },
      };

      const message = milestoneMessages[milestoneType];
      if (!message) return;

      // Queue the notification
      const notificationId = `${user.uid}_${milestoneType}_${Date.now()}`;
      await setDocument('push_notification_queue', notificationId, {
        id: notificationId,
        user_id: user.uid,
        notification_type: 'duo_milestone',
        title: message.title,
        body: message.body,
        scheduled_for: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute from now
        context: {
          milestone_type: milestoneType,
          companion_species: companion.spirit_animal,
          companion_stage: companion.current_stage,
        },
      }, false);

      logger.log(`Queued ${milestoneType} celebration notification`);
    } catch (error) {
      logger.error('Failed to queue milestone notification:', error);
    }
  }, [user?.uid]);

  // Trigger mood follow-up scheduling after check-in
  const schedulePostCheckInFollowUp = useCallback(async (mood: string) => {
    if (!user?.uid) return;
    
    const concerningMoods = ['anxious', 'sad', 'stressed', 'overwhelmed', 'tired', 'frustrated'];
    if (!concerningMoods.includes(mood.toLowerCase())) return;

    try {
      // Schedule follow-up for 4-6 hours later
      const hoursLater = 4 + Math.random() * 2;
      const scheduledFor = new Date(Date.now() + hoursLater * 60 * 60 * 1000);

      const companion = await getDocument<{ spirit_animal: string }>('user_companion', user.uid);

      if (!companion) return;

      const notificationId = `${user.uid}_mood_followup_${Date.now()}`;
      await setDocument('push_notification_queue', notificationId, {
        id: notificationId,
        user_id: user.uid,
        notification_type: 'mood_followup',
        title: `${companion.spirit_animal} is thinking of you`,
        body: '', // Will be generated with AI
        scheduled_for: scheduledFor.toISOString(),
        context: {
          original_mood: mood,
          companion_species: companion.spirit_animal,
        },
      }, false);

      logger.log(`Scheduled mood follow-up for ${hoursLater.toFixed(1)} hours later`);
    } catch (error) {
      logger.error('Failed to schedule mood follow-up:', error);
    }
  }, [user?.uid]);

  return {
    trackActivity,
    celebrateMilestone,
    schedulePostCheckInFollowUp,
  };
};

/**
 * Component to auto-track activity on mount.
 * Include this in main app layout to track active sessions.
 */
export const useActivityTracker = () => {
  const { trackActivity } = useNotificationScheduler();

  useEffect(() => {
    // Track activity on app open
    trackActivity();

    // Track activity periodically while app is active
    const interval = setInterval(trackActivity, 30 * 60 * 1000); // Every 30 minutes

    return () => clearInterval(interval);
  }, [trackActivity]);
};
