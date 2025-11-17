import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { useXPRewards } from "./useXPRewards";
import { playMissionComplete } from "@/utils/soundEffects";

const MISSION_TEMPLATES = [
  { type: "check_in", text: "Complete your daily check-in", xp: 5 },
  { type: "pep_talk", text: "Listen to today's pep talk", xp: 3 },
  { type: "habits_3", text: "Complete 3 habits today", xp: 15 },
  { type: "all_habits", text: "Complete all your habits", xp: 20 },
  { type: "reflection", text: "Write a reflection note", xp: 5 },
  { type: "quote_share", text: "Share a quote", xp: 5 },
  { type: "mentor_chat", text: "Chat with your mentor", xp: 10 },
];

export const useDailyMissions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const today = new Date().toISOString().split('T')[0];

  const { data: missions, isLoading } = useQuery({
    queryKey: ['daily-missions', today, user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: existing } = await supabase
        .from('daily_missions')
        .select('*')
        .eq('user_id', user.id)
        .eq('mission_date', today);

      // If no missions for today, generate 3 random ones
      if (!existing || existing.length === 0) {
        const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
        const selectedMissions = shuffled.slice(0, 3);
        
        const { data: created } = await supabase
          .from('daily_missions')
          .insert(
            selectedMissions.map(m => ({
              user_id: user.id,
              mission_type: m.type,
              mission_text: m.text,
              xp_reward: m.xp,
              mission_date: today,
            }))
          )
          .select();
        
        return created || [];
      }

      return existing;
    },
    enabled: !!user,
  });

  const completeMission = useMutation({
    mutationFn: async (missionId: string) => {
      const mission = missions?.find(m => m.id === missionId);
      if (!mission) throw new Error("Mission not found");

      const { data, error } = await supabase
        .from('daily_missions')
        .update({ 
          completed: true, 
          completed_at: new Date().toISOString() 
        })
        .eq('id', missionId)
        .select()
        .single();

      if (error) throw error;
      
      // Award XP with display reason
      await awardCustomXP(mission.xp_reward, `mission_${mission.mission_type}`, "Mission Complete!");
      
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
  };
};
