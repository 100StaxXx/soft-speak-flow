import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { useXPRewards } from "./useXPRewards";
import { useAchievements } from "./useAchievements";
import { playMissionComplete } from "@/utils/soundEffects";
import { useState, useEffect, useMemo } from "react";

export const useDailyMissions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const { checkFirstTimeAchievements } = useAchievements();
  const [generationErrorMessage, setGenerationErrorMessage] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string | null>(null);
  
  // Get user's timezone from profile
  useEffect(() => {
    const fetchTimezone = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single();
      setUserTimezone(data?.timezone || null);
    };
    fetchTimezone();
  }, [user]);
  
  // Calculate today's date using user's timezone
  const today = useMemo(() => {
    const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
  }, [userTimezone]);

  const { data: missions, isLoading, error } = useQuery({
    queryKey: ['daily-missions', today, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      setGenerationErrorMessage(null);
      
      // Try to get existing missions
      const { data: existing, error: existingError } = await supabase
        .from('daily_missions')
        .select('*')
        .eq('user_id', user.id)
        .eq('mission_date', today);

      if (existingError) {
        throw existingError;
      }

      // If no missions exist, generate them server-side
      if (!existing || existing.length === 0) {
        const { data: generated, error: generationError } = await supabase.functions.invoke('generate-daily-missions', {
          body: { userId: user.id }
        });

        if (generationError) {
          console.error('Mission generation failed:', generationError);
          const message = generationError.message || 'Unable to generate missions right now.';
          setGenerationErrorMessage(message);
          throw new Error(message);
        }
        
        const newMissions = generated?.missions || [];
        if (newMissions.length === 0) {
          const message = 'No missions available right now. Please try again soon.';
          setGenerationErrorMessage(message);
          throw new Error(message);
        }
        return newMissions;
      }

      setGenerationErrorMessage(null);
      
      // Check for streak bonus unlock on load (for users with 7+ day streak)
      if (existing && existing.length > 0) {
        const hasBonusQuest = existing.some(m => m.is_bonus);
        if (!hasBonusQuest) {
          // Call the streak bonus check function
          supabase.rpc('check_streak_bonus_on_login', {
            p_user_id: user.id,
            p_date: today
          }).then(({ data, error }) => {
            if (error) {
              console.error('Error checking streak bonus:', error);
            } else if (data?.bonus_created) {
              // Refresh missions to show the bonus
              queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
              toast({
                title: "🎉 Bonus Quest Unlocked!",
                description: `Your ${data.streak}-day streak has unlocked a bonus quest!`,
              });
            }
          });
        }
      }
      
      return existing;
    },
    enabled: !!user,
  });

  // Handle errors with useEffect instead of deprecated onError
  useEffect(() => {
    if (error) {
      toast({
        title: generationErrorMessage ? "Mission generation failed" : "Unable to load daily missions",
        description: generationErrorMessage || error.message,
        variant: "destructive",
      });
    }
  }, [error, generationErrorMessage, toast]);

  const regenerateMissions = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      setGenerationErrorMessage(null);

      const { data: generated, error } = await supabase.functions.invoke('generate-daily-missions', {
        body: { userId: user.id, forceRegenerate: true }
      });

      if (error) {
        const message = error.message || 'Unable to regenerate missions right now.';
        setGenerationErrorMessage(message);
        throw new Error(message);
      }

      const newMissions = generated?.missions || [];
      if (newMissions.length === 0) {
        const message = 'No missions were generated. Please try again soon.';
        setGenerationErrorMessage(message);
        throw new Error(message);
      }

      return newMissions;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
      toast({
        title: "Daily missions refreshed",
        description: "Fresh challenges are ready for you!",
      });
      setGenerationErrorMessage(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Mission generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeMission = useMutation({
    mutationFn: async (missionId: string) => {
      const mission = missions?.find(m => m.id === missionId);
      if (!mission) throw new Error("Mission not found");

      // Check if already completed to prevent XP spam
      if (mission.completed) {
        throw new Error("Mission already completed");
      }

      const { data, error } = await supabase
        .from('daily_missions')
        .update({ 
          completed: true, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', missionId)
        .eq('user_id', user!.id)
        .eq('completed', false) // Only update if not already completed
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Mission already completed");
      
      // Award XP with display reason
      await awardCustomXP(
        mission.xp_reward, 
        `mission_${mission.mission_type}`, 
        "Mission Complete!",
        { mission_id: mission.id }
      );
      
      // Check for first mission achievement
      const { count } = await supabase
        .from('daily_missions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('completed', true);
      
      if (count === 1) {
        await checkFirstTimeAchievements('mission');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
      toast({ title: "Mission Complete!", description: "XP awarded!" });
      playMissionComplete();
    },
  });

  const completedCount = missions?.filter(m => m.completed).length || 0;
  const totalCount = missions?.length || 0;

  return {
    missions: missions || [],
    isLoading,
    completeMission: completeMission.mutate,
    isCompleting: completeMission.isPending,
    completedCount,
    totalCount,
    allComplete: completedCount === totalCount && totalCount > 0,
    regenerateMissions: regenerateMissions.mutateAsync,
    isRegenerating: regenerateMissions.isPending,
    generationErrorMessage,
  };
};
