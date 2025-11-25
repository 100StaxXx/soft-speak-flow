import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { useXPRewards } from "./useXPRewards";
import { useAchievements } from "./useAchievements";
import { playMissionComplete } from "@/utils/soundEffects";

export const useDailyMissions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const { checkFirstTimeAchievements } = useAchievements();
  const today = new Date().toISOString().split('T')[0];

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ['daily-missions', today, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
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
          toast({
            title: "Unable to generate missions",
            description: generationError.message || 'Unable to generate missions right now.',
            variant: "destructive",
          });
          return [];
        }
        
        return generated?.missions || [];
      }

      return existing;
    },
    enabled: !!user,
  });

  const completeMission = useMutation({
    mutationFn: async (missionId: string) => {
      const mission = missions.find(m => m.id === missionId);
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
        .eq('completed', false) // Only update if not already completed
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Mission already completed");
      
      // Award XP with display reason
      await awardCustomXP(mission.xp_reward, `mission_${mission.mission_type}`, "Mission Complete!");
      
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

  const completedCount = missions.filter(m => m.completed).length;
  const totalCount = missions.length;

  return {
    missions: missions || [],
    isLoading,
    completeMission: completeMission.mutate,
    isCompleting: completeMission.isPending,
    completedCount,
    totalCount,
    allComplete: completedCount === totalCount && totalCount > 0,
  };
};
