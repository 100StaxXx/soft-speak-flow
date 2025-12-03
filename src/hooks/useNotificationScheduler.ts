import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    if (!user?.id) return;
    
    try {
      await supabase
        .from('user_companion')
        .update({ 
          last_activity_date: new Date().toISOString().split('T')[0],
          inactive_days: 0,
        })
        .eq('user_id', user.id);
    } catch (error) {
      logger.error('Failed to track activity:', error);
    }
  }, [user?.id]);

  // Trigger milestone celebration notification
  const celebrateMilestone = useCallback(async (
    milestoneType: 'streak_7' | 'streak_14' | 'streak_30' | 'evolution' | 'all_quests'
  ) => {
    if (!user?.id) return;
    
    try {
      // Get companion and mentor info for the celebration
      const [companionRes, profileRes] = await Promise.all([
        supabase
          .from('user_companion')
          .select('spirit_animal, current_stage')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('selected_mentor_id, current_habit_streak')
          .eq('id', user.id)
          .maybeSingle(),
      ]);

      const companion = companionRes.data;
      const profile = profileRes.data;

      if (!companion) return;

      // Get mentor name
      let mentorName = 'Your mentor';
      if (profile?.selected_mentor_id) {
        const { data: mentor } = await supabase
          .from('mentors')
          .select('name')
          .eq('id', profile.selected_mentor_id)
          .maybeSingle();
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
      await supabase
        .from('push_notification_queue')
        .insert({
          user_id: user.id,
          notification_type: 'duo_milestone',
          title: message.title,
          body: message.body,
          scheduled_for: new Date(Date.now() + 60 * 1000).toISOString(), // 1 minute from now
          context: {
            milestone_type: milestoneType,
            companion_species: companion.spirit_animal,
            companion_stage: companion.current_stage,
          },
        });

      logger.log(`Queued ${milestoneType} celebration notification`);
    } catch (error) {
      logger.error('Failed to queue milestone notification:', error);
    }
  }, [user?.id]);

  // Trigger mood follow-up scheduling after check-in
  const schedulePostCheckInFollowUp = useCallback(async (mood: string) => {
    if (!user?.id) return;
    
    const concerningMoods = ['anxious', 'sad', 'stressed', 'overwhelmed', 'tired', 'frustrated'];
    if (!concerningMoods.includes(mood.toLowerCase())) return;

    try {
      // Schedule follow-up for 4-6 hours later
      const hoursLater = 4 + Math.random() * 2;
      const scheduledFor = new Date(Date.now() + hoursLater * 60 * 60 * 1000);

      const { data: companion } = await supabase
        .from('user_companion')
        .select('spirit_animal')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!companion) return;

      await supabase
        .from('push_notification_queue')
        .insert({
          user_id: user.id,
          notification_type: 'mood_followup',
          title: `${companion.spirit_animal} is thinking of you`,
          body: '', // Will be generated with AI
          scheduled_for: scheduledFor.toISOString(),
          context: {
            original_mood: mood,
            companion_species: companion.spirit_animal,
          },
        });

      logger.log(`Scheduled mood follow-up for ${hoursLater.toFixed(1)} hours later`);
    } catch (error) {
      logger.error('Failed to schedule mood follow-up:', error);
    }
  }, [user?.id]);

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
