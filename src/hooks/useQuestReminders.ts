import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { format, isToday, parseISO, differenceInMinutes } from 'date-fns';

export const useQuestReminders = () => {
  const { user } = useAuth();

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const { data: upcomingQuests } = useQuery({
    queryKey: ['upcoming-quest-reminders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('reminder_enabled', true)
        .eq('reminder_sent', false)
        .eq('completed', false)
        .not('scheduled_time', 'is', null)
        .gte('task_date', format(new Date(), 'yyyy-MM-dd'));

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    if (!upcomingQuests || upcomingQuests.length === 0) return;

    const now = new Date();

    upcomingQuests.forEach(async (quest) => {
      if (!quest.scheduled_time) return;

      const questDateTime = parseISO(`${quest.task_date}T${quest.scheduled_time}`);
      const minutesUntil = differenceInMinutes(questDateTime, now);
      const reminderTime = quest.reminder_minutes_before || 15;

      // Check if it's time to send the reminder
      if (minutesUntil <= reminderTime && minutesUntil > 0 && isToday(questDateTime)) {
        // Send notification
        if (Notification.permission === 'granted') {
          new Notification('Quest Reminder! 🎮', {
            body: `${quest.task_text} starts in ${minutesUntil} minutes`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: quest.id,
            requireInteraction: true,
          });

          // Mark reminder as sent
          await supabase
            .from('daily_tasks')
            .update({ reminder_sent: true })
            .eq('id', quest.id);
        }
      }
    });
  }, [upcomingQuests]);

  return { upcomingQuests };
};
