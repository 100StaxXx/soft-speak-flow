import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocument, getDocuments, updateDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { useEffect } from "react";
import { format } from "date-fns";
import { onSnapshot, query, where, collection } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

export const useCompanionMood = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const { data: companion } = useQuery({
    queryKey: ['companion-mood', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      
      const data = await getDocument<{
        current_mood: string;
        last_mood_update: string | null;
      }>('user_companion', user.uid);

      if (!data) return null;

      return {
        ...data,
        last_mood_update: timestampToISO(data.last_mood_update as any) || data.last_mood_update,
      };
    },
    enabled: !!user?.uid && !authLoading,
  });

  // Listen for check-in changes to update companion mood
  useEffect(() => {
    // CRITICAL: Wait for auth to fully load before subscribing
    if (authLoading) return;
    if (!user?.uid) return;

    let isSubscribed = true;

    const updateCompanionMood = async () => {
      if (!isSubscribed) return;
      
      try {
        // Get today's check-in
        const today = format(new Date(), 'yyyy-MM-dd');
        const checkIns = await getDocuments(
          'daily_check_ins',
          [
            ['user_id', '==', user.uid],
            ['check_in_date', '==', today],
          ]
        );

        const checkIn = checkIns[0];
        if (checkIn?.mood && isSubscribed) {
          // Map user mood to companion mood
          const moodMap: Record<string, string> = {
            'unmotivated': 'concerned',
            'overthinking': 'thoughtful',
            'stressed': 'supportive',
            'low_energy': 'calm',
            'content': 'happy',
            'disciplined': 'proud',
            'focused': 'energized',
            'inspired': 'excited'
          };

          const companionMood = moodMap[checkIn.mood] || 'neutral';

          await updateDocument('user_companion', user.uid, {
            current_mood: companionMood,
            last_mood_update: new Date().toISOString(),
          });

          if (isSubscribed) {
            queryClient.invalidateQueries({ queryKey: ['companion-mood'] });
            queryClient.invalidateQueries({ queryKey: ['companion'] });
          }
        }
      } catch (error) {
        console.warn('Companion mood update error:', error);
      }
    };

    // Listen for check-in updates using Firestore real-time listener
    const checkInsQuery = query(
      collection(firebaseDb, 'daily_check_ins'),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(checkInsQuery, () => {
      updateCompanionMood();
    }, (error: unknown) => {
      // Handle permission errors gracefully
      const errorCode = (error as { code?: string })?.code;
      if (errorCode === 'permission-denied') {
        console.warn('Companion mood: Permission denied, will retry when auth is ready');
      } else {
        console.warn('Companion mood subscription error:', error);
      }
    });

    return () => {
      isSubscribed = false;
      unsubscribe();
    };
  }, [authLoading, user?.uid, queryClient]);

  return companion;
};