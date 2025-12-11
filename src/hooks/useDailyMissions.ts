import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, getDocument, updateDocument, setDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { useXPRewards } from "./useXPRewards";
import { useAchievements } from "./useAchievements";
import { playMissionComplete } from "@/utils/soundEffects";
import { useState, useEffect } from "react";
import { MISSION_TEMPLATES } from "@/config/missionTemplates";

/**
 * useDailyMissions Hook
 * 
 * ARCHITECTURAL DECISION: Client-side mission generation
 * 
 * Missions are currently generated client-side from MISSION_TEMPLATES rather than
 * using the Firebase Function (generateDailyMissions) for the following reasons:
 * 
 * 1. Performance: Instant generation without network latency
 * 2. Offline capability: Works without internet connection
 * 3. Reliability: No dependency on Firebase Function availability
 * 4. Cost: Avoids Firebase Function invocation costs
 * 
 * The Firebase Function (generateDailyMissions) exists but is not used.
 * If you want to switch to server-side generation for personalization/AI features,
 * uncomment the function call in the queryFn and remove client-side generation.
 * 
 * @see src/lib/firebase/functions.ts:88 - generateDailyMissions function
 */
export const useDailyMissions = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { awardCustomXP } = useXPRewards();
  const { checkFirstTimeAchievements } = useAchievements();
  const today = new Date().toLocaleDateString('en-CA');
  const [generationErrorMessage, setGenerationErrorMessage] = useState<string | null>(null);

  const { data: missions, isLoading, error } = useQuery({
    queryKey: ['daily-missions', today, user?.uid],
    queryFn: async () => {
      if (!user) return [];
      
      setGenerationErrorMessage(null);
      
      // Try to get existing missions
      const existing = await getDocuments(
        'daily_missions',
        [
          ['user_id', '==', user.uid],
          ['mission_date', '==', today],
        ]
      );

      // If no missions exist, generate them client-side
      if (existing.length === 0) {
        // Generate 3 missions: 1 from each category (connection, quick_win, identity)
        const connectionMissions = MISSION_TEMPLATES.filter(m => m.category === 'connection');
        const quickWinMissions = MISSION_TEMPLATES.filter(m => m.category === 'quick_win');
        const identityMissions = MISSION_TEMPLATES.filter(m => m.category === 'identity');
        
        // Randomly select one from each category
        const selectedTemplates = [
          connectionMissions[Math.floor(Math.random() * connectionMissions.length)],
          quickWinMissions[Math.floor(Math.random() * quickWinMissions.length)],
          identityMissions[Math.floor(Math.random() * identityMissions.length)],
        ].filter(Boolean);
        
        // Create mission documents in Firestore
        const newMissions = [];
        for (const template of selectedTemplates) {
          const missionId = `${user.uid}_${today}_${template.type}`;
          const mission = {
            id: missionId,
            user_id: user.uid,
            mission_date: today,
            mission_type: template.type,
            mission_text: template.text,
            xp_reward: template.xp,
            difficulty: template.difficulty,
            category: template.category,
            completed: false,
            completed_at: null,
            auto_complete: template.autoComplete,
            progress_current: 0,
            progress_target: template.progressTarget || 1,
          };
          
          await setDocument('daily_missions', missionId, mission, false);
          newMissions.push(mission);
        }
        
        return newMissions.map(mission => ({
          ...mission,
          created_at: new Date().toISOString(),
        }));
      }

      setGenerationErrorMessage(null);
      return existing.map(mission => ({
        ...mission,
        created_at: timestampToISO(mission.created_at as any) || mission.created_at,
        completed_at: timestampToISO(mission.completed_at as any) || mission.completed_at,
      }));
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes - missions are daily, don't change often
    refetchOnWindowFocus: false,
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

      // Delete existing missions for today
      const existing = await getDocuments(
        'daily_missions',
        [
          ['user_id', '==', user.uid],
          ['mission_date', '==', today],
        ]
      );
      
      // Note: Firestore doesn't support batch delete easily, so we'll just create new ones
      // The old ones will be ignored since we filter by date
      
      // Generate new missions (same logic as initial generation)
      const connectionMissions = MISSION_TEMPLATES.filter(m => m.category === 'connection');
      const quickWinMissions = MISSION_TEMPLATES.filter(m => m.category === 'quick_win');
      const identityMissions = MISSION_TEMPLATES.filter(m => m.category === 'identity');
      
      const selectedTemplates = [
        connectionMissions[Math.floor(Math.random() * connectionMissions.length)],
        quickWinMissions[Math.floor(Math.random() * quickWinMissions.length)],
        identityMissions[Math.floor(Math.random() * identityMissions.length)],
      ].filter(Boolean);
      
      const newMissions = [];
      for (const template of selectedTemplates) {
        const missionId = `${user.uid}_${today}_${template.type}_${Date.now()}`;
        const mission = {
          id: missionId,
          user_id: user.uid,
          mission_date: today,
          mission_type: template.type,
          mission_text: template.text,
          xp_reward: template.xp,
          difficulty: template.difficulty,
          category: template.category,
          completed: false,
          completed_at: null,
          auto_complete: template.autoComplete,
          progress_current: 0,
          progress_target: template.progressTarget || 1,
        };
        
        await setDocument('daily_missions', missionId, mission, false);
        newMissions.push(mission);
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
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }
      
      const mission = missions?.find(m => m.id === missionId);
      if (!mission) throw new Error("Mission not found");

      // Check if already completed to prevent XP spam
      if (mission.completed) {
        throw new Error("Mission already completed");
      }

      const missionData = await getDocument<{ user_id: string; completed: boolean }>('daily_missions', missionId);
      if (!missionData) throw new Error("Mission not found");
      if (missionData.user_id !== user.uid) throw new Error("Unauthorized");
      if (missionData.completed) throw new Error("Mission already completed");

      await updateDocument('daily_missions', missionId, {
        completed: true,
        completed_at: new Date().toISOString(),
      });
      
      // Award XP with display reason
      await awardCustomXP(
        mission.xp_reward, 
        `mission_${mission.mission_type}`, 
        "Mission Complete!",
        { mission_id: mission.id }
      );
      
      // Check for first mission achievement
      const completedMissions = await getDocuments(
        'daily_missions',
        [
          ['user_id', '==', user.uid],
          ['completed', '==', true],
        ]
      );
      
      if (completedMissions.length === 1) {
        await checkFirstTimeAchievements('mission');
      }
      
      return { ...mission, completed: true, completed_at: new Date().toISOString() };
    },
    retry: 2,
    retryDelay: 1000,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
      toast({ title: "Mission Complete!", description: "XP awarded!" });
      playMissionComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Mission not completed",
        description: error.message,
        variant: "destructive",
      });
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
