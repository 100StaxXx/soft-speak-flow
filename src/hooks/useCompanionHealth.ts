import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCompanion } from "./useCompanion";
import { useMemo } from "react";

export type CompanionMoodState = 'happy' | 'content' | 'neutral' | 'worried' | 'sad' | 'sick';

interface CompanionHealth {
  healthPercentage: number;
  moodState: CompanionMoodState;
  isNeglected: boolean;
  daysInactive: number;
  imageUrl: string | null;
  neglectedImageUrl: string | null;
  body: number;
  mind: number;
  soul: number;
  lastActivityDate: string | null;
  // New Tamagotchi fields
  isAlive: boolean;
  hunger: number;
  happiness: number;
  careScore: number;
  recoveryProgress: number;
  isRecovering: boolean;
  isCritical: boolean;
}

interface StreakFreezeData {
  streakFreezesAvailable: number;
  lastStreakFreezeUsed: string | null;
  streakFreezesResetAt: string | null;
  daysUntilReset: number;
}

/**
 * Hook to track companion health, mood state, and neglect status
 */
export const useCompanionHealth = () => {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const queryClient = useQueryClient();

  // Fetch extended companion data with neglect fields
  const { data: companionHealthData, isLoading: isHealthLoading } = useQuery({
    queryKey: ['companion-health', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('user_companion')
        .select('inactive_days, last_activity_date, neglected_image_url, current_mood, body, mind, soul, current_image_url, is_alive, hunger, happiness, care_score, recovery_progress')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch companion health:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minute
  });

  // Fetch streak freeze data from profile
  const { data: streakFreezeData, isLoading: isFreezeLoading } = useQuery({
    queryKey: ['streak-freezes', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('streak_freezes_available, last_streak_freeze_used, streak_freezes_reset_at')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch streak freeze data:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000,
  });

  // Calculate mood state based on inactive days
  const getMoodState = (inactiveDays: number): CompanionMoodState => {
    if (inactiveDays === 0) return 'happy';
    if (inactiveDays === 1) return 'neutral';
    if (inactiveDays === 2) return 'worried';
    if (inactiveDays >= 3 && inactiveDays < 5) return 'sad';
    if (inactiveDays >= 5) return 'sick';
    return 'happy';
  };

  // Compute health metrics
  const health: CompanionHealth = useMemo(() => {
    const body = companionHealthData?.body ?? 100;
    const mind = companionHealthData?.mind ?? 0;
    const soul = companionHealthData?.soul ?? 0;
    const inactiveDays = companionHealthData?.inactive_days ?? 0;
    const isAlive = companionHealthData?.is_alive ?? true;
    const hunger = companionHealthData?.hunger ?? 100;
    const happiness = companionHealthData?.happiness ?? 100;
    const careScore = companionHealthData?.care_score ?? 100;
    const recoveryProgress = companionHealthData?.recovery_progress ?? 100;
    
    const healthPercentage = Math.round((body + mind + soul) / 3);
    const moodState = getMoodState(inactiveDays);
    const isNeglected = inactiveDays >= 3;
    const isRecovering = recoveryProgress < 100;
    const isCritical = inactiveDays >= 5;
    
    // Determine which image to show based on mood
    const shouldShowNeglectedImage = isNeglected && companionHealthData?.neglected_image_url;
    const imageUrl = shouldShowNeglectedImage 
      ? companionHealthData.neglected_image_url 
      : (companionHealthData?.current_image_url || companion?.current_image_url || null);

    return {
      healthPercentage,
      moodState,
      isNeglected,
      daysInactive: inactiveDays,
      imageUrl,
      neglectedImageUrl: companionHealthData?.neglected_image_url || null,
      body,
      mind,
      soul,
      lastActivityDate: companionHealthData?.last_activity_date || null,
      isAlive,
      hunger,
      happiness,
      careScore,
      recoveryProgress,
      isRecovering,
      isCritical,
    };
  }, [companionHealthData, companion]);

  // Compute streak freeze info
  const streakFreeze: StreakFreezeData = useMemo(() => {
    const resetAt = streakFreezeData?.streak_freezes_reset_at;
    let daysUntilReset = 7;
    
    if (resetAt) {
      const resetDate = new Date(resetAt);
      const now = new Date();
      const diffMs = resetDate.getTime() - now.getTime();
      daysUntilReset = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      streakFreezesAvailable: streakFreezeData?.streak_freezes_available ?? 1,
      lastStreakFreezeUsed: streakFreezeData?.last_streak_freeze_used || null,
      streakFreezesResetAt: resetAt || null,
      daysUntilReset,
    };
  }, [streakFreezeData]);

  // Function to mark user as active (call when user completes any activity)
  const markUserActive = async () => {
    if (!user?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      await supabase
        .from('user_companion')
        .update({
          last_activity_date: today,
          inactive_days: 0,
          current_mood: 'happy',
        })
        .eq('user_id', user.id);

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['companion-health'] });
      queryClient.invalidateQueries({ queryKey: ['companion'] });
    } catch (error) {
      console.error('Failed to mark user active:', error);
    }
  };

  // Check if user needs welcome back modal
  const needsWelcomeBack = health.daysInactive >= 2;

  // Get CSS filter styles for mood states
  const getMoodFilterStyles = (mood: CompanionMoodState): React.CSSProperties => {
    switch (mood) {
      case 'happy':
      case 'content':
        return {}; // No filter for happy states
      case 'neutral':
        return { filter: 'saturate(0.9) brightness(0.95)' };
      case 'worried':
        return { filter: 'saturate(0.7) brightness(0.9)' };
      case 'sad':
        return { filter: 'saturate(0.5) brightness(0.85)' };
      case 'sick':
        return { filter: 'saturate(0.3) brightness(0.7) sepia(0.2)' };
      default:
        return {};
    }
  };

  return {
    health,
    streakFreeze,
    isLoading: isHealthLoading || isFreezeLoading,
    markUserActive,
    needsWelcomeBack,
    getMoodFilterStyles,
  };
};
