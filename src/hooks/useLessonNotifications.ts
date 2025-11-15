import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useLessonNotifications() {
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to new lessons
    const channel = supabase
      .channel('lesson-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lessons'
        },
        (payload) => {
          const lesson = payload.new;
          
          // Show toast notification
          toast.success('New Lesson Available!', {
            description: lesson.title,
            duration: 5000,
          });

          // Show browser notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('New Daily Lesson Available', {
              body: lesson.title,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
}
