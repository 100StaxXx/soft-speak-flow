import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useActivityFeed } from "./useActivityFeed";
import { MISSION_ACTIVITY_MAP } from "@/config/missionTemplates";
import { useToast } from "./use-toast";
import { useXPToast } from "@/contexts/XPContext";
import {
  completeDailyMissionWithXp,
  getMissionCompletionError,
  MissionCompletionError,
  showMissionRewardFeedback,
} from "@/lib/dailyMissionCompletion";
import { invalidateCompanionQueries } from "@/lib/companionContextQueryCache";
import { invalidateDailyMissionQueries } from "@/lib/dailyMissionQueryCache";
import { queryKeys } from "@/lib/queryKeys";
import { playMissionComplete } from "@/utils/soundEffects";
import { logger } from "@/utils/logger";
import confetti from "canvas-confetti";

/**
 * Hook that automatically detects user actions and completes relevant missions
 * Listens to activity feed and matches against mission requirements
 */
export const useMissionAutoComplete = () => {
  const log = logger.scope("useMissionAutoComplete");
  const { user } = useAuth();
  const { activities } = useActivityFeed();
  const { toast } = useToast();
  const { showXPToast } = useXPToast();
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
            const { error: progressError } = await supabase
              .from('daily_missions')
              .update({ progress_current: newProgress })
              .eq('id', mission.id)
              .eq('user_id', user.id);

            if (!progressError) {
              void invalidateDailyMissionQueries(queryClient, {
                missionDate: today,
                userId: user.id,
                includeMissionsAll: true,
              });
            }
          }

          // Complete mission if criteria met
          if (shouldComplete && !mission.completed && mounted) {
            const completionResult = await completeDailyMissionWithXp({
              missionId: mission.id,
              completionSource: "auto_complete",
              progressCurrent: mission.progress_target,
            });

            if (completionResult.status === "completed" && mounted) {
              showMissionRewardFeedback(
                completionResult,
                showXPToast,
                `Mission Complete! ${mission.mission_text}`,
              );
              await invalidateCompanionQueries(queryClient, { includeAll: true });

              toast({
                title: "Mission Auto-Completed! 🎯",
                description: `${mission.mission_text} (+${completionResult.xp_awarded} XP)`,
              });

              playMissionComplete();

              confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 },
                colors: ['#A76CFF', '#C084FC', '#E879F9'],
              });

              void invalidateDailyMissionQueries(queryClient, {
                missionDate: today,
                userId: user.id,
                includeMissionsAll: true,
                includePulseAll: true,
              });
            } else if (completionResult.status !== "already_completed") {
              throw getMissionCompletionError(completionResult);
            }
          }
        }
      } catch (error) {
        if (error instanceof MissionCompletionError && error.kind === "infrastructure") {
          log.warn("Mission auto-complete RPC unavailable", {
            userId: user.id,
            missionDate: today,
            message: error.message,
          });
          return;
        }

        log.error("Error in mission auto-complete", {
          userId: user.id,
          missionDate: today,
          error,
        });
      }
    };

    checkAndCompleteMissions();

    return () => {
      mounted = false;
    };
  }, [activities, user, today, todayStartMs, queryClient, showXPToast, toast]);
};
