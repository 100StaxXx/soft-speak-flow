import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect } from "react";
import { format } from "date-fns";

export const useCompanionMood = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: companion } = useQuery({
    queryKey: ['companion-mood', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companion')
        .select('current_mood, last_mood_update')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch companion mood:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
  });

  // Listen for check-in changes to update companion mood
  useEffect(() => {
    if (!user?.id) return;

    const updateCompanionMood = async () => {
      // Get today's check-in
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: checkIn } = await supabase
        .from('daily_check_ins')
        .select('mood')
        .eq('user_id', user.id)
        .eq('check_in_date', today)
        .maybeSingle();

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

        await supabase
          .from('user_companion')
          .update({ 
            current_mood: companionMood,
            last_mood_update: new Date().toISOString()
          })
          .eq('user_id', user.id);

        queryClient.invalidateQueries({ queryKey: ['companion-mood'] });
        queryClient.invalidateQueries({ queryKey: ['user-companion'] });
      }
    };

    // Listen for check-in updates
    const channel = supabase
      .channel('companion-mood-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_check_ins',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          updateCompanionMood();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return companion;
};