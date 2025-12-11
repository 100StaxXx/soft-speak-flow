import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocument, getDocuments, updateDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { useEffect } from "react";
import { format } from "date-fns";
import { onSnapshot, query, where, collection } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

export const useCompanionMood = () => {
  const { user } = useAuth();
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
    enabled: !!user?.uid,
  });

  // Listen for check-in changes to update companion mood
  useEffect(() => {
    if (!user?.uid) return;

    const updateCompanionMood = async () => {
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
      if (checkIn?.mood) {
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

        queryClient.invalidateQueries({ queryKey: ['companion-mood'] });
        queryClient.invalidateQueries({ queryKey: ['companion'] });
      }
    };

    // Listen for check-in updates using Firestore real-time listener
    const checkInsQuery = query(
      collection(firebaseDb, 'daily_check_ins'),
      where('user_id', '==', user.uid)
    );

    const unsubscribe = onSnapshot(checkInsQuery, () => {
      updateCompanionMood();
    }, (error) => {
      console.warn('Companion mood subscription error:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid, queryClient]);

  return companion;
};