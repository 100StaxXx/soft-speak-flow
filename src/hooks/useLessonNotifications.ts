import { useEffect } from 'react';
import { toast } from 'sonner';
import { onSnapshot, query, collection, orderBy, limit } from 'firebase/firestore';
import { firebaseDb } from '@/lib/firebase';

export function useLessonNotifications() {
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to new lessons
    const lessonsQuery = query(
      collection(firebaseDb, 'lessons'),
      orderBy('created_at', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(lessonsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const lesson = change.doc.data();
          
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
      });
    }, (error) => {
      console.warn('Lesson notifications subscription error:', error);
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
