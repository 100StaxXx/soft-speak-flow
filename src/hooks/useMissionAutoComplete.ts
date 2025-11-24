import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useActivityFeed } from "./useActivityFeed";
import { MISSION_ACTIVITY_MAP } from "@/config/missionTemplates";
import { useXPRewards } from "./useXPRewards";
import { useToast } from "./use-toast";
import { playMissionComplete } from "@/utils/soundEffects";
import confetti from "canvas-confetti";

/**
 * Hook that automatically detects user actions and completes relevant missions
 * Listens to activity feed and matches against mission requirements
 */
export const useMissionAutoComplete = () => {
  const { user } = useAuth();
  const { activities } = useActivityFeed();
  const { awardCustomXP } = useXPRewards();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const today = now.toLocaleDateString('en-CA');
  const todayStartMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  useEffect(() => {
    if (!user || !activities || activities.length === 0) return;

    let mounted = true;

    const checkAndCompleteMissions = async () => {
      try {
        // Get today's incomplete missions
        const { data: missions, error: missionsError } = await supabase
          .from('daily_missions')
          .select('*')
          .eq('user_id', user.id)
          .eq('mission_date', today)
          .eq('completed', false)
          .eq('auto_complete', true);

        if (missionsError) {
          console.error("Error fetching missions:", missionsError);
          return;
        }

        if (!missions || missions.length === 0 || !mounted) return;

        // Get today's activities
        const todayActivities = activities.filter(a => 
          new Date(a.created_at).getTime() >= todayStartMs
        );

        for (const mission of missions) {
          if (!mounted) break;

          const missionConfig = MISSION_ACTIVITY_MAP[mission.mission_type];
          if (!missionConfig) continue;

          const activityTypes = Array.isArray(missionConfig.activityType) 
            ? missionConfig.activityType 
            : [missionConfig.activityType];

          // Count matching activities
          const matchingActivities = todayActivities.filter(activity => 
            activityTypes.includes(activity.activity_type)
          );

          let shouldComplete = false;
          let newProgress = mission.progress_current;

          if (missionConfig.validator) {
            // Custom validation logic
            for (const activity of matchingActivities) {
              if (missionConfig.validator(activity.activity_data, newProgress, mission.progress_target)) {
                newProgress++;
                if (newProgress >= mission.progress_target) {
                  shouldComplete = true;
                  break;
                }
              }
            }
          } else {
            // Simple count-based completion
            newProgress = matchingActivities.length;
            shouldComplete = newProgress >= mission.progress_target;
          }

          // Update progress
          if (newProgress !== mission.progress_current && mounted) {
            await supabase
              .from('daily_missions')
              .update({ progress_current: newProgress })
              .eq('id', mission.id);
          }

          // Complete mission if criteria met
          if (shouldComplete && !mission.completed && mounted) {
            const { error } = await supabase
              .from('daily_missions')
              .update({ 
                completed: true, 
                completed_at: new Date().toISOString(),
                progress_current: mission.progress_target 
              })
              .eq('id', mission.id);

            if (!error && mounted) {
              // Award XP
              await awardCustomXP(
                mission.xp_reward, 
                `mission_${mission.mission_type}`, 
                `Mission Complete! ${mission.mission_text}`
              );

              // Show toast
              toast({ 
                title: "Mission Auto-Completed! 🎯", 
                description: `${mission.mission_text} (+${mission.xp_reward} XP)`
              });

              // Play sound
              playMissionComplete();

              // Small confetti
              confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#A76CFF', '#C084FC', '#E879F9'],
              });

              // Invalidate queries
              queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
            }
          }
        }
      } catch (error) {
        console.error("Error in mission auto-complete:", error);
      }
    };

    checkAndCompleteMissions();

    return () => {
      mounted = false;
    };
  }, [activities, user, today, todayStartMs, awardCustomXP, toast, queryClient]);
};
